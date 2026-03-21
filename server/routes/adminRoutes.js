const express = require('express');
const { listAdminShops, getAdminStats } = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/shops', protectAdmin, listAdminShops);
router.get('/stats', protectAdmin, getAdminStats);

module.exports = router;
