const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/tierMiddleware');
const { getStockValuation, getStockAging, exportStockValuationCsv } = require('../controllers/reportsController');

router.get('/stock-valuation',            protect, requirePermission('VIEW_REPORTS'), requireFeature('report_stock_valuation'), getStockValuation);
router.get('/stock-valuation/export-csv', protect, requirePermission('VIEW_REPORTS'), requireFeature('report_stock_valuation'), exportStockValuationCsv);
router.get('/stock-aging',                protect, requirePermission('VIEW_REPORTS'), requireFeature('report_stock_aging'),     getStockAging);

module.exports = router;
