const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getMemberships, getClientMemberships, createMembership, redeemSession, getMembership } = require('../controllers/membershipController');

router.get('/client',      protect, getClientMemberships);
router.get('/',            protect, getMemberships);
router.get('/:id',         protect, getMembership);
router.post('/',           protect, createMembership);
router.patch('/:id/redeem', protect, redeemSession);

module.exports = router;
