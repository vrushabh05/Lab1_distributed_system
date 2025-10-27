import { Router } from 'express';

const router = Router();

<<<<<<< HEAD
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
=======
// Flexible search: accepts either
//  - location=&start=&end=&guests=
//  - city=&startDate=&endDate=&guests=
router.get('/', async (req, res, next) => {
  const pool = req.pool;
  try {
    const location = (req.query.location || req.query.city || '').trim();
    const start = (req.query.start || req.query.startDate || '').trim();
    const end = (req.query.end || req.query.endDate || '').trim();
    const guests = req.query.guests ? parseInt(req.query.guests, 10) : undefined;

    if (!location) throw { status: 400, message: 'location required' };
    if ((start && !end) || (!start && end)) throw { status: 400, message: 'both start and end required if one provided' };

    const needle = `%${location}%`;

    let sql = `
      SELECT p.*
      FROM properties p
      WHERE LOWER(CONCAT_WS(' ', COALESCE(p.address,''), COALESCE(p.city,''), COALESCE(p.state,''), COALESCE(p.country,'')))
            LIKE LOWER(?)
    `;
    const params = [needle];

    if (guests) {
      sql += ` AND (p.max_guests IS NULL OR p.max_guests >= ?)`;
      params.push(guests);
    }

    if (start && end) {
      sql += `
        AND p.id NOT IN (
          SELECT b.property_id
          FROM bookings b
          WHERE b.status = 'ACCEPTED'
            AND NOT (b.end_date <= ? OR b.start_date >= ?)
        )
      `;
      params.push(start, end);
    }

    sql += `
      ORDER BY
        (LOWER(p.city) LIKE LOWER(?)) DESC,
        p.price_per_night ASC,
        p.id ASC
    `;
    params.push(needle);

    const [rows] = await pool.query(sql, params);
    res.json({ properties: rows });
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
  } catch (e) { next(e); }
});

export default router;
