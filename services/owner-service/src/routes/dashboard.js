import express from 'express';
import Booking from '../models/Booking.js';
import { createAuthMiddleware } from '../../../shared/core/index.js';

const router = express.Router();
const requireOwner = createAuthMiddleware({ roles: ['OWNER'] });

// Get owner dashboard statistics
router.get('/', requireOwner, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can view dashboard' });
    }

    const bookings = await Booking.find({ ownerId: req.user.id });
    
    const stats = {
      pending: bookings.filter(b => b.status === 'PENDING').length,
      accepted: bookings.filter(b => b.status === 'ACCEPTED').length,
      cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
      totalRevenue: bookings
        .filter(b => b.status === 'ACCEPTED')
        .reduce((sum, b) => sum + (b.totalPrice || 0), 0),
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

export default router;
