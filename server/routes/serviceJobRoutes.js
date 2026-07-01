const express = require('express');
const router  = express.Router();
const {
  createJob, getJobs, getJob, updateJobStatus, addPart, getJobCard, markDelivered,
} = require('../controllers/serviceJobController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.get('/',                    protect, requirePermission('VIEW_SALES'),                               paginationValidation, getJobs);
router.get('/:id',                 protect, requirePermission('VIEW_SALES'),                               mongoIdValidation(), getJob);
router.get('/:id/job-card',        protect, requirePermission('VIEW_SALES'),                               mongoIdValidation(), getJobCard);
router.post('/',                   protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  createJob);
router.patch('/:id/status',        protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  mongoIdValidation(), updateJobStatus);
router.post('/:id/parts',          protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  mongoIdValidation(), addPart);
router.post('/:id/deliver',        protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    mongoIdValidation(), markDelivered);

module.exports = router;