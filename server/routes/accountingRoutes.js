const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getAccountingSummary, getPLStatement } = require('../controllers/accountingController');

router.get('/summary',      protect, getAccountingSummary);
router.get('/pl-statement', protect, getPLStatement);

module.exports = router;
