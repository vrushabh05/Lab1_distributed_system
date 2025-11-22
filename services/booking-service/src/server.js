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
} from '../shared/core/index.js';
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

const BOOKING_API_KEY = process.env.BOOKING_SERVICE_API_KEY || '';
if (!BOOKING_API_KEY) {
  logger.warn('BOOKING_SERVICE_API_KEY is not set - booking REST endpoints will reject all requests');
}

const requireApiKey = (req, res, next) => {
  if (!BOOKING_API_KEY) {
    return res.status(503).json({ error: 'Booking service API is not configured' });
  }

  const provided = req.header('x-api-key');
  if (provided !== BOOKING_API_KEY) {
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
      const booking = await Booking.findById(updateData.bookingId);
      if (booking) {
        booking.status = updateData.status;
        booking.updatedAt = new Date();
        await booking.save();

        logger.info('Booking status updated successfully', {
          bookingId: booking._id,
          newStatus: updateData.status
        });
      } else {
        logger.warn('Booking not found for update', {
          bookingId: updateData.bookingId
        });
      }
    } catch (error) {
      logger.error('Error updating booking status', error, {
        bookingId: updateData.bookingId
      });
    }
  });

  await kafka.subscribe('booking-requests', async (bookingData) => {
    logger.info('Received booking request, creating ledger entry', {
      bookingId: bookingData.bookingId
    });

    try {
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
      if (error.code !== 11000) { // Ignore duplicate key errors
        logger.error('Error creating booking ledger entry', error, { bookingId: bookingData.bookingId });
      } else {
        logger.info('Duplicate booking request received, ignoring.', { bookingId: bookingData.bookingId });
      }
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
    const { travelerId, ownerId, status } = req.query;

    // Pagination parameters with defaults
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const query = {};
    if (travelerId) query.travelerId = travelerId;
    if (ownerId) query.ownerId = ownerId;
    if (status) query.status = status;

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
    logger.info(`Starting ${SERVICE_NAME}...`);

    // Connect to MongoDB
    await db.connect();

    // Initialize Kafka
    kafka.initialize();
    await setupKafkaConsumer();

    // Register health checks
    health.registerCheck('database', () => db.healthCheck());
    health.registerCheck('kafka', () => kafka.healthCheck());

    // Start HTTP server
    server = app.listen(config.PORT, () => {
      logger.info(`${SERVICE_NAME} listening on port ${config.PORT}`, {
        environment: config.NODE_ENV,
        kafkaEnabled: config.KAFKA_ENABLED
      });
    });

  } catch (error) {
    logger.error('Startup failed', error);
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
