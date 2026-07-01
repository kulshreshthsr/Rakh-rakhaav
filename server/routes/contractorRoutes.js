const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');
const {
  getContractors, createContractor, getContractor,
  updateContractor, getContractorSales, recordPayment,
} = require('../controllers/contractorController');

router.get('/',           protect, requirePermission('VIEW_SALES'),     paginationValidation, getContractors);
router.post('/',          protect, requirePermission('CREATE_INVOICE'), createContractor);
router.get('/:id',        protect, requirePermission('VIEW_SALES'),     mongoIdValidation(), getContractor);
router.patch('/:id',      protect, requirePermission('CREATE_INVOICE'), mongoIdValidation(), updateContractor);
router.get('/:id/sales',  protect, requirePermission('VIEW_SALES'),     mongoIdValidation(), getContractorSales);
router.post('/:id/payment', protect, requirePermission('CREATE_INVOICE'), mongoIdValidation(), recordPayment);

module.exports = router;