import express from 'express';
import axios from 'axios';
import { kafka } from '../server.js';
import { mongoose } from '../../../shared/core/database.js';
import Booking from '../models/Booking.js';
import { validateBody, bookingSchemas, sanitizeRequest } from '../../../shared/validation/schemas.js';
import { createAuthMiddleware } from '../../../shared/core/index.js';

const router = express.Router();
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL || 'http://property-service:3003';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004';
const BOOKING_API_KEY = process.env.BOOKING_SERVICE_API_KEY || '';
const TRANSACTIONS_DISABLED = process.env.MONGO_TRANSACTIONS_DISABLED === 'true';

const requireTraveler = createAuthMiddleware({ roles: ['TRAVELER'] });

// Helper: attach property metadata (including photos) to each booking so the
// frontend can render real images instead of the placeholder. We fetch each
// unique property once per request to avoid N+1 overhead.
const attachPropertyDetails = async (bookings = [], logger) => {
  const uniquePropertyIds = Array.from(
    new Set(
      bookings
        .map((b) => b.propertyId?.toString())
        .filter(Boolean)
    )
  );

  if (!uniquePropertyIds.length) return bookings;

  const propertyMap = {};

  await Promise.all(
    uniquePropertyIds.map(async (id) => {
      try {
        const resp = await axios.get(`${PROPERTY_SERVICE_URL}/api/properties/${id}`);
        const property = resp.data?.property;
        if (property) {
          propertyMap[id] = {
            _id: property._id || property.id || id,
            title: property.title,
            city: property.city,
            state: property.state,
            country: property.country,
            photos: property.photos || []
          };
        }
      } catch (err) {
        logger?.warn('Property lookup failed for booking hydration', {
          propertyId: id,
          message: err?.message
        });
      }
    })
  );

  return bookings.map((b) => {
    const propertyId = b.propertyId?.toString();
    const property = propertyMap[propertyId];
    if (property) {
      b.property = property;
    }
    return b;
  });
};

