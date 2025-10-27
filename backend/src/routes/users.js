<<<<<<< HEAD
import { Router } from 'express';
=======
import { Router } from 'express'; 
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Avatar upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'src', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${req.session.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

router.get('/me', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
<<<<<<< HEAD
    const [rows] = await pool.query('SELECT id, role, name, email, phone, about, city, state, country, languages, gender, avatar_url FROM users WHERE id = ?', [req.session.user.id]);
=======
    const [rows] = await pool.query(
      'SELECT id, role, name, email, phone, about, city, state, country, languages, gender, avatar_url FROM users WHERE id = ?',
      [req.session.user.id]
    );
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
    res.json({ profile: rows[0] });
  } catch (e) { next(e); }
});

router.put('/me', requireAuth, async (req, res, next) => {
  const pool = req.pool;
  try {
    const { name, phone, about, city, state, country, languages, gender } = req.body;
    await pool.query(
      `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), about = COALESCE(?, about),
       city = COALESCE(?, city), state = COALESCE(?, state), country = COALESCE(?, country),
       languages = COALESCE(?, languages), gender = COALESCE(?, gender) WHERE id = ?`,
      [name, phone, about, city, state, country, languages, gender, req.session.user.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/me/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  const pool = req.pool;
  try {
    const fileUrl = `${process.env.FILE_BASE_URL || 'http://localhost:3001/uploads'}/${req.file.filename}`;
    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [fileUrl, req.session.user.id]);
    res.json({ avatar_url: fileUrl });
  } catch (e) { next(e); }
});

export default router;
