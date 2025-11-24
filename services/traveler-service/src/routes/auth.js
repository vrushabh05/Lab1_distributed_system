import express from 'express';
import User from '../models/User.js';
import { authSchemas, validateBody } from '../../../shared/validation/schemas.js';
import {
  config,
  issueAuthToken,
  sanitizeUserProfile,
  persistSessionUser,
  destroySession,
  buildSessionCookieOptions,
  resolveRequestUser
} from '../../../shared/core/index.js';

const router = express.Router();

// CRITICAL SECURITY: Validate JWT_SECRET at module load time (fail-fast)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('🔴 SECURITY ERROR: JWT_SECRET is required');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  throw new Error('JWT_SECRET is not set - cannot start traveler-service');
}

if (JWT_SECRET.length < 32) {
  console.error('🔴 SECURITY ERROR: JWT_SECRET must be at least 32 characters');
  throw new Error(`JWT_SECRET too weak (length: ${JWT_SECRET.length}, minimum: 32)`);
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password validation
const validatePassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber) {
    return 'Password must include letters and numbers';
  }
  return null;
};

const authSuccessResponse = async (req, res, user) => {
  const token = issueAuthToken(user);
  await persistSessionUser(req, user);
  const profile = sanitizeUserProfile(user);

  res.json({
    token,
    userId: profile.id,
    user: profile
  });
};

// Signup
router.post('/signup', validateBody(authSchemas.signup), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    if (!['TRAVELER', 'OWNER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = new User({ name, email, password, role });
    await user.save();

    await authSuccessResponse(req, res, user);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
router.post('/login', validateBody(authSchemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await authSuccessResponse(req, res, user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    await destroySession(req);
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    res.clearCookie(
      config.SESSION_NAME,
      buildSessionCookieOptions(config, { maxAge: 0 })
    );
    res.json({ message: 'Logged out' });
  }
});

// Get current user (verify session or JWT)
router.get('/me', async (req, res) => {
  try {
    const identity = resolveRequestUser(req);
    const user = await User.findById(identity.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUserProfile(user) });
  } catch (error) {
    res.status(401).json({ error: 'Invalid session' });
  }
});

export default router;
