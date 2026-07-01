const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.get('/',      protect, requirePermission('VIEW_EXPENSES'),   paginationValidation, getExpenses);
router.post('/',     protect, checkSubscriptionStatus, requirePermission('MANAGE_EXPENSES'), createExpense);
router.put('/:id',   protect, checkSubscriptionStatus, requirePermission('MANAGE_EXPENSES'), mongoIdValidation(), updateExpense);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_EXPENSES'), mongoIdValidation(), deleteExpense);

module.exports = router;