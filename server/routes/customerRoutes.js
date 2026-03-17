const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, deleteCustomer, getUdhaar, addUdhaar, settleUdhaar } = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getCustomers);
router.post('/', protect, createCustomer);
router.delete('/:id', protect, deleteCustomer);
router.get('/:id/udhaar', protect, getUdhaar);
router.post('/:id/udhaar', protect, addUdhaar);
router.put('/:id/settle', protect, settleUdhaar);

module.exports = router;