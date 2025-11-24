import session from 'express-session';
import MongoStore from 'connect-mongo';

/**
 * Builds cookie options shared across services for consistent session handling.
 */
export const buildSessionCookieOptions = (config, overrides = {}) => {
  const options = {
    httpOnly: true,
    sameSite: config.SESSION_COOKIE_SAME_SITE,
    secure: config.SESSION_COOKIE_SECURE,
    maxAge: config.SESSION_MAX_AGE,
    path: '/',
    ...overrides
  };

  if (config.SESSION_COOKIE_DOMAIN) {
    options.domain = config.SESSION_COOKIE_DOMAIN;
  }

  return options;
};

/**
 * Creates a shared Mongo-backed session middleware.
 */
export const createSessionMiddleware = (config, logger) => {
  if (!config.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required for session middleware');
  }

  const store = MongoStore.create({
    mongoUrl: config.MONGODB_SESSION_URI,
    mongoOptions: config.MONGODB_OPTIONS,
    ttl: Math.floor(config.SESSION_MAX_AGE / 1000),
    autoRemove: 'native'
  });

  store.on('error', (error) => {
    logger?.error?.('Mongo session store error', error);
  });

  return session({
    name: config.SESSION_NAME,
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store,
    cookie: buildSessionCookieOptions(config)
  });
};

