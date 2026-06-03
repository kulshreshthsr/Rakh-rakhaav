const logger = require('../utils/logger');

const isDev = process.env.NODE_ENV !== 'production';

const errorHandler = (err, req, res, next) => {
  // MongoDB CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ message: 'Invalid ID format', code: 'INVALID_ID', status: 400 });
  }

  // Shop not configured — user must complete onboarding
  if (err.code === 'SHOP_NOT_CONFIGURED') {
    return res.status(400).json({ message: err.message, code: 'SHOP_NOT_CONFIGURED', status: 400 });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ message: 'This record already exists', code: 'DUPLICATE_ENTRY', status: 409 });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message, code: 'VALIDATION_ERROR', status: 400 });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Authentication failed', code: 'AUTH_ERROR', status: 401 });
  }

  // Known status codes set by controllers (4xx business errors forwarded via next(err))
  // Controllers may set err.statusCode OR err.status — check both.
  const httpStatus = err.statusCode || err.status;
  if (httpStatus >= 400 && httpStatus < 500) {
    return res.status(httpStatus).json({ message: err.message, code: err.code || 'CLIENT_ERROR', status: httpStatus });
  }

  logger.error('[errorHandler]', err.message || err);
  res.status(500).json({
    message: 'कुछ गलत हुआ। दोबारा try करें।',
    code: 'INTERNAL_ERROR',
    status: 500,
    ...(isDev && { debug: err.message }),
  });
};

module.exports = errorHandler;
