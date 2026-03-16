const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, deletePurchase } = require('../controllers/purchaseController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPurchases);
router.post('/', protect, createPurchase);
router.delete('/:id', protect, deletePurchase);
module.exports = router;