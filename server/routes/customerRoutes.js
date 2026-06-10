const express = require('express');
const router = express.Router();
const {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getUdhaar,
  addUdhaar,
  updateUdhaar,
  deleteUdhaar,
  settlePayment,
  updateReminderTimestamp,
  backfillUdhaarBalances,
} = require('../controllers/customerController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/',      protect, requirePermission('VIEW_UDHAAR'),    getCustomers);
router.post('/',     protect, checkSubscriptionStatus, requirePermission('MANAGE_CUSTOMERS'), createCustomer);
router.put('/:id',   protect, checkSubscriptionStatus, requirePermission('MANAGE_CUSTOMERS'), updateCustomer);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_CUSTOMERS'), deleteCustomer);
router.get('/:id/udhaar',  protect, requirePermission('VIEW_UDHAAR'),   getUdhaar);
router.post('/:id/udhaar',              protect, checkSubscriptionStatus, requirePermission('MANAGE_UDHAAR'), addUdhaar);
router.put('/:id/udhaar/:entryId',     protect, checkSubscriptionStatus, requirePermission('MANAGE_UDHAAR'), updateUdhaar);
router.delete('/:id/udhaar/:entryId',  protect, checkSubscriptionStatus, requirePermission('MANAGE_UDHAAR'), deleteUdhaar);
router.post('/:id/settle', protect, checkSubscriptionStatus, requirePermission('MANAGE_UDHAAR'), settlePayment);
router.put('/:id/settle',  protect, checkSubscriptionStatus, requirePermission('MANAGE_UDHAAR'), settlePayment);
router.patch('/:id/remind', protect, checkSubscriptionStatus, requirePermission('MANAGE_UDHAAR'), updateReminderTimestamp);
router.post('/admin/backfill-balances', protect, backfillUdhaarBalances);

module.exports = router;
