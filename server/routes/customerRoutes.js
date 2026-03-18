const express = require('express');
const router = express.Router();
const {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getUdhaar,
  addUdhaar,
  settlePayment,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getCustomers);
router.post('/', protect, createCustomer);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);
router.get('/:id/udhaar', protect, getUdhaar);
router.post('/:id/udhaar', protect, addUdhaar);
router.post('/:id/settle', protect, settlePayment); // ← fixed: POST, partial payment
// Old PUT /:id/settle kept as alias for backward compat
router.put('/:id/settle', protect, settlePayment);

module.exports = router;