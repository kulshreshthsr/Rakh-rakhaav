const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, updatePurchase, deletePurchase, getITCSummary } = require('../controllers/purchaseController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/', protect, getPurchases);
router.post('/', protect, checkSubscriptionStatus, createPurchase);
router.put('/:id', protect, checkSubscriptionStatus, updatePurchase);
router.get('/itc-summary', protect, getITCSummary);
router.delete('/:id', protect, checkSubscriptionStatus, deletePurchase);

module.exports = router;
