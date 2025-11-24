import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import {
  createAuthMiddleware,
  persistSessionUser,
  sanitizeUserProfile
} from '../../../shared/core/index.js';

const router = express.Router();
const authMiddleware = createAuthMiddleware();

const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: sanitizeUserProfile(user) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allowedFields = ['name', 'phone', 'about', 'city', 'state', 'country', 'languages', 'gender', 'address'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const value = typeof req.body[field] === 'string'
          ? req.body[field].trim()
          : req.body[field];

        // Normalize empty strings to undefined so we don't store useless blanks
        user[field] = value === '' ? undefined : value;
      }
    });

    await user.save();
    await persistSessionUser(req, user);

    res.json({ profile: sanitizeUserProfile(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Avatar file is required' });
    }

    const relativePath = `/uploads/avatars/${path.basename(req.file.path)}`;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a0fb3a35-2439-47c6-8c4f-0fb0cc915f35', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'avatar-upload',
        hypothesisId: 'H1',
        location: 'services/traveler-service/src/routes/users.js:relativePath',
        message: 'Avatar upload computed relative path',
        data: { userId: req.user?.id, relativePath },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatar: relativePath } },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a0fb3a35-2439-47c6-8c4f-0fb0cc915f35', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'avatar-upload',
          hypothesisId: 'H2',
          location: 'services/traveler-service/src/routes/users.js:userNotFound',
          message: 'Avatar upload user not found',
          data: { userId: req.user?.id },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion

      return res.status(404).json({ error: 'User not found' });
    }

    await persistSessionUser(req, user);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a0fb3a35-2439-47c6-8c4f-0fb0cc915f35', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'avatar-upload',
        hypothesisId: 'H3',
        location: 'services/traveler-service/src/routes/users.js:success',
        message: 'Avatar upload succeeded',
        data: { userId: req.user?.id, avatar: relativePath },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    res.json({ avatar_url: relativePath, user: sanitizeUserProfile(user) });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload avatar' });
  }
});

export default router;
