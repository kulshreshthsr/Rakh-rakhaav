const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  addSupplierUdhaar,
  settleSupplierPayment,
  updateReminderTimestamp,
} = require('../controllers/supplierController');

router.get('/',      protect, requirePermission('MANAGE_SUPPLIERS'), paginationValidation, getSuppliers);
router.post('/',     protect, checkSubscriptionStatus, requirePermission('MANAGE_SUPPLIERS'), createSupplier);
router.get('/:id',   protect, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), getSupplierById);
router.put('/:id',   protect, checkSubscriptionStatus, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), updateSupplier);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), deleteSupplier);
router.get('/:id/udhaar',  protect, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), getSupplierLedger);
router.post('/:id/udhaar', protect, checkSubscriptionStatus, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), addSupplierUdhaar);
router.post('/:id/settle', protect, checkSubscriptionStatus, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), settleSupplierPayment);
router.patch('/:id/remind', protect, checkSubscriptionStatus, requirePermission('MANAGE_SUPPLIERS'), mongoIdValidation(), updateReminderTimestamp);

module.exports = router;