const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createOrder,
  verifyOrder,
  webhook,
  getPricingConfig,
} = require('../controllers/paymentController');

router.get('/pricing', protect, getPricingConfig);
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyOrder);
router.post('/webhook', webhook);

module.exports = router;
