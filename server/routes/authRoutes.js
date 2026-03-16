const express = require('express');
const router = express.Router();
const {
  register, login, verifyEmail, resendVerification,
  forgotPassword, resetPassword,
  updateProfile, updatePassword,
  getShop, updateShop,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.get('/shop', protect, getShop);
router.put('/shop', protect, updateShop);

module.exports = router;