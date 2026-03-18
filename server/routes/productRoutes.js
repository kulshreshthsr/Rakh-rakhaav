const express = require('express');
const router = express.Router();
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStockHistory,
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getProducts);
router.post('/', protect, createProduct);
router.put('/:id', protect, updateProduct);
router.delete('/:id', protect, deleteProduct);
router.post('/:id/adjust-stock', protect, adjustStock);   // ← NEW: manual stock adjust
router.get('/:id/stock-history', protect, getStockHistory); // ← NEW: stock log

module.exports = router;