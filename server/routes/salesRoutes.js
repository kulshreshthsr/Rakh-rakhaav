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
  getAppointments,
  getClientHistory,
  createExchange,
  createChallan,
  convertToInvoice,
} = require('../controllers/salesController');

router.get('/profit-summary',  protect, requirePermission('VIEW_REPORTS'), getProfitSummary);
router.get('/gst-summary',     protect, requirePermission('VIEW_GST'),     getGSTSummary);
router.get('/gst-report',      protect, requirePermission('VIEW_GST'),     getGSTComplianceReport);
router.get('/appointments',    protect, requirePermission('VIEW_SALES'),   getAppointments);
router.get('/client-history',  protect, requirePermission('VIEW_SALES'),   getClientHistory);
router.post('/exchange',       protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createExchange);
router.post('/challan',        protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createChallan);
router.post('/:id/convert-to-invoice', protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), convertToInvoice);

router.get('/',    protect, requirePermission('VIEW_SALES'),   getSales);
router.post('/',   protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createSale);
router.patch('/:id/workflow', protect, requirePermission('CREATE_INVOICE'), updateSaleWorkflow);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),  updateSale);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'), deleteSale);

module.exports = router;
