const express = require('express');
const router  = express.Router();
const {
  createProject, getProjects, getProject, updateProject, closeProject,
  getProjectLedger, getProjectMaterials,
} = require('../controllers/projectController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

// BUGFIX: was gated on 'CREATE_SALE', which does not exist in
// roleModel.js's ALL_PERMISSIONS — same bug class as warehouseRoutes.js.
// Aligned to CREATE_INVOICE, which every sibling module (AMC, service jobs,
// contractors) already uses for its "create" action.
router.post('/',                protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),     createProject);
router.get('/',                 protect, requirePermission('VIEW_SALES'),                               paginationValidation, getProjects);
router.get('/:id',              protect, requirePermission('VIEW_SALES'),                               mongoIdValidation(), getProject);
router.put('/:id',              protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    mongoIdValidation(), updateProject);
router.post('/:id/close',       protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    mongoIdValidation(), closeProject);
router.get('/:id/ledger',       protect, requirePermission('VIEW_SALES'),                               mongoIdValidation(), getProjectLedger);
router.get('/:id/materials',    protect, requirePermission('VIEW_SALES'),                               mongoIdValidation(), getProjectMaterials);

module.exports = router;