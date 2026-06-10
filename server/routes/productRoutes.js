const express = require('express');
const router = express.Router();
const multer = require('multer');
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + (file.originalname || '').split('.').pop().toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Products are readable by all authenticated users (needed to create invoices)
router.post('/bulk-import', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), upload.single('file'), bulkImportProducts);
router.get('/reorder-suggestions', protect, requirePermission('MANAGE_INVENTORY'), getReorderSuggestions);
router.get('/barcode/:barcode', protect, getByBarcode);
router.get('/',    protect, getProducts);
router.get('/:id/stock-history', protect, getStockHistory);
router.post('/',   protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), createProduct);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), updateProduct);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), deleteProduct);
router.post('/:id/adjust-stock', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), adjustStock);

module.exports = router;
