const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { getBankEntries, createBankEntry, updateBankEntry, deleteBankEntry } = require('../controllers/bankEntryController');

router.get('/', protect, getBankEntries);
router.post('/', protect, checkSubscriptionStatus, createBankEntry);
router.put('/:id', protect, checkSubscriptionStatus, updateBankEntry);
router.delete('/:id', protect, checkSubscriptionStatus, deleteBankEntry);

module.exports = router;
