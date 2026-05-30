const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, updatePurchase, deletePurchase, getITCSummary } = require('../controllers/purchaseController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/',          protect, requirePermission('VIEW_PURCHASES'),    getPurchases);
router.post('/',         protect, checkSubscriptionStatus, requirePermission('CREATE_PURCHASE'),  createPurchase);
router.put('/:id',       protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), updatePurchase);
router.get('/itc-summary', protect, requirePermission('VIEW_GST'),        getITCSummary);
router.delete('/:id',    protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), deletePurchase);

module.exports = router;
