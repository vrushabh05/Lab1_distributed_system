import { Router } from 'express';
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
    res.json({ favorites: rows });
  } catch (e) { next(e); }
});

export default router;
