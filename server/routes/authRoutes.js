const express = require('express');
const router = express.Router();
const { register, login, updateProfile, updatePassword, getShop, updateShop, getSubscriptionStatus, forgotPassword, resetPassword, logout, refreshToken, completeBusinessProfile, updateLanguage } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { authLimiter, registrationLimiter, forgotPasswordLimiter } = require('../middleware/securityMiddleware');
const { updateExpenseBudgets } = require('../controllers/shopController');
const { registerValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation, updateShopValidation } = require('../middleware/validationMiddleware');

router.post('/register', registrationLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordValidation, forgotPassword);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.get('/subscription-status', protect, getSubscriptionStatus);
router.put('/profile', protect, checkSubscriptionStatus, updateProfile);
router.patch('/language', protect, updateLanguage);
router.put('/password', protect, updatePassword);
router.get('/shop', protect, getShop);
router.put('/shop', protect, checkSubscriptionStatus, updateShopValidation, updateShop);
router.post('/shop/profile', protect, completeBusinessProfile);
router.patch('/shop/expense-budgets', protect, checkSubscriptionStatus, updateExpenseBudgets);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);

module.exports = router;
