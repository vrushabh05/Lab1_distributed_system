/**
 * Shared Core: Error Classes
 * Custom error hierarchy for microservices
 */

/**
 * Base application error
 */
export class ApplicationError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ApplicationError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends ApplicationError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ApplicationError {
  constructor(resource, identifier, details = {}) {
    super(
      `${resource} not found: ${identifier}`,
      404,
      'NOT_FOUND',
      { resource, identifier, ...details }
    );
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends ApplicationError {
  constructor(message, details = {}) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends ApplicationError {
  constructor(message, details = {}) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends ApplicationError {
  constructor(service, message, details = {}) {
    super(
      `External service error: ${service} - ${message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service, ...details }
    );
  }
}

/**
 * Service unavailable (503)
 */
export class ServiceUnavailableError extends ApplicationError {
  constructor(message = 'Service temporarily unavailable', details = {}) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}
