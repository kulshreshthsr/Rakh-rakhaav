const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/securityMiddleware');
const {
  createOrder,
  verifyOrder,
  webhook,
  getPricingConfig,
} = require('../controllers/paymentController');

router.get('/pricing', protect, getPricingConfig);
router.post('/create-order', protect, paymentLimiter, createOrder);
router.post('/verify', protect, paymentLimiter, verifyOrder);
// NOTE: webhook is called by Razorpay's servers, not the logged-in user's
// browser — no `protect` (Razorpay doesn't have your JWT) and no user-scoped
// rate limiter (would throttle Razorpay's IP, not an abusive user). Integrity
// here relies entirely on webhook signature verification inside the
// controller — confirm that's present and not skippable.
router.post('/webhook', webhook);

module.exports = router;