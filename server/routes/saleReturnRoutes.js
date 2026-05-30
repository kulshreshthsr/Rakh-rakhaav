const express = require('express');
const router = express.Router();
const { getSaleReturns, createSaleReturn, getReturnsForSale } = require('../controllers/saleReturnController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/', protect, requirePermission('VIEW_SALES'), getSaleReturns);
router.post('/', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'), createSaleReturn);
router.get('/sale/:saleId', protect, requirePermission('VIEW_SALES'), getReturnsForSale);

module.exports = router;
