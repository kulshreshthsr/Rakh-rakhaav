const express = require('express');
const router = express.Router();
const { getSales, createSale } = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getSales);
router.post('/', protect, createSale);
module.exports = router;