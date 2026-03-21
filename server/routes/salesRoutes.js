const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getSales,
  createSale,
  deleteSale,
  getGSTSummary,
  getProfitSummary,
} = require('../controllers/salesController');

router.get('/profit-summary', protect, getProfitSummary);
router.get('/gst-summary', protect, getGSTSummary);

router.get('/', protect, getSales);
router.post('/', protect, checkSubscriptionStatus, createSale);
router.delete('/:id', protect, checkSubscriptionStatus, deleteSale);

module.exports = router;
