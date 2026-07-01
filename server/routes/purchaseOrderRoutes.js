const express = require('express');
const router = express.Router();
const {
  createPO,
  getPOs,
  getPO,
  updatePO,
  cancelPO,
  receivePO,
  convertToPurchase,
} = require('../controllers/purchaseOrderController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { requireFeature } = require('../middleware/tierMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.post('/', protect, checkSubscriptionStatus, requirePermission('CREATE_PURCHASE'), requireFeature('erp_purchase_orders'), createPO);
router.get('/', protect, requirePermission('VIEW_PURCHASES'), requireFeature('erp_purchase_orders'), paginationValidation, getPOs);
router.get('/:id', protect, requirePermission('VIEW_PURCHASES'), requireFeature('erp_purchase_orders'), mongoIdValidation(), getPO);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_purchase_orders'), mongoIdValidation(), updatePO);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_purchase_orders'), mongoIdValidation(), cancelPO);
router.post('/:id/receive', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_grn'), mongoIdValidation(), receivePO);
router.post('/:id/convert', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_purchase_orders'), mongoIdValidation(), convertToPurchase);

module.exports = router;