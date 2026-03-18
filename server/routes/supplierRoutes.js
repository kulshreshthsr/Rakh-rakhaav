const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
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
router.post('/', protect, createSupplier);
router.get('/:id', protect, getSupplierById);
router.put('/:id', protect, updateSupplier);
router.delete('/:id', protect, deleteSupplier);
router.get('/:id/udhaar', protect, getSupplierLedger);    // ledger history
router.post('/:id/settle', protect, settleSupplierPayment); // record payment

module.exports = router;