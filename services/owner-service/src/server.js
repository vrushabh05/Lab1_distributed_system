import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import {
  config,
  createLogger,
  createDatabaseManager,
  createKafkaManager,
  createHealthChecker
} from '../shared/core/index.js';
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

    // Store booking in owner's database (synchronized from traveler service)
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
        comments: bookingData.comments,
        status: bookingData.status,
      });

      await booking.save();
      logger.info('Booking stored in owner service', { bookingId: booking._id });
    } catch (error) {
      if (error.code !== 11000) { // Ignore duplicate key errors
        logger.error('Error storing booking', error, { bookingId: bookingData.bookingId });
      }
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
    // Initialize Kafka
    kafka.initialize();

    // Create producer
    await kafka.createProducer();

    // Connect to database
    await db.connect();

    // Setup Kafka consumer
    await setupKafkaConsumer();

    // Register health checks
    health.registerCheck('database', () => db.healthCheck());
    health.registerCheck('kafka', () => kafka.healthCheck());

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`owner-service listening on port ${PORT}`, {
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
