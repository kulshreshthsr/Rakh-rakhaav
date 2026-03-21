const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  settleSupplierPayment,
} = require('../controllers/supplierController');

router.get('/', protect, getSuppliers);
router.post('/', protect, checkSubscriptionStatus, createSupplier);
router.get('/:id', protect, getSupplierById);
router.put('/:id', protect, checkSubscriptionStatus, updateSupplier);
router.delete('/:id', protect, checkSubscriptionStatus, deleteSupplier);
router.get('/:id/udhaar', protect, getSupplierLedger);
router.post('/:id/settle', protect, checkSubscriptionStatus, settleSupplierPayment);

module.exports = router;
