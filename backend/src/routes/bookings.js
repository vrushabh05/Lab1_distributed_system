import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function nightsBetween(start, end) {
  const sd = new Date(start);
  const ed = new Date(end);
  return Math.max(1, Math.ceil((ed - sd) / (1000*60*60*24)));
}

// Traveler creates booking
router.post('/', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const { property_id, start_date, end_date, guests } = req.body;
    if (!property_id || !start_date || !end_date || !guests) throw { status: 400, message: 'Missing fields' };

    // Calculate price
    const [pRows] = await pool.query('SELECT price_per_night FROM properties WHERE id = ?', [property_id]);
    if (!pRows.length) throw { status: 404, message: 'Property not found' };
    const nights = nightsBetween(start_date, end_date);
    const total = Number(pRows[0].price_per_night) * nights;

    const [result] = await pool.query(
      `INSERT INTO bookings (property_id, traveler_id, start_date, end_date, guests, status, total_price)
       VALUES (?,?,?,?,?,'PENDING',?)`,
      [property_id, req.session.user.id, start_date, end_date, guests, total]
    );
    res.json({ id: result.insertId, total_price: total, status: 'PENDING' });
  } catch (e) { next(e); }
});

// Traveler list bookings
router.get('/mine', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const [rows] = await pool.query(
      `SELECT b.*, p.title, p.city, p.country FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE b.traveler_id = ?
       ORDER BY b.created_at DESC`,
      [req.session.user.id]
    );
    res.json({ bookings: rows });
  } catch (e) { next(e); }
});

// Owner list bookings for their properties
router.get('/owner', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    // verify owner
    const [u] = await pool.query('SELECT role FROM users WHERE id = ?', [req.session.user.id]);
    if (!u.length || u[0].role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' });

    const [rows] = await pool.query(
      `SELECT b.*, p.title FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE p.owner_id = ?
       ORDER BY b.created_at DESC`,
      [req.session.user.id]
    );
    res.json({ bookings: rows });
  } catch (e) { next(e); }
});

// Owner accepts booking
router.post('/:id/accept', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const bookingId = req.params.id;
    const [rows] = await pool.query(
      `SELECT b.*, p.owner_id FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE b.id = ?`, [bookingId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].owner_id !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

    await pool.query(`UPDATE bookings SET status='ACCEPTED' WHERE id = ?`, [bookingId]);
    res.json({ ok: true, status: 'ACCEPTED' });
  } catch (e) { next(e); }
});

// Owner or Traveler cancels booking
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const bookingId = req.params.id;
    const [rows] = await pool.query(
      `SELECT b.*, p.owner_id FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE b.id = ?`, [bookingId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const b = rows[0];
    if (b.owner_id !== req.session.user.id && b.traveler_id !== req.session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(`UPDATE bookings SET status='CANCELLED' WHERE id = ?`, [bookingId]);
    res.json({ ok: true, status: 'CANCELLED' });
  } catch (e) { next(e); }
});

export default router;
