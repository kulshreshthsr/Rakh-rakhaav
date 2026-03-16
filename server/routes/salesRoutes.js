const express = require('express');
const router = express.Router();
const { getSales, createSale, deleteSale } = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getSales);
router.post('/', protect, createSale);
router.delete('/:id', protect, deleteSale);
module.exports = router;