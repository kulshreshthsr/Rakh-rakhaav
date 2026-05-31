const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { getITCRegister, getITCSummary } = require('../controllers/itcController');

router.get('/register', protect, requirePermission('VIEW_GST'), getITCRegister);
router.get('/summary',  protect, requirePermission('VIEW_GST'), getITCSummary);

module.exports = router;
