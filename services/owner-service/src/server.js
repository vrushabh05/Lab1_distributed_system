import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import {
  config,
  createLogger,
  createDatabaseManager,
  createKafkaManager,
  createHealthChecker,
  createSessionMiddleware
} from '../../shared/core/index.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import dashboardRoutes from './routes/dashboard.js';
import Booking from './models/Booking.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = 'owner-service';
config.SERVICE_NAME = SERVICE_NAME;

const logger = createLogger(SERVICE_NAME, config.LOG_LEVEL);
const db = createDatabaseManager(config, logger);
const kafka = createKafkaManager(config, logger);
const health = createHealthChecker(SERVICE_NAME, logger);

// Export kafka instance for routes
export { kafka };

const app = express();
app.set('trust proxy', 1);
const PORT = config.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(compression());

// Stricter CORS configuration with origin validation
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = config.CORS_ORIGIN
      ? config.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'];
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(createSessionMiddleware(config, logger));
app.use((req, _res, next) => {
  if (req.session?.user && !req.user) {
    req.user = req.session.user;
  }
  next();
});
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'owner-service' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ============================================================================
// KAFKA CONSUMER
// ============================================================================

async function setupKafkaConsumer() {
  const consumer = await kafka.createConsumer('owner-service-group');
  if (!consumer) {
    logger.warn('Kafka consumer not created - running without Kafka');
    return;
  }

  await kafka.subscribe('booking-requests', async (bookingData) => {
    logger.info('Received booking request from traveler', {
      bookingId: bookingData.bookingId
    });

    // IDEMPOTENCY CHECK: Prevent duplicate processing of same booking
    try {
      // Check if booking already exists (handles Kafka redelivery)
      const bookingObjectId = new mongoose.Types.ObjectId(bookingData.bookingId);
      const ownerObjectId = mongoose.Types.ObjectId.isValid(bookingData.ownerId)
        ? new mongoose.Types.ObjectId(bookingData.ownerId)
        : bookingData.ownerId;
      const travelerObjectId = mongoose.Types.ObjectId.isValid(bookingData.travelerId)
        ? new mongoose.Types.ObjectId(bookingData.travelerId)
        : bookingData.travelerId;
      const propertyObjectId = mongoose.Types.ObjectId.isValid(bookingData.propertyId)
        ? new mongoose.Types.ObjectId(bookingData.propertyId)
        : bookingData.propertyId;

      const existingBooking = await Booking.findById(bookingObjectId);
      
      if (existingBooking) {
        logger.info('Booking already exists (duplicate message), skipping', { 
          bookingId: bookingData.bookingId,
          existingStatus: existingBooking.status
        });
        return; // Idempotent: Skip processing duplicate message
      }

      // Store booking in owner's database (synchronized from traveler service)
      const booking = new Booking({
        _id: bookingObjectId,
        travelerId: travelerObjectId,
        propertyId: propertyObjectId,
        ownerId: ownerObjectId,
        startDate: new Date(bookingData.startDate),
        endDate: new Date(bookingData.endDate),
        totalPrice: bookingData.totalPrice,
        pricePerNight: bookingData.pricePerNight,
        guests: bookingData.guests,
        title: bookingData.title,
        city: bookingData.city,
        state: bookingData.state,
        country: bookingData.country,
        comments: bookingData.comments,
        status: bookingData.status,
      });

      await booking.save();
      logger.info('Booking stored in owner service', { bookingId: booking._id });
    } catch (error) {
      // Handle race condition: Two consumers might check simultaneously
      if (error.code === 11000) {
        logger.info('Duplicate key error (race condition), booking already created', { 
          bookingId: bookingData.bookingId 
        });
        return; // Idempotent: Ignore duplicate key error
      }
      
      // Log other errors for monitoring
      logger.error('Error storing booking', error, { bookingId: bookingData.bookingId });
      throw error; // Rethrow to trigger Kafka retry if needed
    }
  });

  // CRITICAL FIX: Must call startConsumer() to actually begin processing messages
  await kafka.startConsumer();
}

// ============================================================================
// STARTUP & SHUTDOWN
// ============================================================================

let server;

async function startup() {
  try {
    // CRITICAL FIX: Database MUST be ready before Kafka consumer starts
    logger.info('Starting owner-service...');

    // Step 1: Connect to MongoDB FIRST (consumer will need this)
    logger.info('Step 1/4: Connecting to MongoDB...');
    await db.connect();
    logger.info('✅ MongoDB connected - ready for database operations');

    // Step 2: Initialize Kafka infrastructure
    logger.info('Step 2/4: Initializing Kafka...');
    kafka.initialize();
    await kafka.createProducer();
    logger.info('✅ Kafka producer initialized - ready to send messages');

    // Step 3: Setup Kafka consumer (MongoDB MUST be ready before this)
    logger.info('Step 3/4: Setting up Kafka consumer...');
    await setupKafkaConsumer();
    logger.info('✅ Kafka consumer ready - MongoDB connection verified before message processing');

    // Step 4: Register health checks
    health.registerCheck('database', () => db.healthCheck());
    health.registerCheck('kafka', () => kafka.healthCheck());

    // Step 5: Start HTTP server (only after all dependencies ready)
    logger.info('Step 4/4: Starting HTTP server...');
    server = app.listen(PORT, () => {
      logger.info(`owner-service listening on port ${PORT}`, {
        environment: config.NODE_ENV,
        kafkaEnabled: config.KAFKA_ENABLED
      });
      logger.info('✅ All systems operational - service ready to process requests');
    });
  } catch (error) {
    logger.error('Startup failed', error);
    console.error('❌ FATAL: owner-service startup failed:', error.message);
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
    // Close HTTP server
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
