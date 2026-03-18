const express = require('express');
const router = express.Router();
const { getSales, createSale, deleteSale, getGSTSummary, getProfitSummary } = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');

// ⚠️ IMPORTANT: Static routes MUST come before dynamic /:id routes
// Otherwise 'gst-summary' gets matched as an :id param

router.get('/gst-summary', protect, getGSTSummary);       // ← FIXED: was after /:id before
router.get('/profit-summary', protect, getProfitSummary); // ← NEW: for dashboard

router.get('/', protect, getSales);
router.post('/', protect, createSale);
router.delete('/:id', protect, deleteSale);

module.exports = router;