const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, deleteExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getExpenses);
router.post('/', protect, createExpense);
router.delete('/:id', protect, deleteExpense);

module.exports = router;