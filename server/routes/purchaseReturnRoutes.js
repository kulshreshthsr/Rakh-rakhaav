const express = require('express');
const router = express.Router();
const { getPurchaseReturns, createPurchaseReturn, getReturnsForPurchase } = require('../controllers/purchaseReturnController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/', protect, requirePermission('VIEW_PURCHASES'), getPurchaseReturns);
router.post('/', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), createPurchaseReturn);
router.get('/purchase/:purchaseId', protect, requirePermission('VIEW_PURCHASES'), getReturnsForPurchase);

module.exports = router;
