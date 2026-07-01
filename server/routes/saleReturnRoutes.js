const express = require('express');
const router = express.Router();
const { getSaleReturns, createSaleReturn, getReturnsForSale } = require('../controllers/saleReturnController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.get('/', protect, requirePermission('VIEW_SALES'), paginationValidation, getSaleReturns);
router.post('/', protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'), createSaleReturn);
router.get('/sale/:saleId', protect, requirePermission('VIEW_SALES'), mongoIdValidation('saleId'), getReturnsForSale);

module.exports = router;