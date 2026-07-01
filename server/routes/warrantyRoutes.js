const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { mongoIdValidation } = require('../middleware/validationMiddleware');
const { getClaims, createClaim, getBySerial, updateClaim } = require('../controllers/warrantyController');

// NOTE: /serial/:sn is a serial/IMEI string, not a Mongo ObjectId — no
// mongoIdValidation on that one, it would incorrectly reject valid serials.
router.get('/serial/:sn', protect, requirePermission('VIEW_SALES'), getBySerial);
router.get('/',           protect, requirePermission('VIEW_SALES'), getClaims);
router.post('/',          protect, requirePermission('CREATE_INVOICE'), createClaim);
router.patch('/:id',      protect, requirePermission('CREATE_INVOICE'), mongoIdValidation(), updateClaim);

module.exports = router;