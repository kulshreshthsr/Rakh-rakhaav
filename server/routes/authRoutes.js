const express = require('express');
const router = express.Router();
const {
  register, login, verifyOTP, resendOTP,
  forgotPassword, resetPassword,
  updateProfile, updatePassword,
  getShop, updateShop,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.get('/shop', protect, getShop);
router.put('/shop', protect, updateShop);

module.exports = router;