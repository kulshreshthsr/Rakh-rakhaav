const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getStylists, createStylist, updateStylist, deactivateStylist } = require('../controllers/stylistController');

router.get('/',        protect, getStylists);
router.post('/',       protect, createStylist);
router.patch('/:id',   protect, updateStylist);
router.delete('/:id',  protect, deactivateStylist);

module.exports = router;
