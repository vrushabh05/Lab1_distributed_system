import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { kafka } from '../server.js';
import { mongoose } from '../../shared/core/database.js';
import Booking from '../models/Booking.js';
import { validateBody, bookingSchemas, sanitizeRequest } from '../../shared/validation/schemas.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for traveler-service bookings routes');
}
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL || 'http://property-service:3003';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004';
const BOOKING_API_KEY = process.env.BOOKING_SERVICE_API_KEY || '';

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

// Get bookings for traveler with pagination
router.get('/', authMiddleware, sanitizeRequest, async (req, res) => {
  try {
    // Pagination parameters with defaults
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const query = { travelerId: req.user.id };

    // Get total count for pagination metadata
    const totalCount = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      bookings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Alias for /mine - same as / with pagination
router.get('/mine', authMiddleware, sanitizeRequest, async (req, res) => {
  try {
    // Pagination parameters with defaults
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const query = { travelerId: req.user.id };

    // Get total count for pagination metadata
    const totalCount = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      bookings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Create booking - Publish to Kafka with transaction to prevent race conditions
router.post('/', authMiddleware, sanitizeRequest, validateBody(bookingSchemas.create), async (req, res) => {
  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (req.user.role !== 'TRAVELER') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'Only travelers can create bookings' });
    }

    const { propertyId, startDate, endDate, guests } = req.validatedBody;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start < today) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Cannot book dates in the past' });
    }

    if (start >= end) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Fetch property details to validate owner & pricing
    let property;
    try {
      const propertyResp = await axios.get(`${PROPERTY_SERVICE_URL}/api/properties/${propertyId}`);
      property = propertyResp.data?.property;
    } catch (err) {
      console.error('Property lookup failed', err?.message || err);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Unable to verify property details' });
    }

    if (!property) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Property not found' });
    }

    const nightlyRate = Number(property.pricePerNight ?? property.price_per_night);
    if (!Number.isFinite(nightlyRate) || nightlyRate <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Property is missing a nightly rate' });
    }

    const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const computedTotal = nightlyRate * nights;
    const guestsCount = Math.max(1, Number(guests) || 1);

    if (!property.ownerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Property owner is not configured' });
    }

    // Validate guest count against property max
    const maxGuests = property.maxGuests || property.max_guests || 1;
    if (guestsCount > maxGuests) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: `Property maximum is ${maxGuests} guest${maxGuests > 1 ? 's' : ''}`
      });
    }

    // CRITICAL: Check availability via booking-service API (distributed check)
    let availabilityCheck;
    try {
      availabilityCheck = await axios.post(
        `${BOOKING_SERVICE_URL}/api/bookings/availability`,
        { propertyId, startDate, endDate },
        {
          headers: { 'x-api-key': BOOKING_API_KEY },
          timeout: 5000
        }
      );
    } catch (err) {
      console.error('Availability check failed', err?.message);
      await session.abortTransaction();
      session.endSession();
      return res.status(503).json({ error: 'Unable to verify availability. Please try again.' });
    }

    if (!availabilityCheck.data.available) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        error: 'Property is not available for the selected dates.',
        details: availabilityCheck.data.message,
        conflicts: availabilityCheck.data.conflicts
      });
    }

    // BACKUP: Also check local database within transaction
    const overlappingBookings = await Booking.find({
      propertyId,
      status: { $in: ['PENDING', 'ACCEPTED'] },
      $or: [
        { startDate: { $gte: start, $lt: end } },
        { endDate: { $gt: start, $lte: end } },
        { startDate: { $lte: start }, endDate: { $gte: end } }
      ]
    }).session(session);

    if (overlappingBookings.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        error: 'Property is not available for the selected dates.',
        details: 'Another booking exists for this time period.',
        conflicts: overlappingBookings.map(b => ({
          id: b._id,
          startDate: b.startDate,
          endDate: b.endDate
        }))
      });
    }

    // CREATE BOOKING WITHIN TRANSACTION
    const booking = new Booking({
      travelerId: req.user.id,
      propertyId,
      ownerId: property.ownerId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalPrice: computedTotal,
      pricePerNight: nightlyRate,
      guests: guestsCount,
      title: property.title,
      city: property.city,
      state: property.state,
      country: property.country,
      comments: req.body.comments,
      status: 'PENDING',
    });

    await booking.save();

    // Commit transaction before publishing to Kafka
    await session.commitTransaction();
    session.endSession();

    // Publish booking request to Kafka using shared KafkaManager
    await kafka.sendMessage(
      'booking-requests',
      {
        bookingId: booking._id,
        travelerId: req.user.id,
        propertyId,
        ownerId: property.ownerId,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPrice: computedTotal,
        pricePerNight: nightlyRate,
        guests: guestsCount,
        title: property.title,
        city: property.city,
        state: property.state,
        country: property.country,
        comments: req.body.comments,
        status: 'PENDING',
        timestamp: new Date().toISOString(),
      },
      booking._id.toString()
    );
    console.log(`📤 Booking request published to Kafka: ${booking._id}`);

    res.json({
      message: 'Booking created successfully',
      booking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Cancel booking
router.put('/:id/cancel', authMiddleware, sanitizeRequest, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      travelerId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel this booking' });
    }

    booking.status = 'CANCELLED';
    booking.updatedAt = new Date();
    await booking.save();

    // Publish cancellation to Kafka
    await kafka.sendMessage(
      'booking-updates',
      {
        bookingId: booking._id,
        status: 'CANCELLED',
        updatedBy: 'TRAVELER',
        timestamp: new Date().toISOString(),
      },
      booking._id.toString()
    );

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
