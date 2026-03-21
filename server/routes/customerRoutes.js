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
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/', protect, getCustomers);
router.post('/', protect, checkSubscriptionStatus, createCustomer);
router.put('/:id', protect, checkSubscriptionStatus, updateCustomer);
router.delete('/:id', protect, checkSubscriptionStatus, deleteCustomer);
router.get('/:id/udhaar', protect, getUdhaar);
router.post('/:id/udhaar', protect, checkSubscriptionStatus, addUdhaar);
router.post('/:id/settle', protect, checkSubscriptionStatus, settlePayment);
router.put('/:id/settle', protect, checkSubscriptionStatus, settlePayment);

module.exports = router;
