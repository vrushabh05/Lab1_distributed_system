import express from 'express';
import axios from 'axios';
import Property from '../models/Property.js';
import { searchSchemas, validateQuery } from '../../../shared/validation/schemas.js';
import { cache } from '../server.js';

const router = express.Router();

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004';
const BOOKING_SERVICE_API_KEY = process.env.BOOKING_SERVICE_API_KEY || '';

// Generate cache key from query parameters including pagination
function generateCacheKey(query) {
  const { city, country, minPrice, maxPrice, guests, q, page, limit, startDate, endDate, types } = query;
  const params = [
    city || '',
    country || '',
    minPrice || '',
    maxPrice || '',
    guests || '',
    q || '',
    startDate || '',
    endDate || '',
    types || '',
    page || '1',
    limit || '50'
  ].join(':');
  return `search:${params}`;
}

// Search properties with caching and pagination
// Sanitize regex input to prevent ReDoS attacks
const sanitizeRegexInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  // Remove regex special characters and limit length
  return input.replace(/[.*+?^${}()|[\]\\]/g, '').slice(0, 100);
};

const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

const checkPropertyAvailability = async (propertyId, startDate, endDate, logger) => {
  if (!BOOKING_SERVICE_API_KEY) {
    logger?.warn('Booking service API key not configured. Skipping availability filter.');
    return true;
  }

  try {
    const response = await axios.post(
      `${BOOKING_SERVICE_URL}/api/bookings/availability`,
      {
        propertyId,
        startDate,
        endDate
      },
      {
        headers: { 'x-api-key': BOOKING_SERVICE_API_KEY },
        timeout: 5000
      }
    );
    return response.data?.available !== false;
  } catch (error) {
    logger?.error('Availability check failed', {
      propertyId,
      message: error.message,
    });
    // Fail-open: if availability service fails, do not hide the property
    return true;
  }
};

router.get('/', async (req, res) => {
  try {
    const { city, location, startDate, endDate, guests, minPrice, maxPrice, types, q } = req.query;
    
    // Use location parameter if city is not provided (for URL-based searches)
    const searchLocation = city || location;
    
    // Sanitize search inputs
    const sanitizedCity = sanitizeRegexInput(searchLocation);
    
    // Pagination parameters with defaults
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    
    let parsedStart = null;
    let parsedEnd = null;

    if (startDate || endDate) {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Both startDate and endDate are required for date filtering' });
      }

      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({ error: 'Invalid date format for startDate or endDate' });
      }

      parsedStart = new Date(startDate);
      parsedEnd = new Date(endDate);

      if (parsedEnd <= parsedStart) {
        return res.status(400).json({ error: 'endDate must be after startDate' });
      }
    }
    
    // Try to get from cache first
    const cacheKey = generateCacheKey(req.query);
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      req.logger?.debug('Cache hit for search', { cacheKey });
      return res.json(cached);
    }
    
    let query = {};

    // Location filters with sanitization
    if (sanitizedCity) {
      query.$or = [
        { city: new RegExp(sanitizedCity, 'i') },
        { state: new RegExp(sanitizedCity, 'i') },
        { country: new RegExp(sanitizedCity, 'i') }
      ];
    }

    // Price range
    if (minPrice || maxPrice) {
      query.pricePerNight = {};
      if (minPrice) query.pricePerNight.$gte = Number(minPrice);
      if (maxPrice) query.pricePerNight.$lte = Number(maxPrice);
    }

    // Guest capacity
    if (guests) {
      query.maxGuests = { $gte: Number(guests) };
    }

    // Property types (comma-separated)
    if (types) {
      const typeList = types
        .split(',')
        .map(type => type.trim())
        .filter(Boolean);
      if (typeList.length) {
        query.type = { $in: typeList };
      }
    }

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Get total count for pagination metadata
    const totalCount = await Property.countDocuments(query);
    
    // Get paginated results
    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    let availableProperties = properties;

    if (parsedStart && parsedEnd) {
      const availabilityChecks = await Promise.all(
        properties.map((property) =>
          checkPropertyAvailability(
            property._id.toString(),
            parsedStart.toISOString(),
            parsedEnd.toISOString(),
            req.logger
          )
        )
      );

      availableProperties = properties.filter((_, idx) => availabilityChecks[idx]);
    }

    const totalPages = Math.ceil(totalCount / limit);
    
    const result = {
      properties: availableProperties,
      pagination: {
        page,
        limit,
        totalCount: parsedStart && parsedEnd ? availableProperties.length : totalCount,
        totalPages: parsedStart && parsedEnd ? 1 : totalPages,
        hasNextPage: parsedStart && parsedEnd ? false : page < totalPages,
        hasPrevPage: parsedStart && parsedEnd ? false : page > 1
      }
    };
    
    // Cache the result for 5 minutes
    await cache.set(cacheKey, result, 300);
    req.logger?.debug('Cached search result', { cacheKey, page, limit });

    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;

