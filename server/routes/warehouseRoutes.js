const express = require('express');
const router  = express.Router();
const {
  createWarehouse, getWarehouses, updateWarehouse, deactivateWarehouse,
  getWarehouseStock, createTransfer, getTransfers, confirmTransfer, cancelTransfer,
} = require('../controllers/warehouseController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.post('/',                    protect, checkSubscriptionStatus, requirePermission('MANAGE_PRODUCTS'),  createWarehouse);
router.get('/',                     protect, requirePermission('VIEW_PRODUCTS'),                             getWarehouses);
router.put('/:id',                  protect, checkSubscriptionStatus, requirePermission('MANAGE_PRODUCTS'),  updateWarehouse);
router.delete('/:id',               protect, checkSubscriptionStatus, requirePermission('MANAGE_PRODUCTS'),  deactivateWarehouse);
router.get('/:id/stock',            protect, requirePermission('VIEW_PRODUCTS'),                             getWarehouseStock);

router.post('/transfers',           protect, checkSubscriptionStatus, requirePermission('MANAGE_PRODUCTS'),  createTransfer);
router.get('/transfers',            protect, requirePermission('VIEW_PRODUCTS'),                             getTransfers);
router.post('/transfers/:id/confirm', protect, checkSubscriptionStatus, requirePermission('MANAGE_PRODUCTS'), confirmTransfer);
router.post('/transfers/:id/cancel',  protect, checkSubscriptionStatus, requirePermission('MANAGE_PRODUCTS'), cancelTransfer);

module.exports = router;
