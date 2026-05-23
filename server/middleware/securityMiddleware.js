const rateLimit = require('express-rate-limit');

// Rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  message: {
    message: 'बहुत सारे login attempts। कृपया 15 मिनट बाद फिर try करें। / Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// Rate limiter for forgot password
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: {
    message: 'बहुत सारे password reset requests। कृपया 1 घंटे बाद फिर try करें। / Too many password reset requests. Please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    message: 'बहुत सारे requests। कृपया थोड़ी देर बाद फिर try करें। / Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for registration
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 registrations per IP per hour
  message: {
    message: 'बहुत सारे registration attempts। कृपया 1 घंटे बाद फिर try करें। / Too many registration attempts. Please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment endpoint rate limiter
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 payment requests per window
  message: {
    message: 'बहुत सारे payment requests। कृपया थोड़ी देर बाद फिर try करें। / Too many payment requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  forgotPasswordLimiter,
  apiLimiter,
  registrationLimiter,
  paymentLimiter
};