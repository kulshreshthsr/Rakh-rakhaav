const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');
const { getIncome, createIncome, updateIncome, deleteIncome } = require('../controllers/incomeController');

router.get('/',      protect, requirePermission('VIEW_INCOME'),   paginationValidation, getIncome);
router.post('/',     protect, checkSubscriptionStatus, requirePermission('MANAGE_INCOME'), createIncome);
router.put('/:id',   protect, checkSubscriptionStatus, requirePermission('MANAGE_INCOME'), mongoIdValidation(), updateIncome);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_INCOME'), mongoIdValidation(), deleteIncome);

module.exports = router;