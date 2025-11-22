/**
 * Shared Core: Structured Logging
 * Winston-based logger with correlation IDs and contextual information
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, errors, json, printf } = winston.format;

/**
 * Create custom format for console output
 */
const consoleFormat = printf(({ level, message, timestamp, correlationId, service, ...meta }) => {
  let log = `[${timestamp}] ${level.toUpperCase()} [${service || 'app'}]`;
  
  if (correlationId) {
    log += ` [${correlationId}]`;
  }
  
  log += `: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  return log;
});

/**
 * Logger class with correlation ID support
 */
export class Logger {
  constructor(serviceName, logLevel = 'info') {
    this.serviceName = serviceName;
    
    this.logger = winston.createLogger({
      level: logLevel,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        json()
      ),
      defaultMeta: { service: serviceName },
      transports: [
        new winston.transports.Console({
          format: combine(
            winston.format.colorize(),
            consoleFormat
          )
        })
      ],
    });
    
    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: json()
      }));
      
      this.logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        format: json()
      }));
    }
  }
  
  /**
   * Generate a unique correlation ID for request tracing
   */
  generateCorrelationId() {
    return uuidv4();
  }
  
  /**
   * Create child logger with correlation ID
   */
  child(correlationId) {
    return new ChildLogger(this.logger, correlationId);
  }
  
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }
  
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }
  
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }
  
  error(message, error = null, meta = {}) {
    if (error instanceof Error) {
      this.logger.error(message, {
        ...meta,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
    } else {
      this.logger.error(message, meta);
    }
  }
}

/**
 * Child logger with correlation ID
 */
class ChildLogger {
  constructor(parentLogger, correlationId) {
    this.logger = parentLogger;
    this.correlationId = correlationId;
  }
  
  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, correlationId: this.correlationId });
  }
  
  info(message, meta = {}) {
    this.logger.info(message, { ...meta, correlationId: this.correlationId });
  }
  
  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, correlationId: this.correlationId });
  }
  
  error(message, error = null, meta = {}) {
    if (error instanceof Error) {
      this.logger.error(message, {
        ...meta,
        correlationId: this.correlationId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
    } else {
      this.logger.error(message, { ...meta, correlationId: this.correlationId });
    }
  }
}

export const createLogger = (serviceName, logLevel) => {
  return new Logger(serviceName, logLevel);
};
