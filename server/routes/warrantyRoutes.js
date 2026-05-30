const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { getClaims, createClaim, getBySerial, updateClaim } = require('../controllers/warrantyController');

router.get('/serial/:sn', protect, requirePermission('VIEW_SALES'), getBySerial);
router.get('/',           protect, requirePermission('VIEW_SALES'), getClaims);
router.post('/',          protect, requirePermission('CREATE_INVOICE'), createClaim);
router.patch('/:id',      protect, requirePermission('CREATE_INVOICE'), updateClaim);

module.exports = router;
