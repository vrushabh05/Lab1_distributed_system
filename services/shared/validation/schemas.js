/**
 * Shared Validation Schemas
 * Input validation using Joi for all microservices
 */

import Joi from 'joi';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const authSchemas = {
  signup: Joi.object({
    name: Joi.string().min(2).max(100).required()
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
      }),
    role: Joi.string().valid('TRAVELER', 'OWNER').required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    bio: Joi.string().max(500).optional(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).max(20).optional()
  })
};

// ============================================================================
// BOOKING SCHEMAS
// ============================================================================

export const bookingSchemas = {
  create: Joi.object({
    propertyId: Joi.string().required()
      .messages({
        'any.required': 'Property ID is required'
      }),
    startDate: Joi.date().iso().min('now').required()
      .messages({
        'date.min': 'Check-in date must be today or later'
      }),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
      .messages({
        'date.greater': 'Check-out date must be after check-in date'
      }),
    guests: Joi.number().integer().min(1).max(20).required()
      .messages({
        'number.min': 'At least 1 guest is required',
        'number.max': 'Maximum 20 guests allowed'
      }),
    totalPrice: Joi.number().min(0).optional(),
    ownerId: Joi.string().optional()
  }),

  updateStatus: Joi.object({
    status: Joi.string()
      .valid('PENDING', 'ACCEPTED', 'CANCELLED', 'COMPLETED')
      .required()
  }),

  checkAvailability: Joi.object({
    propertyId: Joi.string().required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
  })
};

// ============================================================================
// PROPERTY SCHEMAS
// ============================================================================

export const propertySchemas = {
  create: Joi.object({
    title: Joi.string().min(5).max(200).required(),
    type: Joi.string()
      .valid('House', 'Apartment', 'Villa', 'Condo', 'Cabin', 'Other')
      .required(),
    description: Joi.string().min(3).max(2000).required(),
    address: Joi.string().max(200).optional(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).required(),
    pricePerNight: Joi.number().min(1).max(100000).required(),
    bedrooms: Joi.number().integer().min(0).max(50).default(1),
    bathrooms: Joi.number().integer().min(0).max(50).default(1),
    maxGuests: Joi.number().integer().min(1).max(50).optional().default(1),
    amenities: Joi.array().items(Joi.string().max(100)).max(50).optional(),
    photos: Joi.array().items(Joi.string().uri()).max(20).optional()
  }),

  update: Joi.object({
    title: Joi.string().min(5).max(200).optional(),
    type: Joi.string()
      .valid('House', 'Apartment', 'Villa', 'Condo', 'Cabin', 'Other')
      .optional(),
    description: Joi.string().min(20).max(2000).optional(),
    address: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
    pricePerNight: Joi.number().min(1).max(100000).optional(),
    bedrooms: Joi.number().integer().min(0).max(50).optional(),
    bathrooms: Joi.number().integer().min(0).max(50).optional(),
    maxGuests: Joi.number().integer().min(1).max(50).optional(),
    amenities: Joi.array().items(Joi.string().max(100)).max(50).optional(),
    photos: Joi.array().items(Joi.string().uri()).max(20).optional()
  })
};

// ============================================================================
// REVIEW SCHEMAS
// ============================================================================

export const reviewSchemas = {
  create: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().min(3).max(2000).allow(''),
    bookingId: Joi.string().required()
  })
};

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const searchSchemas = {
  properties: Joi.object({
    city: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional(),
    guests: Joi.number().integer().min(1).max(20).optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(Joi.ref('minPrice')).max(100000).optional(),
    type: Joi.string().valid('House', 'Apartment', 'Villa', 'Condo', 'Cabin', 'Other').optional(),
    types: Joi.string().optional(), // Comma-separated list
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Creates validation middleware for request body
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors
        }
      });
    }

    req.validatedBody = value;
    next();
  };
};

/**
 * Creates validation middleware for query parameters
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors
        }
      });
    }

    req.validatedQuery = value;
    next();
  };
};

/**
 * Sanitize string to prevent NoSQL injection
 * Removes MongoDB operators like $ne, $gt, etc.
 */
export const sanitizeInput = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    // Remove keys starting with $
    if (key.startsWith('$')) {
      continue;
    }

    const value = obj[key];
    
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * NoSQL injection protection middleware
 */
export const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
};
