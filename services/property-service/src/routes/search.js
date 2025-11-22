import express from 'express';
import Property from '../models/Property.js';
import { searchSchemas, validateQuery } from '../../shared/validation/schemas.js';
import { cache } from '../server.js';

const router = express.Router();

// Generate cache key from query parameters including pagination
function generateCacheKey(query) {
  const { city, country, minPrice, maxPrice, guests, q, page, limit } = query;
  const params = [
    city || '',
    country || '',
    minPrice || '',
    maxPrice || '',
    guests || '',
    q || '',
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

    const totalPages = Math.ceil(totalCount / limit);
    
    const result = {
      properties,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
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

