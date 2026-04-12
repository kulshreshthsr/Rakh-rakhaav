const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getAccountingSummary } = require('../controllers/accountingController');

router.get('/summary', protect, getAccountingSummary);

module.exports = router;
