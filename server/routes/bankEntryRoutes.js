const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');
const { getBankEntries, createBankEntry, updateBankEntry, deleteBankEntry } = require('../controllers/bankEntryController');

router.get('/',      protect, requirePermission('VIEW_BANK'),   paginationValidation, getBankEntries);
router.post('/',     protect, checkSubscriptionStatus, requirePermission('MANAGE_BANK'), createBankEntry);
router.put('/:id',   protect, checkSubscriptionStatus, requirePermission('MANAGE_BANK'), mongoIdValidation(), updateBankEntry);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_BANK'), mongoIdValidation(), deleteBankEntry);

module.exports = router;