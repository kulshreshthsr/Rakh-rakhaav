const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { getAccountingSummary, getPLStatement } = require('../controllers/accountingController');

// SECURITY: P&L / margin data is the single most sensitive read in the app —
// it exposes cost_price and true margins, which most shop owners deliberately
// hide from counter staff. Previously gated by `protect` only, meaning any
// sub-user regardless of role (including Cashier) could pull it. Gated to
// VIEW_REPORTS, which Cashier does not hold per roleModel.js SYSTEM_ROLES.
router.get('/summary',      protect, requirePermission('VIEW_REPORTS'), getAccountingSummary);
router.get('/pl-statement', protect, requirePermission('VIEW_REPORTS'), getPLStatement);

module.exports = router;