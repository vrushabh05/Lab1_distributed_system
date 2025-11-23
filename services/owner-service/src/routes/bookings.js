import express from 'express';
import jwt from 'jsonwebtoken';
import Booking from '../models/Booking.js';
import { kafka } from '../server.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for owner-service bookings routes');
}

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

// Get bookings for owner's properties
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can view bookings' });
    }

    const bookings = await Booking.aggregate([
      { $match: { ownerId: req.user.id } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          travelerObjectId: { $toObjectId: "$travelerId" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "travelerObjectId",
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
            name: 1,
            email: 1,
            phone: 1,
            avatar_url: 1
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

// Accept booking - Publish status update to Kafka
router.put('/:id/accept', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can accept bookings' });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only accept pending bookings' });
    }

    booking.status = 'ACCEPTED';
    booking.updatedAt = new Date();
    await booking.save();

    // Publish status update to Kafka using shared KafkaManager
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
    res.json({ message: 'Booking accepted', booking });
  } catch (error) {
    console.error('Accept booking error:', error);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

// Reject/Cancel booking - Publish status update to Kafka
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can cancel bookings' });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel completed bookings' });
    }

    booking.status = 'CANCELLED';
    booking.updatedAt = new Date();
    await booking.save();

    // Publish status update to Kafka using shared KafkaManager
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
    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
