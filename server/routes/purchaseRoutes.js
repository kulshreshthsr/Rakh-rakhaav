const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, updatePurchase, deletePurchase, getITCSummary, getPurchaseRegister, receivePurchase } = require('../controllers/purchaseController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { requireFeature } = require('../middleware/tierMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.get('/',          protect, requirePermission('VIEW_PURCHASES'),    paginationValidation, getPurchases);
router.post('/',         protect, checkSubscriptionStatus, requirePermission('CREATE_PURCHASE'),  createPurchase);
router.put('/:id',       protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), mongoIdValidation(), updatePurchase);
router.get('/itc-summary', protect, requirePermission('VIEW_GST'),        getITCSummary);
router.get('/register',   protect, requirePermission('VIEW_PURCHASES'),   getPurchaseRegister);
router.patch('/:id/receive', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), mongoIdValidation(), requireFeature('erp_grn'), receivePurchase);
router.delete('/:id',        protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), mongoIdValidation(), deletePurchase);

module.exports = router;