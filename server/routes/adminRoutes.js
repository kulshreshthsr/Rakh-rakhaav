const express = require('express');
const { listAdminShops, getAdminStats, deleteAdminShop } = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/shops', protectAdmin, listAdminShops);
router.delete('/shops/:id', protectAdmin, deleteAdminShop);
router.get('/stats', protectAdmin, getAdminStats);

module.exports = router;
