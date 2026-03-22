const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getSales,
  createSale,
  updateSale,
  deleteSale,
  getGSTSummary,
  getProfitSummary,
} = require('../controllers/salesController');

router.get('/profit-summary', protect, getProfitSummary);
router.get('/gst-summary', protect, getGSTSummary);

router.get('/', protect, getSales);
router.post('/', protect, checkSubscriptionStatus, createSale);
router.put('/:id', protect, checkSubscriptionStatus, updateSale);
router.delete('/:id', protect, checkSubscriptionStatus, deleteSale);

module.exports = router;
