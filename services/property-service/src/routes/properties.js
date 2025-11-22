import express from 'express';
import jwt from 'jsonwebtoken';
import Property from '../models/Property.js';
import { propertySchemas, validateBody, sanitizeRequest } from '../../shared/validation/schemas.js';
import { cache } from '../server.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for property-service routes');
}

const clampArray = (value, limit) => {
  if (!value) return [];
  if (!Array.isArray(value)) {
    throw new Error('Value must be an array');
  }
  return value.slice(0, limit);
};

const parseNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all properties (public)
router.get('/', sanitizeRequest, async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    res.json({ properties });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get properties by owner
router.get('/owner/:ownerId', authMiddleware, sanitizeRequest, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER' || req.user.id !== req.params.ownerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const properties = await Property.find({ ownerId: req.params.ownerId })
      .sort({ createdAt: -1 });
    res.json({ properties });
  } catch (error) {
    console.error('Get owner properties error:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get single property (public)
router.get('/:id', sanitizeRequest, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ property });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// Create property
router.post('/', authMiddleware, validateBody(propertySchemas.create), async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can create properties' });
    }

    const { title, type, description, address, city, state, country, 
            pricePerNight, bedrooms, bathrooms, maxGuests, amenities, photos } = req.body;

    if (!title || !type || !description || !city || !country) {
      return res.status(400).json({ error: 'Title, type, description, city, and country are required' });
    }

    const nightlyRate = parseNumber(pricePerNight);
    if (!nightlyRate || nightlyRate <= 0) {
      return res.status(400).json({ error: 'Price per night must be a positive number' });
    }

    let normalizedAmenities = [];
    let normalizedPhotos = [];
    try {
      normalizedAmenities = clampArray(amenities, 50);
      normalizedPhotos = clampArray(photos, 20);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const property = new Property({
      title: title.trim(),
      type: type.trim(),
      description: description.trim(),
      address,
      city: city.trim(),
      state,
      country: country.trim(),
      pricePerNight: nightlyRate,
      bedrooms: parseNumber(bedrooms, 1),
      bathrooms: parseNumber(bathrooms, 1),
      maxGuests: parseNumber(maxGuests, 1),
      amenities: normalizedAmenities,
      photos: normalizedPhotos,
      ownerId: req.user.id,
    });

    await property.save();
    
    // Invalidate search cache
    await cache.delPattern('search:*');
    
    res.status(201).json({ message: 'Property created successfully', property });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// Update property
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can update properties' });
    }

    const property = await Property.findOne({ 
      _id: req.params.id, 
      ownerId: req.user.id 
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found or unauthorized' });
    }

    const updates = {};

    const assignString = (key) => {
      if (typeof req.body[key] === 'string') {
        updates[key] = req.body[key].trim();
      }
    };

    ['title', 'type', 'description', 'address', 'city', 'state', 'country'].forEach(assignString);

    if (req.body.pricePerNight !== undefined) {
      const nightlyRate = parseNumber(req.body.pricePerNight);
      if (!nightlyRate || nightlyRate <= 0) {
        return res.status(400).json({ error: 'Price per night must be a positive number' });
      }
      updates.pricePerNight = nightlyRate;
    }

    if (req.body.bedrooms !== undefined) {
      updates.bedrooms = parseNumber(req.body.bedrooms, property.bedrooms);
    }
    if (req.body.bathrooms !== undefined) {
      updates.bathrooms = parseNumber(req.body.bathrooms, property.bathrooms);
    }
    if (req.body.maxGuests !== undefined) {
      updates.maxGuests = parseNumber(req.body.maxGuests, property.maxGuests);
    }

    if (req.body.amenities !== undefined) {
      try {
        updates.amenities = clampArray(req.body.amenities, 50);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (req.body.photos !== undefined) {
      try {
        updates.photos = clampArray(req.body.photos, 20);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    Object.assign(property, updates);
    property.updatedAt = new Date();
    await property.save();

    // Invalidate search cache
    await cache.delPattern('search:*');

    res.json({ message: 'Property updated successfully', property });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// Delete property
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can delete properties' });
    }

    const result = await Property.deleteOne({ 
      _id: req.params.id, 
      ownerId: req.user.id 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Property not found or unauthorized' });
    }

    // Invalidate search cache
    await cache.delPattern('search:*');

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

export default router;
