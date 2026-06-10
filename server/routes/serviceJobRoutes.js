const express = require('express');
const router  = express.Router();
const {
  createJob, getJobs, getJob, updateJobStatus, addPart, getJobCard, markDelivered,
} = require('../controllers/serviceJobController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');

router.get('/',                    protect, requirePermission('VIEW_SALES'),                               getJobs);
router.get('/:id',                 protect, requirePermission('VIEW_SALES'),                               getJob);
router.get('/:id/job-card',        protect, requirePermission('VIEW_SALES'),                               getJobCard);
router.post('/',                   protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  createJob);
router.patch('/:id/status',        protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  updateJobStatus);
router.post('/:id/parts',          protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  addPart);
router.post('/:id/deliver',        protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    markDelivered);

module.exports = router;
