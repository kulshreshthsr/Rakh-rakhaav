const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDashboardSummary, workflowCounts, creditAging, tableStatus } = require('../controllers/dashboardController');

router.get('/', protect, getDashboardSummary);
router.get('/summary', protect, getDashboardSummary);
router.get('/workflow-counts', protect, workflowCounts);
router.get('/credit-aging', protect, creditAging);
router.get('/table-status', protect, tableStatus);

module.exports = router;
