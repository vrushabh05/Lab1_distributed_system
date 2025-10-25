import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/traveler', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const userId = req.session.user.id;
    const [pending] = await pool.query(`SELECT COUNT(*) c FROM bookings WHERE traveler_id=? AND status='PENDING'`, [userId]);
    const [accepted] = await pool.query(`SELECT COUNT(*) c FROM bookings WHERE traveler_id=? AND status='ACCEPTED'`, [userId]);
    const [cancelled] = await pool.query(`SELECT COUNT(*) c FROM bookings WHERE traveler_id=? AND status='CANCELLED'`, [userId]);
    res.json({ pending: pending[0].c, accepted: accepted[0].c, cancelled: cancelled[0].c });
  } catch (e) { next(e); }
});

router.get('/owner', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const userId = req.session.user.id;
    // ensure owner
    const [u] = await pool.query('SELECT role FROM users WHERE id=?', [userId]);
    if (!u.length || u[0].role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' });

    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN b.status='PENDING' THEN 1 ELSE 0 END) pending,
         SUM(CASE WHEN b.status='ACCEPTED' THEN 1 ELSE 0 END) accepted,
         SUM(CASE WHEN b.status='CANCELLED' THEN 1 ELSE 0 END) cancelled
       FROM bookings b JOIN properties p ON p.id=b.property_id WHERE p.owner_id=?`, [userId]);
    const stats = rows[0] || { pending: 0, accepted: 0, cancelled: 0 };
    res.json(stats);
  } catch (e) { next(e); }
});

export default router;
