const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getSaleById,
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
  markChallanDispatched,
  markChallanDelivered,
  convertToInvoice,
  createCreditNote,
  createDebitNote,
} = require('../controllers/salesController');

router.get('/profit-summary',  protect, requirePermission('VIEW_REPORTS'), getProfitSummary);
router.get('/gst-summary',     protect, requirePermission('VIEW_GST'),     getGSTSummary);
router.get('/gst-report',      protect, requirePermission('VIEW_GST'),     getGSTComplianceReport);
router.get('/appointments',    protect, requirePermission('VIEW_SALES'),   getAppointments);
router.get('/client-history',  protect, requirePermission('VIEW_SALES'),   getClientHistory);
router.post('/exchange',      protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createExchange);
router.post('/challan',       protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createChallan);
router.post('/credit-note',   protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createCreditNote);
router.post('/debit-note',    protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createDebitNote);
router.patch('/:id/mark-dispatched', protect, requirePermission('CREATE_INVOICE'), markChallanDispatched);
router.patch('/:id/mark-delivered', protect, requirePermission('CREATE_INVOICE'), markChallanDelivered);
router.post('/:id/convert-to-invoice', protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), convertToInvoice);

router.get('/',    protect, requirePermission('VIEW_SALES'),   getSales);
router.get('/:id', protect, requirePermission('VIEW_SALES'),   getSaleById);
router.post('/',   protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'), createSale);
router.patch('/:id/workflow', protect, requirePermission('CREATE_INVOICE'), updateSaleWorkflow);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),  updateSale);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'), deleteSale);

module.exports = router;
