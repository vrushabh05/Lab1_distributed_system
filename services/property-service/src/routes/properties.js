import express from 'express';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import Property from '../models/Property.js';
import Review from '../models/Review.js';
import { propertySchemas, reviewSchemas, validateBody, sanitizeRequest } from '../../../shared/validation/schemas.js';
import { cache } from '../server.js';
import { createAuthMiddleware } from '../../../shared/core/index.js';

const router = express.Router();
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004';
const BOOKING_SERVICE_API_KEY = process.env.BOOKING_SERVICE_API_KEY || '';

const uploadsRoot = path.join(process.cwd(), 'uploads', 'properties');
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const propertyId = req.body.propertyId || req.params.id;
    if (!propertyId) {
      return cb(new Error('Property ID is required for uploads'));
    }
    const dir = path.join(uploadsRoot, propertyId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

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

const authMiddleware = createAuthMiddleware();

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

// Get property reviews (needs to be defined before /:id route)
router.get('/:id/reviews', sanitizeRequest, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).select('ratingAverage ratingCount');
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const reviews = await Review.find({ propertyId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      reviews,
      stats: {
        ratingAverage: property.ratingAverage,
        ratingCount: property.ratingCount
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
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

const ensureCompletedBooking = async (travelerId, propertyId, bookingId) => {
  if (!BOOKING_SERVICE_API_KEY) {
    throw new Error('Booking service API key not configured');
  }

  const response = await axios.get(`${BOOKING_SERVICE_URL}/api/bookings`, {
    params: { travelerId, status: 'COMPLETED', propertyId },
    headers: { 'x-api-key': BOOKING_SERVICE_API_KEY },
    timeout: 5000
  });

  const bookings = response.data?.bookings || [];
  if (!bookings.length) {
    return null;
  }

  if (bookingId) {
    return bookings.find((booking) => String(booking._id) === String(bookingId));
  }

  return bookings[0];
};

// Create property
router.post('/', authMiddleware, validateBody(propertySchemas.create), async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can create properties' });
    }

    const body = req.validatedBody || req.body;
    const { title, type, description, address, city, state, country, 
            pricePerNight, bedrooms, bathrooms, maxGuests, amenities, photos } = body;

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

// Upload property photos
router.post('/upload-image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can upload photos' });
    }

    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    const property = await Property.findOne({ _id: propertyId, ownerId: req.user.id });
    if (!property) {
      return res.status(404).json({ error: 'Property not found or unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (property.photos.length >= 20) {
      return res.status(400).json({ error: 'Maximum of 20 photos allowed per listing' });
    }

    const relativePath = `/uploads/properties/${propertyId}/${req.file.filename}`;
    property.photos.push(relativePath);
    property.updatedAt = new Date();
    await property.save();

    res.status(201).json({ message: 'Photo uploaded', photo: relativePath });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// Delete property photo
router.delete('/:id/photos', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can delete photos' });
    }

    const property = await Property.findOne({
      _id: req.params.id,
      ownerId: req.user.id
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found or unauthorized' });
    }

    const { photo } = req.body || {};
    if (!photo || typeof photo !== 'string') {
      return res.status(400).json({ error: 'Photo path is required' });
    }

    const photoIndex = property.photos.findIndex((p) => p === photo);
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found on this property' });
    }

    property.photos.splice(photoIndex, 1);
    property.updatedAt = new Date();
    await property.save();

    const normalizedPath = photo.startsWith('/') ? photo.slice(1) : photo;
    const absolutePath = path.join(process.cwd(), normalizedPath);
    fs.promises.unlink(absolutePath).catch(() => {});

    await cache.delPattern('search:*');

    res.json({ message: 'Photo removed', photo });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete image' });
  }
});


// Create property review
router.post('/:id/reviews', authMiddleware, sanitizeRequest, validateBody(reviewSchemas.create), async (req, res) => {
  try {
    if (req.user.role !== 'TRAVELER') {
      return res.status(403).json({ error: 'Only travelers can leave reviews' });
    }

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const { rating, comment, bookingId } = req.validatedBody || req.body;

    let booking;
    try {
      booking = await ensureCompletedBooking(req.user.id, property._id.toString(), bookingId);
    } catch (apiError) {
      console.error('Booking verification failed', apiError.message);
      return res.status(503).json({ error: 'Unable to verify booking status. Please try again later.' });
    }

    if (!booking) {
      return res.status(400).json({ error: 'You can only review stays you have completed' });
    }

    const existing = await Review.findOne({ bookingId });
    if (existing) {
      return res.status(409).json({ error: 'You already reviewed this stay' });
    }

    const review = new Review({
      propertyId: property._id.toString(),
      travelerId: req.user.id,
      bookingId,
      travelerName: req.user.email || 'Traveler',
      rating,
      comment,
      stayStart: booking.startDate,
      stayEnd: booking.endDate
    });

    await review.save();

    property.ratingCount = (property.ratingCount || 0) + 1;
    property.ratingTotal = (property.ratingTotal || 0) + rating;
    property.ratingAverage = Number((property.ratingTotal / property.ratingCount).toFixed(2));
    property.updatedAt = new Date();
    await property.save();

    await cache.delPattern('search:*');

    res.status(201).json({ message: 'Review submitted', review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
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
