const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/inventoryController');

router.use(protect);
router.use(requirePermission('MANAGE_INVENTORY'));

// ── Global serial/IMEI lookup (must be before /:productId param routes) ─────
router.get('/serials/lookup',               ctrl.lookupSerial);

// ── Batch routes ────────────────────────────────────────────────────────────
router.get ('/batches/expiring',            ctrl.getExpiringBatches);
router.get ('/batches/:productId',          ctrl.getBatches);
router.post('/batches/:productId',          ctrl.addBatch);
router.put ('/batches/item/:batchId',       ctrl.updateBatch);
router.delete('/batches/item/:batchId',     ctrl.deleteBatch);

// ── Variant routes ──────────────────────────────────────────────────────────
router.get ('/variants/:productId',         ctrl.getVariants);
router.post('/variants/:productId',         ctrl.saveVariants);    // bulk upsert
router.put ('/variants/item/:variantId',    ctrl.updateVariantQty);

// ── Recipe routes ───────────────────────────────────────────────────────────
router.get   ('/recipe/:productId',         ctrl.getRecipe);
router.put   ('/recipe/:productId',         ctrl.saveRecipe);      // upsert
router.delete('/recipe/:productId',         ctrl.deleteRecipe);

// ── Serial routes ───────────────────────────────────────────────────────────
router.get   ('/serials/:productId',        ctrl.getSerials);
router.post  ('/serials/:productId',        ctrl.addSerials);       // bulk add
router.put   ('/serials/item/:serialId',    ctrl.updateSerial);
router.delete('/serials/item/:serialId',    ctrl.deleteSerial);

// ── Summary route ───────────────────────────────────────────────────────────
router.get('/summary/:productId',           ctrl.getProductInventorySummary);

module.exports = router;
