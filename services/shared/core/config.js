/**
 * Shared Core: Configuration Management
 * Centralized, validated configuration for microservices
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuration class with validation and type coercion
 */
export class Config {
  constructor() {
    // Application
    this.NODE_ENV = process.env.NODE_ENV || 'development';
    this.PORT = this._parsePort(process.env.PORT);
    this.SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';
    
    // Security
    this.JWT_SECRET = process.env.JWT_SECRET;
    
    // MongoDB
    this.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/airbnb';
    this.MONGODB_OPTIONS = {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '50'),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    // Kafka
    this.KAFKA_ENABLED = process.env.KAFKA_ENABLED !== 'false';
    this.KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
    this.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || this.SERVICE_NAME;
    this.KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || `${this.SERVICE_NAME}-group`;
    this.KAFKA_CONNECTION_TIMEOUT = parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000');
    this.KAFKA_REQUEST_TIMEOUT = parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000');
    
    // Redis Cache
    this.REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
    this.REDIS_HOST = process.env.REDIS_HOST || 'redis';
    this.REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
    this.CACHE_TTL = parseInt(process.env.CACHE_TTL || '300'); // 5 minutes default
    
    // CORS
    this.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
    
    // Logging
    this.LOG_LEVEL = process.env.LOG_LEVEL || 'info';
    
    // Health checks
    this.HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
    
    // Graceful shutdown
    this.SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000');
    
    // Validate critical configuration
    this._validate();
  }
  
  _parsePort(portStr) {
    const port = parseInt(portStr || '3000');
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid PORT: ${portStr}`);
    }
    return port;
  }
  
  _validate() {
    const errors = [];
    
    if (!this.MONGODB_URI) {
      errors.push('MONGODB_URI is required');
    }
    
    if (this.KAFKA_ENABLED && !this.KAFKA_BROKER) {
      errors.push('KAFKA_BROKER is required when Kafka is enabled');
    }
    
    // Validate JWT_SECRET is set and sufficiently strong
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET environment variable is required for authentication');
    } else if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters for security');
    }
    
    // Validate critical service URLs in production
    if (this.isProduction()) {
      if (this.CORS_ORIGIN === 'http://localhost:5173') {
        errors.push('CORS_ORIGIN must be set to production domain, not localhost');
      }
    }
    
    // Log warnings for missing optional configs
    if (!process.env.PROPERTY_SERVICE_URL) {
      this.logger?.warn?.('PROPERTY_SERVICE_URL not set, using default');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }
  }
  
  isDevelopment() {
    return this.NODE_ENV === 'development';
  }
  
  isProduction() {
    return this.NODE_ENV === 'production';
  }
}

export const config = new Config();
