const express = require('express');
const router = express.Router();
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStockHistory,
  getByBarcode,
  bulkImportProducts,
  getReorderSuggestions,
} = require('../controllers/productController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

// Products are readable by all authenticated users (needed to create invoices)
router.post('/bulk-import', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), bulkImportProducts);
router.get('/reorder-suggestions', protect, requirePermission('MANAGE_INVENTORY'), getReorderSuggestions);
router.get('/barcode/:barcode', protect, getByBarcode);
router.get('/',    protect, getProducts);
router.get('/:id/stock-history', protect, getStockHistory);
router.post('/',   protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), createProduct);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), updateProduct);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), deleteProduct);
router.post('/:id/adjust-stock', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), adjustStock);

module.exports = router;
