const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const {
  getContractors, createContractor, getContractor,
  updateContractor, getContractorSales, recordPayment,
} = require('../controllers/contractorController');

router.get('/',           protect, requirePermission('VIEW_SALES'),    getContractors);
router.post('/',          protect, requirePermission('CREATE_INVOICE'), createContractor);
router.get('/:id',        protect, requirePermission('VIEW_SALES'),    getContractor);
router.patch('/:id',      protect, requirePermission('CREATE_INVOICE'), updateContractor);
router.get('/:id/sales',  protect, requirePermission('VIEW_SALES'),    getContractorSales);
router.post('/:id/payment', protect, requirePermission('CREATE_INVOICE'), recordPayment);

module.exports = router;
