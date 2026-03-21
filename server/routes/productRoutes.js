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
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/', protect, getProducts);
router.post('/', protect, checkSubscriptionStatus, createProduct);
router.put('/:id', protect, checkSubscriptionStatus, updateProduct);
router.delete('/:id', protect, checkSubscriptionStatus, deleteProduct);
router.post('/:id/adjust-stock', protect, checkSubscriptionStatus, adjustStock);
router.get('/:id/stock-history', protect, getStockHistory);

module.exports = router;
