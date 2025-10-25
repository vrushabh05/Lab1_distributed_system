import { Router } from 'express';

const router = Router();

// Search available properties by city/location, date range, guests
router.get('/', async (req, res, next) => {
  const pool = req.pool;
  try {
    const { location, start, end, guests } = req.query;
    if (!location) throw { status: 400, message: 'location required' };

    // Simple search by city or country match
    let base = `SELECT p.* FROM properties p WHERE (p.city LIKE ? OR p.country LIKE ?)`;
    const params = [`%${location}%`, `%${location}%`];

    if (guests) {
      base += ' AND p.max_guests >= ?';
      params.push(parseInt(guests));
    }

    // Exclude properties with ACCEPTED bookings that overlap requested dates
    if (start && end) {
      base += ` AND p.id NOT IN (
        SELECT b.property_id FROM bookings b
        WHERE b.status = 'ACCEPTED'
          AND NOT (b.end_date <= ? OR b.start_date >= ?)
      )`;
      params.push(start, end);
    }

    const [rows] = await pool.query(base, params);
    res.json({ results: rows });
  } catch (e) { next(e); }
});

export default router;
