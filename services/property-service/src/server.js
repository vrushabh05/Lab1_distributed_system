import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import {
  config,
  createLogger,
  createDatabaseManager,
  createHealthChecker,
  CacheManager,
  ApplicationError,
} from '../shared/core/index.js';
import propertyRoutes from './routes/properties.js';
import searchRoutes from './routes/search.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = 'property-service';
config.SERVICE_NAME = SERVICE_NAME;

const logger = createLogger(SERVICE_NAME, config.LOG_LEVEL);
const db = createDatabaseManager(config, logger);
const cache = new CacheManager(config, logger);
const health = createHealthChecker(SERVICE_NAME, logger);

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security & compression
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

// Request logging
app.use((req, res, next) => {
  req.correlationId = logger.generateCorrelationId();
  req.logger = logger.child(req.correlationId);
  next();
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// ROUTES
// ============================================================================

// Health checks
app.get('/healthz', async (req, res) => res.json(await health.liveness()));
app.get('/health', async (req, res) => {
  const result = await health.readiness();
  res.status(result.ready ? 200 : 503).json(result);
});
app.get('/health/detailed', async (req, res) => res.json(await health.detailed()));

// API Routes
app.use('/api/properties', apiLimiter, propertyRoutes);
app.use('/api/search', apiLimiter, searchRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  if (err instanceof ApplicationError) {
    req.logger.warn('Application error', { code: err.code, statusCode: err.statusCode, message: err.message });
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
    
    // Connect to Redis cache
    await cache.connect();
    
    // Register health checks
    health.registerCheck('database', () => db.healthCheck());
    health.registerCheck('cache', () => cache.healthCheck());
    
    // Start HTTP server
    server = app.listen(config.PORT, () => {
      logger.info(`${SERVICE_NAME} listening on port ${config.PORT}`, {
        environment: config.NODE_ENV,
        cacheEnabled: config.REDIS_ENABLED
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }
    await cache.disconnect();
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

// Export cache for use in routes
export { cache };

// Start the service
startup();

