import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from './db.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import propertiesRouter from './routes/properties.js';
import bookingsRouter from './routes/bookings.js';
import favoritesRouter from './routes/favorites.js';
import searchRouter from './routes/search.js';
import dashboardsRouter from './routes/dashboards.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const pool = createPool();

const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000
});

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.use(session({
  key: 'airbnb.sid',
  secret: process.env.SESSION_SECRET || 'supersecret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Static for uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Routers
app.use('/api/auth', (req, res, next) => { req.pool = pool; next(); }, authRouter);
app.use('/api/users', (req, res, next) => { req.pool = pool; next(); }, usersRouter);
app.use('/api/properties', (req, res, next) => { req.pool = pool; next(); }, propertiesRouter);
app.use('/api/bookings', (req, res, next) => { req.pool = pool; next(); }, bookingsRouter);
app.use('/api/favorites', (req, res, next) => { req.pool = pool; next(); }, favoritesRouter);
app.use('/api/search', (req, res, next) => { req.pool = pool; next(); }, searchRouter);
app.use('/api/dashboards', (req, res, next) => { req.pool = pool; next(); }, dashboardsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
