import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { kafka } from '../server.js';
import { createAuthMiddleware } from '../../../shared/core/index.js';

const router = express.Router();
const requireOwner = createAuthMiddleware({ roles: ['OWNER'] });

// Get bookings for owner's properties
router.get('/', requireOwner, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can view bookings' });
    }

    const ownerObjectId = mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : req.user.id;

    const bookings = await Booking.aggregate([
      { $match: { ownerId: ownerObjectId } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "travelerId",
          foreignField: "_id",
          as: "traveler"
        }
      },
      { $unwind: { path: "$traveler", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          travelerId: 1,
          propertyId: 1,
          ownerId: 1,
          startDate: 1,
          endDate: 1,
          totalPrice: 1,
          pricePerNight: 1,
          guests: 1,
          title: 1,
          city: 1,
          state: 1,
          country: 1,
          comments: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          traveler: {
            name: '$traveler.name',
            email: '$traveler.email',
            phone: '$traveler.phone',
            avatar: '$traveler.avatar',
            avatar_url: {
              $ifNull: ['$traveler.avatar', '$traveler.avatar_url']
            }
          }
        }
      }
    ]);

    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Accept booking - Publish status update to Kafka with compensating transaction
router.put('/:id/accept', requireOwner, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can accept bookings' });
    }

    const bookingId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id)
      : req.params.id;
    const ownerObjectId = mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : req.user.id;

    const booking = await Booking.findOne({
      _id: bookingId,
      ownerId: ownerObjectId,
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only accept pending bookings' });
    }

    // Store original status for rollback
    const originalStatus = booking.status;
    
    booking.status = 'ACCEPTED';
    booking.updatedAt = new Date();
    await booking.save();

    // COMPENSATING TRANSACTION: Publish to Kafka with rollback on failure
    try {
      await kafka.sendMessage(
        'booking-updates',
        {
          bookingId: booking._id,
          status: 'ACCEPTED',
          updatedBy: 'OWNER',
          timestamp: new Date().toISOString(),
        },
        booking._id.toString()
      );
      console.log(`📤 Booking ACCEPTED published to Kafka: ${booking._id}`);
    } catch (kafkaError) {
      console.error(`❌ CRITICAL: Kafka publish failed for acceptance ${booking._id}`, kafkaError);
      
      // ROLLBACK: Restore original status
      booking.status = originalStatus;
      await booking.save();
      console.log(`🔄 Compensating transaction: Rolled back acceptance for ${booking._id}`);
      
      return res.status(503).json({ 
        error: 'Acceptance service temporarily unavailable. Please try again.',
        code: 'KAFKA_UNAVAILABLE'
      });
    }

    res.json({ message: 'Booking accepted', booking });
  } catch (error) {
    console.error('Accept booking error:', error);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

// Reject/Cancel booking - Publish status update to Kafka with compensating transaction
router.put('/:id/cancel', requireOwner, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can cancel bookings' });
    }

    const bookingId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id)
      : req.params.id;
    const ownerObjectId = mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : req.user.id;

    const booking = await Booking.findOne({
      _id: bookingId,
      ownerId: ownerObjectId,
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel completed bookings' });
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
          updatedBy: 'OWNER',
          timestamp: new Date().toISOString(),
        },
        booking._id.toString()
      );
      console.log(`📤 Booking CANCELLED published to Kafka: ${booking._id}`);
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
