const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { getIncome, createIncome, updateIncome, deleteIncome } = require('../controllers/incomeController');

router.get('/', protect, getIncome);
router.post('/', protect, checkSubscriptionStatus, createIncome);
router.put('/:id', protect, checkSubscriptionStatus, updateIncome);
router.delete('/:id', protect, checkSubscriptionStatus, deleteIncome);

module.exports = router;
