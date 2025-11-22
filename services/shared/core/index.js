/**
 * Shared Core Module
 * Centralized infrastructure components for microservices
 */

export { Config, config } from './config.js';
export { Logger, createLogger } from './logger.js';
export { DatabaseManager, createDatabaseManager } from './database.js';
export { KafkaManager, createKafkaManager } from './kafka.js';
export { HealthChecker, createHealthChecker } from './health.js';
export { CacheManager } from './cache.js';
export {
  ApplicationError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  ServiceUnavailableError
} from './errors.js';
