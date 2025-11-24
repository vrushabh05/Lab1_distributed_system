import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import {
  config,
  createLogger,
  createDatabaseManager,
  createKafkaManager,
  createHealthChecker,
  ApplicationError,
  NotFoundError
} from '../../shared/core/index.js';
import Booking from './models/Booking.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = 'booking-service';
config.SERVICE_NAME = SERVICE_NAME;

const logger = createLogger(SERVICE_NAME, config.LOG_LEVEL);
const db = createDatabaseManager(config, logger);
const kafka = createKafkaManager(config, logger);
const health = createHealthChecker(SERVICE_NAME, logger);

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security & compression
app.use(helmet());
app.use(compression());

// Stricter CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = config.CORS_ORIGIN
      ? config.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:5173'];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging with correlation ID
app.use((req, res, next) => {
  req.correlationId = logger.generateCorrelationId();
  req.logger = logger.child(req.correlationId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.info(`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
});

// ============================================================================
// API SECURITY
// ============================================================================

// CRITICAL SECURITY: Validate API key at startup (fail-fast)
const BOOKING_API_KEY = process.env.BOOKING_SERVICE_API_KEY || '';

// CRITICAL FIX: API key validation will be enforced at startup (see startup() function)
// This prevents the service from starting in an insecure state

const requireApiKey = (req, res, next) => {
  // At this point, BOOKING_API_KEY is guaranteed to be set (validated at startup)
  const provided = req.header('x-api-key');
  
  if (provided !== BOOKING_API_KEY) {
    logger.warn('Invalid API key provided', { 
      ip: req.ip, 
      path: req.path 
    });
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// ============================================================================
// KAFKA CONSUMER
// ============================================================================

async function setupKafkaConsumer() {
  const consumer = await kafka.createConsumer('booking-status-sync-group');
  if (!consumer) {
    logger.warn('Kafka consumer not created - running without Kafka');
    return;
  }

  await kafka.subscribe('booking-updates', async (updateData) => {
    logger.info('Received booking status update', {
      bookingId: updateData.bookingId,
      status: updateData.status
    });

    try {
      // FIX MESSAGE ORDERING: Use findByIdAndUpdate with upsert to handle out-of-order messages
      // If booking-updates arrives before booking-requests, create placeholder record
      const updatedBooking = await Booking.findByIdAndUpdate(
        updateData.bookingId,
        {
          status: updateData.status,
          updatedAt: new Date(),
          // Only set these fields if creating new document (upsert case)
          $setOnInsert: {
            _id: updateData.bookingId,
            // Mark as placeholder - will be filled when booking-requests arrives
            _placeholder: true,
            createdAt: new Date()
          }
        },
        {
          new: true,
          upsert: true, // Create if not exists (handles out-of-order arrival)
          runValidators: false // Skip validation for placeholder records
        }
      );

      if (updatedBooking._placeholder) {
        logger.warn('Status update arrived before booking creation, created placeholder', {
          bookingId: updateData.bookingId,
          status: updateData.status
        });
      } else {
        logger.info('Booking status updated successfully', {
          bookingId: updatedBooking._id,
          newStatus: updateData.status
        });
      }
    } catch (error) {
      logger.error('Error updating booking status', error, {
        bookingId: updateData.bookingId
      });
      throw error; // Rethrow to trigger Kafka retry
    }
  });

  await kafka.subscribe('booking-requests', async (bookingData) => {
    logger.info('Received booking request, creating ledger entry', {
      bookingId: bookingData.bookingId
    });

    try {
      // FIX MESSAGE ORDERING: Check if placeholder exists from out-of-order booking-updates
      const existingBooking = await Booking.findById(bookingData.bookingId);
      
      if (existingBooking) {
        // Booking already exists (either placeholder or duplicate message)
        if (existingBooking._placeholder) {
          // Update placeholder with full booking data
          existingBooking.travelerId = bookingData.travelerId;
          existingBooking.propertyId = bookingData.propertyId;
          existingBooking.ownerId = bookingData.ownerId;
          existingBooking.startDate = new Date(bookingData.startDate);
          existingBooking.endDate = new Date(bookingData.endDate);
          existingBooking.totalPrice = bookingData.totalPrice;
          existingBooking.pricePerNight = bookingData.pricePerNight;
          existingBooking.guests = bookingData.guests;
          existingBooking.title = bookingData.title;
          existingBooking.city = bookingData.city;
          existingBooking.state = bookingData.state;
          existingBooking.country = bookingData.country;
          // Keep the status from the earlier update message
          existingBooking._placeholder = undefined; // Remove placeholder flag
          existingBooking.updatedAt = new Date();
          
          await existingBooking.save();
          logger.info('Placeholder booking filled with full data', { 
            bookingId: bookingData.bookingId,
            currentStatus: existingBooking.status
          });
        } else {
          // Duplicate message (idempotency)
          logger.info('Duplicate booking request received, ignoring.', { 
            bookingId: bookingData.bookingId 
          });
        }
        return;
      }

      // Create new booking (normal case)
      const booking = new Booking({
        _id: bookingData.bookingId,
        travelerId: bookingData.travelerId,
        propertyId: bookingData.propertyId,
        ownerId: bookingData.ownerId,
        startDate: new Date(bookingData.startDate),
        endDate: new Date(bookingData.endDate),
        totalPrice: bookingData.totalPrice,
        pricePerNight: bookingData.pricePerNight,
        guests: bookingData.guests,
        title: bookingData.title,
        city: bookingData.city,
        state: bookingData.state,
        country: bookingData.country,
        status: bookingData.status,
      });

      await booking.save();
      logger.info('Booking ledger entry created successfully', { bookingId: booking._id });
    } catch (error) {
      if (error.code === 11000) {
        // Race condition: Another consumer already created it
        logger.info('Duplicate key error (race condition), booking already created', { 
          bookingId: bookingData.bookingId 
        });
        return;
      }
      
      logger.error('Error creating booking ledger entry', error, { 
        bookingId: bookingData.bookingId 
      });
      throw error; // Rethrow to trigger Kafka retry
    }
  });

  // Start the consumer after all subscriptions are set up
  await kafka.startConsumer();
}

// ============================================================================
// ROUTES
// ============================================================================

// Liveness probe
app.get('/healthz', async (req, res) => {
  const result = await health.liveness();
  res.json(result);
});

// Readiness probe
app.get('/health', async (req, res) => {
  const result = await health.readiness();
  res.status(result.ready ? 200 : 503).json(result);
});

// Detailed health
app.get('/health/detailed', async (req, res) => {
  const result = await health.detailed();
  res.json(result);
});

// Protected REST API with pagination
app.get('/api/bookings', requireApiKey, async (req, res) => {
  try {
    const { travelerId, ownerId, status, propertyId } = req.query;

    // Pagination parameters with defaults
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const query = {};
    if (travelerId) query.travelerId = travelerId;
    if (ownerId) query.ownerId = ownerId;
    if (status) query.status = status;
    if (propertyId) query.propertyId = propertyId;

    // Get total count for pagination metadata
    const totalCount = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      bookings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('List bookings error', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.post('/api/bookings/availability', requireApiKey, async (req, res) => {
  try {
    const { propertyId, startDate, endDate } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!propertyId || !startDate || !endDate || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Missing or invalid parameters for availability check' });
    }

    const overlappingBookings = await Booking.find({
      propertyId,
      status: { $in: ['PENDING', 'ACCEPTED'] },
      $or: [
        { startDate: { $gte: start, $lt: end } },
        { endDate: { $gt: start, $lte: end } },
        { startDate: { $lte: start }, endDate: { $gte: end } }
      ]
    });

    if (overlappingBookings.length > 0) {
      return res.status(200).json({
        available: false,
        message: 'Property is not available for the selected dates.',
        conflicts: overlappingBookings.map(b => ({
          id: b._id,
          startDate: b.startDate,
          endDate: b.endDate
        }))
      });
    }

    res.json({ available: true });
  } catch (error) {
    logger.error('Check availability error', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

app.get('/api/bookings/:id', requireApiKey, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ booking });
  } catch (error) {
    logger.error('Get booking error', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

app.patch('/api/bookings/:id/status', requireApiKey, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['PENDING', 'ACCEPTED', 'CANCELLED', 'COMPLETED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ message: 'Status updated', booking });
  } catch (error) {
    logger.error('Update booking status error', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  if (err instanceof ApplicationError) {
    req.logger.warn('Application error', {
      code: err.code,
      statusCode: err.statusCode,
      message: err.message
    });
    return res.status(err.statusCode).json(err.toJSON());
  }

  req.logger.error('Unhandled error', err);
  res.status(500).json({
    error: {
      message: config.isDevelopment() ? err.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  });
});

// ============================================================================
// STARTUP & SHUTDOWN
// ============================================================================

let server;

async function startup() {
  try {
    // CRITICAL FIX: Strict initialization order to prevent race conditions
    logger.info(`Starting ${SERVICE_NAME}...`);

    // Step 0: SECURITY VALIDATION - Fail fast if missing critical config
    logger.info('Step 0/4: Validating security configuration...');
    
    if (!BOOKING_API_KEY || BOOKING_API_KEY.trim() === '') {
      logger.error('❌ FATAL: BOOKING_SERVICE_API_KEY is not set or empty');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🔴 SECURITY ERROR: BOOKING_SERVICE_API_KEY is required');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('The booking service API requires an API key for authentication.');
      console.error('Without this key, the availability check endpoint is insecure.');
      console.error('');
      console.error('Please set the BOOKING_SERVICE_API_KEY environment variable:');
      console.error('  export BOOKING_SERVICE_API_KEY="your-secure-random-key"');
      console.error('');
      console.error('You can generate a secure key with:');
      console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      process.exit(1); // FAIL-FAST: Do not start in insecure state
    }
    
    if (BOOKING_API_KEY.length < 16) {
      logger.error('❌ FATAL: BOOKING_SERVICE_API_KEY is too weak (minimum 16 characters)');
      console.error('🔴 SECURITY ERROR: API key must be at least 16 characters');
      process.exit(1);
    }
    
    logger.info('✅ Security configuration validated');

    // Step 1: Connect to MongoDB FIRST (consumer will need this immediately)
    logger.info('Step 1/4: Connecting to MongoDB...');
    await db.connect();
    logger.info('✅ MongoDB connected - ready for database operations');

    // Step 2: Initialize Kafka and setup consumer (MongoDB MUST be ready)
    logger.info('Step 2/4: Initializing Kafka consumer...');
    kafka.initialize();
    await setupKafkaConsumer();
    logger.info('✅ Kafka consumer ready - MongoDB connection verified before message processing');

    // Step 3: Register health checks
    health.registerCheck('database', () => db.healthCheck());
    health.registerCheck('kafka', () => kafka.healthCheck());

    // Step 4: Start HTTP server (only after all dependencies ready)
    logger.info('Step 3/4: Starting HTTP server...');
    server = app.listen(config.PORT, () => {
      logger.info(`${SERVICE_NAME} listening on port ${config.PORT}`, {
        environment: config.NODE_ENV,
        kafkaEnabled: config.KAFKA_ENABLED
      });
      logger.info('✅ All systems operational - service ready to process requests');
    });

  } catch (error) {
    logger.error('Startup failed', error);
    console.error(`❌ FATAL: ${SERVICE_NAME} startup failed:`, error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT);

  try {
    // Close HTTP server (stop accepting new requests)
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }

    // Disconnect Kafka
    await kafka.disconnect();

    // Disconnect database
    await db.disconnect();

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the service
startup();
