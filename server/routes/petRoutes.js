const express = require('express');
const router  = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { getPets, getPetsByOwnerPhone, createPet, updatePet, addVaccination } = require('../controllers/petController');

router.get('/owner',      protect, requirePermission('VIEW_SALES'),        getPetsByOwnerPhone);
router.get('/',           protect, requirePermission('VIEW_SALES'),        getPets);
router.post('/',          protect, requirePermission('CREATE_INVOICE'),    createPet);
router.patch('/:id',      protect, requirePermission('CREATE_INVOICE'),    updatePet);
router.post('/:id/vaccinate', protect, requirePermission('CREATE_INVOICE'), addVaccination);

module.exports = router;
