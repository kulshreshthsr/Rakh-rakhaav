const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDashboardSummary } = require('../controllers/dashboardController');

router.get('/', protect, getDashboardSummary);
router.get('/summary', protect, getDashboardSummary);

module.exports = router;
