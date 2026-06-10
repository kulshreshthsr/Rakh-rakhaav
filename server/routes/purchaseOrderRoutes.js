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

router.post('/', protect, checkSubscriptionStatus, requirePermission('CREATE_PURCHASE'), requireFeature('erp_purchase_orders'), createPO);
router.get('/', protect, requirePermission('VIEW_PURCHASES'), requireFeature('erp_purchase_orders'), getPOs);
router.get('/:id', protect, requirePermission('VIEW_PURCHASES'), requireFeature('erp_purchase_orders'), getPO);
router.put('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_purchase_orders'), updatePO);
router.delete('/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_purchase_orders'), cancelPO);
router.post('/:id/receive', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_grn'), receivePO);
router.post('/:id/convert', protect, checkSubscriptionStatus, requirePermission('MANAGE_PURCHASES'), requireFeature('erp_purchase_orders'), convertToPurchase);

module.exports = router;
