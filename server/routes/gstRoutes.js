const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { generateGSTR1, generateGSTR3B, validateGSTINEndpoint, getFilingPeriodInfo } = require('../controllers/gstController');

router.get('/gstr1',          protect, requirePermission('VIEW_GST'), generateGSTR1);
router.get('/gstr3b',         protect, requirePermission('VIEW_GST'), generateGSTR3B);
router.get('/filing-period',  protect, requirePermission('VIEW_GST'), getFilingPeriodInfo);
router.post('/validate-gstin', protect, validateGSTINEndpoint);

module.exports = router;
