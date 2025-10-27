import { Router } from 'express';
<<<<<<< HEAD
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/:propertyId', requireAuth, requireRole('TRAVELER'), async (req, res, next) => {
  const pool = req.pool;
  try {
    await pool.query('INSERT IGNORE INTO favorites (traveler_id, property_id) VALUES (?,?)', [req.session.user.id, req.params.propertyId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:propertyId', requireAuth, requireRole('TRAVELER'), async (req, res, next) => {
  const pool = req.pool;
  try {
    await pool.query('DELETE FROM favorites WHERE traveler_id = ? AND property_id = ?', [req.session.user.id, req.params.propertyId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/mine', requireAuth, requireRole('TRAVELER'), async (req, res, next) => {
  const pool = req.pool;
  try {
    const [rows] = await pool.query(
      `SELECT p.* FROM favorites f
       JOIN properties p ON p.id = f.property_id
       WHERE f.traveler_id = ?`, [req.session.user.id]);
=======
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Reusable query for listing favorites for the current traveler
async function listFavorites(pool, travelerId) {
  const [rows] = await pool.query(
    `SELECT p.*
     FROM properties p
     JOIN favorites f ON f.property_id = p.id
     WHERE f.traveler_id = ?`,
    [travelerId]
  );
  return rows;
}

// GET /api/favorites  (FE expects this path)
router.get('/', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const rows = await listFavorites(pool, req.session.user.id);
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    res.json({ favorites: rows });
  } catch (e) { next(e); }
});

<<<<<<< HEAD
=======
// (Optional alias) GET /api/favorites/mine
router.get('/mine', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const rows = await listFavorites(pool, req.session.user.id);
    res.json({ favorites: rows });
  } catch (e) { next(e); }
});

// POST /api/favorites/:propertyId  → add favorite
router.post('/:propertyId', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const { propertyId } = req.params;
    const userId = req.session.user.id;

    // Normal INSERT; on duplicate unique key, return 409
    await pool.query(
      'INSERT INTO favorites (traveler_id, property_id) VALUES (?, ?)',
      [userId, propertyId]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    // MySQL duplicate key: errno 1062, code 'ER_DUP_ENTRY'
    if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062)) {
      return res.status(409).json({ error: 'Already in favorites' });
    }
    return next(e);
  }
});

// DELETE /api/favorites/:propertyId  → remove favorite
router.delete('/:propertyId', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const { propertyId } = req.params;
    const userId = req.session.user.id;

    await pool.query(
      'DELETE FROM favorites WHERE traveler_id = ? AND property_id = ?',
      [userId, propertyId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
export default router;
