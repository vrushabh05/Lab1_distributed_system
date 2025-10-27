import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function nightsBetween(start, end) {
  const sd = new Date(start);
  const ed = new Date(end);
<<<<<<< HEAD
  return Math.max(1, Math.ceil((ed - sd) / (1000*60*60*24)));
}

// Traveler creates booking
=======
  const ms = ed - sd;
  if (isNaN(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Traveler creates booking (PENDING)
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
router.post('/', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const { property_id, start_date, end_date, guests } = req.body;
    if (!property_id || !start_date || !end_date || !guests) throw { status: 400, message: 'Missing fields' };

<<<<<<< HEAD
    // Calculate price
    const [pRows] = await pool.query('SELECT price_per_night FROM properties WHERE id = ?', [property_id]);
    if (!pRows.length) throw { status: 404, message: 'Property not found' };
    const nights = nightsBetween(start_date, end_date);
    const total = Number(pRows[0].price_per_night) * nights;
=======
    // validate dates
    const nights = nightsBetween(start_date, end_date);
    if (nights <= 0) throw { status: 400, message: 'Invalid date range' };

    // property info + guard: traveler cannot book their own listing
    const [pRows] = await pool.query(
      'SELECT id, owner_id, price_per_night, max_guests FROM properties WHERE id = ?',
      [property_id]
    );
    if (!pRows.length) throw { status: 404, message: 'Property not found' };
    const prop = pRows[0];

    if (prop.owner_id === req.session.user.id) {
      throw { status: 400, message: 'Owners cannot book their own property' };
    }
    if (prop.max_guests && Number(guests) > Number(prop.max_guests)) {
      throw { status: 400, message: `Guests exceed max capacity (${prop.max_guests})` };
    }

    // ensure no accepted overlap already exists (defensive; search already filters)
    const [overlap] = await pool.query(
      `SELECT 1 FROM bookings
       WHERE property_id = ?
         AND status = 'ACCEPTED'
         AND NOT (end_date <= ? OR start_date >= ?)
       LIMIT 1`,
      [property_id, start_date, end_date]
    );
    if (overlap.length) throw { status: 409, message: 'Dates are unavailable' };

    const total = Number(prop.price_per_night) * nights;
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)

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
<<<<<<< HEAD
      `SELECT b.*, p.title, p.city, p.country FROM bookings b
=======
      `SELECT b.*, p.title, p.city, p.country
       FROM bookings b
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
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
<<<<<<< HEAD
    // verify owner
    const [u] = await pool.query('SELECT role FROM users WHERE id = ?', [req.session.user.id]);
    if (!u.length || u[0].role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' });

    const [rows] = await pool.query(
      `SELECT b.*, p.title FROM bookings b
=======
    const [u] = await pool.query('SELECT role FROM users WHERE id=?', [req.session.user.id]);
    if (!u.length || u[0].role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' });

    const [rows] = await pool.query(
      `SELECT b.*, p.title
       FROM bookings b
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
       JOIN properties p ON p.id = b.property_id
       WHERE p.owner_id = ?
       ORDER BY b.created_at DESC`,
      [req.session.user.id]
    );
    res.json({ bookings: rows });
  } catch (e) { next(e); }
});

<<<<<<< HEAD
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
=======
// Owner accepts booking (conflict-safe)
router.post('/:id/accept', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  const conn = await pool.getConnection();
  try {
    const bookingId = req.params.id;

    // lock & verify ownership + state
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT b.*, p.owner_id
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE b.id = ?
       FOR UPDATE`,
      [bookingId]
    );
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Not found' }); }
    const b = rows[0];
    if (b.owner_id !== req.session.user.id) { await conn.rollback(); return res.status(403).json({ error: 'Forbidden' }); }
    if (b.status !== 'PENDING') { await conn.rollback(); return res.status(400).json({ error: `Cannot accept from state ${b.status}` }); }

    // conflict check vs other ACCEPTED
    const [conflict] = await conn.query(
      `SELECT 1 FROM bookings
       WHERE property_id = ?
         AND status = 'ACCEPTED'
         AND NOT (end_date <= ? OR start_date >= ?)
         AND id <> ?
       LIMIT 1`,
      [b.property_id, b.start_date, b.end_date, b.id]
    );
    if (conflict.length) { await conn.rollback(); return res.status(409).json({ error: 'Dates already taken' }); }

    await conn.query(`UPDATE bookings SET status='ACCEPTED' WHERE id = ?`, [bookingId]);
    await conn.commit();
    res.json({ ok: true, status: 'ACCEPTED' });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    next(e);
  } finally {
    conn.release();
  }
});

// Owner or Traveler cancels
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const bookingId = req.params.id;
    const [rows] = await pool.query(
<<<<<<< HEAD
      `SELECT b.*, p.owner_id FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE b.id = ?`, [bookingId]);
=======
      `SELECT b.*, p.owner_id
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE b.id = ?`,
      [bookingId]
    );
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const b = rows[0];
    if (b.owner_id !== req.session.user.id && b.traveler_id !== req.session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
<<<<<<< HEAD
=======
    if (b.status === 'CANCELLED') return res.json({ ok: true, status: 'CANCELLED' });

>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    await pool.query(`UPDATE bookings SET status='CANCELLED' WHERE id = ?`, [bookingId]);
    res.json({ ok: true, status: 'CANCELLED' });
  } catch (e) { next(e); }
});

export default router;
