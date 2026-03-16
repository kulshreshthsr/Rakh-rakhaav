const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase } = require('../controllers/purchaseController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPurchases);
router.post('/', protect, createPurchase);
module.exports = router;