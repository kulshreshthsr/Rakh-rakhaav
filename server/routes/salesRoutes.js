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

router.get('/profit-summary', protect, requirePermission('VIEW_REPORTS'), getProfitSummary);
router.get('/gst-summary',    protect, requirePermission('VIEW_GST'),     getGSTSummary);
router.get('/gst-report',     protect, requirePermission('VIEW_GST'),     getGSTComplianceReport);

router.get('/',    protect, requirePermission('VIEW_SALES'),   getSales);
router.post('/',   protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createSale);
router.patch('/:id/workflow', protect, requirePermission('CREATE_INVOICE'), updateSaleWorkflow);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),  updateSale);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'), deleteSale);

module.exports = router;
