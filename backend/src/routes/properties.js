import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Create property (Owner)
router.post('/', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  const pool = req.pool;
  try {
    const { title, type, description, address, city, state, country, price_per_night, bedrooms, bathrooms, max_guests, amenities, photos } = req.body;
    if (!title || !type || !city || !country || !price_per_night) throw { status: 400, message: 'Missing required fields' };

    const [result] = await pool.query(
      `INSERT INTO properties (owner_id, title, type, description, address, city, state, country, price_per_night, bedrooms, bathrooms, max_guests, amenities, photos)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.session.user.id, title, type, description || '', address || '', city, state || '', country, price_per_night, bedrooms || 1, bathrooms || 1, max_guests || 1, JSON.stringify(amenities || []), JSON.stringify(photos || [])]
    );
    res.json({ id: result.insertId });
  } catch (e) { next(e); }
});

// Owner list properties
router.get('/mine', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  const pool = req.pool;
  try {
    const [rows] = await pool.query('SELECT * FROM properties WHERE owner_id = ?', [req.session.user.id]);
    res.json({ properties: rows });
  } catch (e) { next(e); }
});

// Get property by id
router.get('/:id', async (req, res, next) => {
  const pool = req.pool;
  try {
    const [rows] = await pool.query('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ property: rows[0] });
  } catch (e) { next(e); }
});

// Update property (Owner)
router.put('/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  const pool = req.pool;
  try {
    const [own] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [req.params.id]);
    if (!own.length) return res.status(404).json({ error: 'Not found' });
    if (own[0].owner_id !== req.session.user.id) return res.status(403).json({ error: 'Forbidden' });

    const fields = ['title','type','description','address','city','state','country','price_per_night','bedrooms','bathrooms','max_guests'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f}=?`); values.push(req.body[f]); }
    }
    if (req.body.amenities !== undefined) { updates.push('amenities=?'); values.push(JSON.stringify(req.body.amenities)); }
    if (req.body.photos !== undefined) { updates.push('photos=?'); values.push(JSON.stringify(req.body.photos)); }

    if (!updates.length) return res.json({ ok: true });
    values.push(req.params.id);
    await pool.query(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
