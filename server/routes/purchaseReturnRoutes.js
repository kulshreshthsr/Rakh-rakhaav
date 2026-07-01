const express = require('express');
const router = express.Router();
const { getPurchaseReturns, createPurchaseReturn, getReturnsForPurchase } = require('../controllers/purchaseReturnController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.get('/', protect, requirePermission('VIEW_PURCHASES'), paginationValidation, getPurchaseReturns);
router.post('/', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), createPurchaseReturn);
router.get('/purchase/:purchaseId', protect, requirePermission('VIEW_PURCHASES'), mongoIdValidation('purchaseId'), getReturnsForPurchase);

module.exports = router;