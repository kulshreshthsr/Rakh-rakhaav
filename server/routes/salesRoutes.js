// server/routes/salesRoutes.js
const express = require('express');
const router  = express.Router();
const { protect: auth } = require('../middleware/authMiddleware');

const {
  getSales,
  createSale,
  deleteSale,
  getGSTSummary,
  getProfitSummary,
} = require('../controllers/salesController');

// ── Summary routes (must be before /:id routes) ──────────────────────────────
router.get('/profit-summary', auth, getProfitSummary);
router.get('/gst-summary',    auth, getGSTSummary);

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/',       auth, getSales);
router.post('/',      auth, createSale);
router.delete('/:id', auth, deleteSale);

module.exports = router;