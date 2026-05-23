const express = require('express');
const router = express.Router();
const { register, login, updateProfile, updatePassword, getShop, updateShop, getSubscriptionStatus } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

const { authLimiter, registrationLimiter } = require('../middleware/securityMiddleware');

router.post('/register', registrationLimiter, register);  // ← Added registrationLimiter
router.post('/login', authLimiter, login);                // ← Added authLimiter
router.get('/subscription-status', protect, getSubscriptionStatus);
router.put('/profile', protect, checkSubscriptionStatus, updateProfile);
router.put('/password', protect, checkSubscriptionStatus, updatePassword);
router.get('/shop', protect, getShop);
router.put('/shop', protect, checkSubscriptionStatus, updateShop);

module.exports = router;
