import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import {
  config,
  createLogger,
  createDatabaseManager,
  createKafkaManager,
  createHealthChecker,
  ApplicationError
} from '../shared/core/index.js';
import path from 'path';
import authRoutes from './routes/auth.js';
import favoritesRoutes from './routes/favorites.js';
import bookingsRoutes from './routes/bookings.js';
import usersRoutes from './routes/users.js';
import Booking from './models/Booking.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = 'traveler-service';
config.SERVICE_NAME = SERVICE_NAME;

const logger = createLogger(SERVICE_NAME, config.LOG_LEVEL);
const db = createDatabaseManager(config, logger);
const kafka = createKafkaManager(config, logger);
const health = createHealthChecker(SERVICE_NAME, logger);

// Export kafka instance for routes
export { kafka };

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security & compression with enhanced helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
}));
app.use(compression());

// Stricter CORS configuration with origin validation
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Parse allowed origins from config (comma-separated list)
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
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for development/testing (was 5)
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general API endpoints (favorites, bookings, search)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes per IP
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for booking creation (per user)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 booking attempts per hour
  message: 'Too many booking attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?.id || req.ip;
  },
});

// ============================================================================
// KAFKA CONSUMER
// ============================================================================

async function setupKafkaConsumer() {
  const consumer = await kafka.createConsumer('traveler-service-group');
  if (!consumer) {
    logger.warn('Kafka consumer not created - running without Kafka');
    return;
  }

  await kafka.subscribe('booking-updates', async (updateData) => {
    logger.info('Received booking status update from owner', {
      bookingId: updateData.bookingId,
      status: updateData.status
    });

    try {
      const booking = await Booking.findById(updateData.bookingId);
      if (booking) {
        booking.status = updateData.status;
        booking.updatedAt = new Date();
        await booking.save();

        logger.info('Traveler booking status updated successfully', {
          bookingId: booking._id,
          newStatus: updateData.status
        });
      } else {
        logger.warn('Booking not found for update', {
          bookingId: updateData.bookingId
        });
      }
    } catch (error) {
      logger.error('Error updating traveler booking status', error, {
        bookingId: updateData.bookingId
      });
    }
  });

  // CRITICAL FIX: Must call startConsumer() to actually begin processing messages
  await kafka.startConsumer();
}

// ============================================================================
// ROUTES
// ============================================================================

// Health checks
app.get('/healthz', async (req, res) => {
  const result = await health.liveness();
  res.json(result);
});

app.get('/health', async (req, res) => {
  const result = await health.readiness();
  res.status(result.ready ? 200 : 503).json(result);
});

app.get('/health/detailed', async (req, res) => {
  const result = await health.detailed();
  res.json(result);
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/favorites', apiLimiter, favoritesRoutes);
app.use('/api/bookings', bookingLimiter, bookingsRoutes);
app.use('/api/users', apiLimiter, usersRoutes);

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
    await kafka.createProducer();
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
