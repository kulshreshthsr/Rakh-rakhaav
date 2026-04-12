const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/', protect, getExpenses);
router.post('/', protect, checkSubscriptionStatus, createExpense);
router.put('/:id', protect, checkSubscriptionStatus, updateExpense);
router.delete('/:id', protect, checkSubscriptionStatus, deleteExpense);

module.exports = router;
