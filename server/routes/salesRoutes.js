const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getSales,
  createSale,
  updateSale,
  deleteSale,
  updateSaleWorkflow,
  getGSTSummary,
  getGSTComplianceReport,
  getProfitSummary,
} = require('../controllers/salesController');

router.get('/profit-summary', protect, getProfitSummary);
router.get('/gst-summary', protect, getGSTSummary);
router.get('/gst-report', protect, getGSTComplianceReport);

router.get('/', protect, getSales);
router.post('/', protect, checkSubscriptionStatus, createSale);
router.patch('/:id/workflow', protect, requirePermission('CREATE_INVOICE'), updateSaleWorkflow);
router.put('/:id', protect, checkSubscriptionStatus, updateSale);
router.delete('/:id', protect, checkSubscriptionStatus, deleteSale);

module.exports = router;