// Get bookings for traveler with pagination
router.get('/', requireTraveler, sanitizeRequest, async (req, res) => {
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

    await attachPropertyDetails(bookings, req.logger);

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
router.get('/mine', requireTraveler, sanitizeRequest, async (req, res) => {
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

    await attachPropertyDetails(bookings, req.logger);

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
router.post('/', requireTraveler, sanitizeRequest, validateBody(bookingSchemas.create), async (req, res) => {
  const useTransactions = !TRANSACTIONS_DISABLED;
  const session = useTransactions ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  let transactionFinalized = false;
  const finalizeTransaction = async (shouldCommit) => {
    if (!session || transactionFinalized) return;
    transactionFinalized = true;
    try {
      if (shouldCommit) {
        await session.commitTransaction();
      } else {
        await session.abortTransaction();
      }
    } catch (txError) {
      console.error('Mongo transaction finalize error:', txError);
    } finally {
      session.endSession();
    }
  };

  const respondWithError = async (status, payload) => {
    await finalizeTransaction(false);
    res.status(status).json(payload);
    return null;
  };

  const applySession = (query) => (session ? query.session(session) : query);

  try {
    if (req.user.role !== 'TRAVELER') {
      return respondWithError(403, { error: 'Only travelers can create bookings' });
    }

    const { propertyId, startDate, endDate, guests } = req.validatedBody;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return respondWithError(400, { error: 'Invalid date format' });
    }

    if (start < today) {
      return respondWithError(400, { error: 'Cannot book dates in the past' });
    }

    if (start >= end) {
      return respondWithError(400, { error: 'End date must be after start date' });
    }

    // Fetch property details to validate owner & pricing
    let property;
    try {
      const propertyResp = await axios.get(`${PROPERTY_SERVICE_URL}/api/properties/${propertyId}`);
      property = propertyResp.data?.property;
    } catch (err) {
      console.error('Property lookup failed', err?.message || err);
      return respondWithError(400, { error: 'Unable to verify property details' });
    }

    if (!property) {
      return respondWithError(404, { error: 'Property not found' });
    }

    const nightlyRate = Number(property.pricePerNight ?? property.price_per_night);
    if (!Number.isFinite(nightlyRate) || nightlyRate <= 0) {
      return respondWithError(400, { error: 'Property is missing a nightly rate' });
    }

    const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const computedTotal = nightlyRate * nights;
    const guestsCount = Math.max(1, Number(guests) || 1);

    if (!property.ownerId) {
      return respondWithError(400, { error: 'Property owner is not configured' });
    }

    // Validate guest count against property max
    const maxGuests = property.maxGuests || property.max_guests || 1;
    if (guestsCount > maxGuests) {
      return respondWithError(400, {
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
      return respondWithError(503, { error: 'Unable to verify availability. Please try again.' });
    }

    if (!availabilityCheck.data.available) {
      return respondWithError(409, {
        error: 'Property is not available for the selected dates.',
        details: availabilityCheck.data.message,
        conflicts: availabilityCheck.data.conflicts
      });
    }

    // RACE CONDITION PREVENTION: Check availability with pessimistic read in transaction
    // Use countDocuments for better performance than find() when we only need count
    const conflictCount = await applySession(Booking.countDocuments({
      propertyId,
      status: { $in: ['PENDING', 'ACCEPTED'] },
      $or: [
        { startDate: { $gte: start, $lt: end } },
        { endDate: { $gt: start, $lte: end } },
        { startDate: { $lte: start }, endDate: { $gte: end } }
      ]
    }));

    if (conflictCount > 0) {
      // Fetch details for error response
      const overlappingQuery = Booking.find({
        propertyId,
        status: { $in: ['PENDING', 'ACCEPTED'] },
        $or: [
          { startDate: { $gte: start, $lt: end } },
          { endDate: { $gt: start, $lte: end } },
          { startDate: { $lte: start }, endDate: { $gte: end } }
        ]
      }).limit(5).select('_id startDate endDate');
      const overlappingBookings = session ? overlappingQuery.session(session) : overlappingQuery;

      return respondWithError(409, {
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

    await booking.save(session ? { session } : {});

    await finalizeTransaction(true);

    // COMPENSATING TRANSACTION: Publish to Kafka with rollback on failure
    let kafkaPublished = false;
    try {
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
      kafkaPublished = true;
      console.log(`📤 Booking request published to Kafka: ${booking._id}`);
    } catch (kafkaError) {
      console.error(`❌ CRITICAL: Kafka publish failed for booking ${booking._id}`, kafkaError);
      
      // COMPENSATING TRANSACTION: Rollback by deleting the orphaned booking
      try {
        await Booking.findByIdAndDelete(booking._id);
        console.log(`🔄 Compensating transaction: Deleted orphaned booking ${booking._id}`);
      } catch (deleteError) {
        console.error(`❌ FATAL: Failed to delete orphaned booking ${booking._id}`, deleteError);
        // Log to monitoring system - this is a critical data consistency issue
      }
      
      // Return error to client - booking was NOT created
      return res.status(503).json({ 
        error: 'Booking service temporarily unavailable. Please try again.',
        details: 'Unable to process booking request at this time.',
        code: 'KAFKA_UNAVAILABLE'
      });
    }

    // Only respond with success if both DB and Kafka succeeded
    res.json({
      message: 'Booking created successfully',
      booking,
    });
  } catch (error) {
    await finalizeTransaction(false);
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Cancel booking with compensating transaction
router.put('/:id/cancel', requireTraveler, sanitizeRequest, async (req, res) => {
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

    // Store original status for rollback
    const originalStatus = booking.status;
    
    booking.status = 'CANCELLED';
    booking.updatedAt = new Date();
    await booking.save();

    // COMPENSATING TRANSACTION: Publish to Kafka with rollback on failure
    try {
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
      console.log(`📤 Booking cancellation published to Kafka: ${booking._id}`);
    } catch (kafkaError) {
      console.error(`❌ CRITICAL: Kafka publish failed for cancellation ${booking._id}`, kafkaError);
      
      // ROLLBACK: Restore original status
      booking.status = originalStatus;
      await booking.save();
      console.log(`🔄 Compensating transaction: Rolled back cancellation for ${booking._id}`);
      
      return res.status(503).json({ 
        error: 'Cancellation service temporarily unavailable. Please try again.',
        code: 'KAFKA_UNAVAILABLE'
      });
    }

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
