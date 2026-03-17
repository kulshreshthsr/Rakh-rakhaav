const express = require('express');
const router = express.Router();
const { getSales, createSale, deleteSale, getGSTSummary } = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getSales);
router.post('/', protect, createSale);
router.delete('/:id', protect, deleteSale);
router.get('/gst-summary', protect, getGSTSummary);

module.exports = router;