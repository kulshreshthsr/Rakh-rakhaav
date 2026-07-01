const express = require('express');
const router  = express.Router();
const { createAMC, getAMCs, getAMC, renewAMC, cancelAMC, logVisit, getExpiringAMCs } = require('../controllers/amcController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { paginationValidation, mongoIdValidation } = require('../middleware/validationMiddleware');

router.get('/expiring',        protect, requirePermission('VIEW_SALES'),                               getExpiringAMCs);
router.get('/',                protect, requirePermission('VIEW_SALES'),                               paginationValidation, getAMCs);
router.get('/:id',             protect, requirePermission('VIEW_SALES'),                               mongoIdValidation(), getAMC);
router.post('/',               protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  createAMC);
router.post('/:id/renew',      protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  mongoIdValidation(), renewAMC);
router.post('/:id/cancel',     protect, checkSubscriptionStatus, requirePermission('MANAGE_SALES'),    mongoIdValidation(), cancelAMC);
router.post('/:id/visit',      protect, checkSubscriptionStatus, requirePermission('CREATE_INVOICE'),  mongoIdValidation(), logVisit);

module.exports = router;