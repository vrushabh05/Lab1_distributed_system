import { Router } from 'express';
import bcrypt from 'bcrypt';

const router = Router();

router.post('/signup', async (req, res, next) => {
  const pool = req.pool;
  try {
    const { role, name, email, password } = req.body;
    if (!role || !['TRAVELER','OWNER'].includes(role)) throw { status: 400, message: 'Invalid role' };
    if (!name || !email || !password) throw { status: 400, message: 'Missing fields' };

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) throw { status: 409, message: 'Email already in use' };

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (role, name, email, password_hash) VALUES (?,?,?,?)',
      [role, name, email, hash]
    );
    const user = { id: result.insertId, role, name, email };
    req.session.user = user;
    res.json({ user });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  const pool = req.pool;
  try {
    const { email, password } = req.body;
    if (!email || !password) throw { status: 400, message: 'Missing fields' };

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) throw { status: 401, message: 'Invalid credentials' };
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) throw { status: 401, message: 'Invalid credentials' };

    const user = { id: u.id, role: u.role, name: u.name, email: u.email };
    req.session.user = user;
    res.json({ user });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

export default router;
