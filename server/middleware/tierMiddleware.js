const Shop = require('../models/shopModel');
const { isFeatureEnabled } = require('../lib/tierConfig.backend');

function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const shop = await Shop.findOne({ owner: req.user.id }).select('businessTier businessType').lean();
      if (!shop) return res.status(404).json({ message: 'Shop not found' });

      const tier     = shop.businessTier  || 'nano';
      const industry = shop.businessType  || 'general';

      if (!isFeatureEnabled(feature, tier, industry)) {
        return res.status(403).json({
          message: 'यह feature आपके current setup में available नहीं है।',
          code:    'FEATURE_NOT_IN_TIER',
          feature,
          currentTier: tier,
        });
      }
      next();
    } catch (err) {
      res.status(500).json({ message: 'Something went wrong' });
    }
  };
}

module.exports = { requireFeature };
