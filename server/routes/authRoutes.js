const express = require('express');
const router = express.Router();
const { register, login, updateProfile, updatePassword, getShop, updateShop, getSubscriptionStatus, forgotPassword, resetPassword, logout, refreshToken, completeBusinessProfile, updateLanguage } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { authLimiter, registrationLimiter, forgotPasswordLimiter } = require('../middleware/securityMiddleware');
const { updateExpenseBudgets } = require('../controllers/shopController');

router.post('/register', registrationLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/subscription-status', protect, getSubscriptionStatus);
router.put('/profile', protect, checkSubscriptionStatus, updateProfile);
router.patch('/language', protect, updateLanguage);
router.put('/password', protect, updatePassword);
router.get('/shop', protect, getShop);
router.put('/shop', protect, checkSubscriptionStatus, updateShop);
router.post('/shop/profile', protect, completeBusinessProfile);
router.patch('/shop/expense-budgets', protect, checkSubscriptionStatus, updateExpenseBudgets);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);

module.exports = router;
