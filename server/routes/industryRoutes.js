const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Shop = require('../models/shopModel');
const { getIndustryConfig, listIndustries } = require('../config/industries');

// GET /api/industry/config — returns the config for the authenticated user's shop
router.get('/config', protect, async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id }).select('businessType');
    const businessType = shop?.businessType || 'general';
    res.json({ businessType, config: getIndustryConfig(businessType) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// GET /api/industry/list — returns all available industry options (for onboarding)
router.get('/list', protect, (req, res) => {
  const list = listIndustries().map(({ id, label, labelHindi, icon }) => ({
    id, label, labelHindi, icon,
  }));
  res.json(list);
});

module.exports = router;
