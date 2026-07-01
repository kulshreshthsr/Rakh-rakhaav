const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const connectDB = require('./config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

const apiRouter   = require('./routes/apiRouter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { initScheduler } = require('./services/schedulerService');
const { apiLimiter, paymentLimiter } = require('./middleware/securityMiddleware');

const app = express();
app.set('trust proxy', 1);

const configuredOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const staticAllowedOrigins = [
  'https://rakh-rakhaav-1.onrender.com',
  'https://rakh-rakhaav.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  ...configuredOrigins,
];

// SECURITY: only explicitly listed origins are allowed. Wildcarding all of
// *.vercel.app / *.onrender.com with credentials:true would let ANY app
// deployed on those platforms make authenticated requests from a logged-in
// user's browser. Add your real frontend hostnames to FRONTEND_URLS instead.
const isAllowedOrigin = (origin = '') => {
  if (!origin) return true; // same-origin / curl / mobile webview
  if (staticAllowedOrigins.includes(origin)) return true;

  // Allow all preview/production deployments for this specific Vercel project
  try {
    const { hostname } = new URL(origin);
    if (/^rakh-rakhaav(-[a-z0-9]+)?\.vercel\.app$/.test(hostname)) return true;
  } catch {}

  // localhost convenience for development only
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { hostname } = new URL(origin);
      return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

connectDB();

app.use(cors(corsOptions));
app.use(helmet());
app.use(hpp());
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// SECURITY: strips any request keys starting with '$' or containing '.' from
// req.body/query/params, closing NoSQL operator-injection vectors (e.g.
// { "shop": { "$ne": null } } sneaking into a filter built from user input).
// This package was already a dependency but was never actually mounted.
app.use(mongoSanitize());

app.get('/api/health',    (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok', version: 'v1' }));

// SECURITY: general throttle on every API route as a floor, on top of the
// tighter per-endpoint limiters (auth, payments) applied inside their own
// route files. Previously defined in securityMiddleware.js but never mounted
// anywhere, so nothing outside /auth/* had any request ceiling at all.
app.use('/api/v1', apiLimiter);
app.use('/api', apiLimiter);

// Mount all routes at both /api (legacy) and /api/v1 (versioned)
app.use('/api/v1', apiRouter);
app.use('/api',    apiRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  initScheduler();
});

module.exports = app;