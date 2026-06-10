const express = require('express');
const router  = express.Router();
const {
  createProject, getProjects, getProject, updateProject, closeProject,
  getProjectLedger, getProjectMaterials,
} = require('../controllers/projectController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.post('/',                protect, checkSubscriptionStatus, requirePermission('CREATE_SALE'),     createProject);
router.get('/',                 protect, requirePermission('VIEW_SALES'),                               getProjects);
router.get('/:id',              protect, requirePermission('VIEW_SALES'),                               getProject);
router.put('/:id',              protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    updateProject);
router.post('/:id/close',       protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    closeProject);
router.get('/:id/ledger',       protect, requirePermission('VIEW_SALES'),                               getProjectLedger);
router.get('/:id/materials',    protect, requirePermission('VIEW_SALES'),                               getProjectMaterials);

module.exports = router;
