// server/routes/salesRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');

const {
  getSales,
  createSale,
  deleteSale,
  getGSTSummary,
  getProfitSummary,
  getWhatsAppPDF,     // ← NEW
} = require('../controllers/salesController');

// ── Summary routes (must be before /:id routes) ──────────────────────────────
router.get('/profit-summary', auth, getProfitSummary);
router.get('/gst-summary',    auth, getGSTSummary);

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/',    auth, getSales);
router.post('/',   auth, createSale);
router.delete('/:id', auth, deleteSale);

// ── NEW: WhatsApp PDF ─────────────────────────────────────────────────────────
// GET /api/sales/:id/whatsapp-pdf
router.get('/:id/whatsapp-pdf', auth, getWhatsAppPDF);

module.exports = router;