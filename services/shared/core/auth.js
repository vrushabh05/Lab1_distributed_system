import jwt from 'jsonwebtoken';
import {
  AuthenticationError,
  AuthorizationError,
  ApplicationError
} from './errors.js';
import { config } from './config.js';

const buildUserIdentity = (userLike = {}) => ({
  id: userLike._id?.toString?.() || userLike.id,
  email: userLike.email,
  role: userLike.role,
  name: userLike.name
});

export const sanitizeUserProfile = (userDoc) => {
  if (!userDoc) return null;
  const data = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete data.password;
  delete data.__v;

  const avatarPath = data.avatar || data.avatar_url || null;

  return {
    id: data._id?.toString?.() || data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    phone: data.phone,
    city: data.city,
    state: data.state,
    country: data.country,
    gender: data.gender,
    languages: data.languages,
    about: data.about,
    address: data.address,
    avatar: avatarPath,
    avatar_url: avatarPath,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

const getAuthHeaderToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

export const resolveRequestUser = (req) => {
  if (req.user) {
    return req.user;
  }

  if (req.session?.user) {
    req.user = req.session.user;
    return req.user;
  }

  const token = getAuthHeaderToken(req);
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const identity = buildUserIdentity(decoded);
    req.user = identity;
    return identity;
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
};

export const createAuthMiddleware = (options = {}) => (req, res, next) => {
  try {
    const user = resolveRequestUser(req);

    if (options.roles && !options.roles.includes(user.role)) {
      throw new AuthorizationError('Insufficient permissions', {
        requiredRoles: options.roles,
        role: user.role
      });
    }

    next();
  } catch (error) {
    if (error instanceof ApplicationError) {
      return res.status(error.statusCode).json(error.toJSON());
    }

    console.error('Unhandled auth middleware error', error);
    return res.status(500).json({
      error: {
        message: 'Authentication middleware failure',
        code: 'AUTH_MIDDLEWARE_ERROR'
      }
    });
  }
};

export const persistSessionUser = (req, user) =>
  new Promise((resolve, reject) => {
    const identity = buildUserIdentity(user);

    const saveSession = () => {
      req.session.user = identity;
      req.session.save((saveError) => {
        if (saveError) return reject(saveError);
        resolve(identity);
      });
    };

    if (req.session?.user?.id === identity.id) {
      return saveSession();
    }

    req.session.regenerate((regenError) => {
      if (regenError) return reject(regenError);
      saveSession();
    });
  });

export const destroySession = (req) =>
  new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

export const issueAuthToken = (user, options = {}) => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload = buildUserIdentity(user);
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: options.expiresIn || config.JWT_EXPIRES_IN || '7d'
  });
};

