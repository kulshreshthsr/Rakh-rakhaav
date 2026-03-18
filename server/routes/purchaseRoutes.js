const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, deletePurchase, getITCSummary } = require('../controllers/purchaseController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPurchases);
router.post('/', protect, createPurchase);
router.get('/itc-summary', protect, getITCSummary);   // ← NEW: for GST page
router.delete('/:id', protect, deletePurchase);

module.exports = router;