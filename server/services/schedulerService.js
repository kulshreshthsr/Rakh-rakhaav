const cron = require('node-cron');
const logger = require('../utils/logger');
const ruleEngine = require('./ruleEngine');
const Shop = require('../models/shopModel');

function initScheduler() {
  // Every 4 hours: run inventory + workflow rules for all active shops
  cron.schedule('0 */4 * * *', async () => {
    logger.info('[scheduler] Running inventory rules for all shops');
    try {
      const shops = await Shop.find({ isActive: true }).select('_id businessType').lean();
      for (const shop of shops) {
        await ruleEngine.scanShop(shop._id, shop.businessType || 'general').catch(() => {});
      }
    } catch (err) {
      logger.error('[scheduler] inventory scan error:', err.message);
    }
  });

  // Every morning at 9 AM: customer dues aging + AMC expiry
  cron.schedule('0 9 * * *', async () => {
    logger.info('[scheduler] Running customer dues + AMC expiry rules');
    try {
      await ruleEngine.runCustomerDuesRules();
      await ruleEngine.runAMCExpiryRules();
    } catch (err) {
      logger.error('[scheduler] morning rules error:', err.message);
    }
  });

  logger.info('[scheduler] Cron jobs initialized');
}

module.exports = { initScheduler };
