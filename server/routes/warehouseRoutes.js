const express = require('express');
const router  = express.Router();
const {
  createWarehouse, getWarehouses, updateWarehouse, deactivateWarehouse,
  getWarehouseStock, createTransfer, getTransfers, confirmTransfer, cancelTransfer,
} = require('../controllers/warehouseController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

// BUGFIX: was gated on 'MANAGE_PRODUCTS' / 'VIEW_PRODUCTS', which do not
// exist anywhere in roleModel.js's ALL_PERMISSIONS. That meant every
// warehouse route was unreachable for every sub-user (Manager included) —
// only the owner account (which bypasses permission checks) could ever use
// warehouses. Swapped to MANAGE_INVENTORY, matching inventoryRoutes.js's
// convention for the same domain.
router.post('/',                    protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'),  createWarehouse);
router.get('/',                     protect, requirePermission('MANAGE_INVENTORY'),                           paginationValidation, getWarehouses);
router.put('/:id',                  protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'),  mongoIdValidation(), updateWarehouse);
router.delete('/:id',               protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'),  mongoIdValidation(), deactivateWarehouse);
router.get('/:id/stock',            protect, requirePermission('MANAGE_INVENTORY'),                           mongoIdValidation(), getWarehouseStock);

router.post('/transfers',           protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'),  createTransfer);
router.get('/transfers',            protect, requirePermission('MANAGE_INVENTORY'),                           paginationValidation, getTransfers);
router.post('/transfers/:id/confirm', protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), mongoIdValidation(), confirmTransfer);
router.post('/transfers/:id/cancel',  protect, checkSubscriptionStatus, requirePermission('MANAGE_INVENTORY'), mongoIdValidation(), cancelTransfer);

module.exports = router;