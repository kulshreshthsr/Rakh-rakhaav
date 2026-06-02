const Shop = require('../models/shopModel');

const getShopOrFail = async (userId) => {
  const shop = await Shop.findOne({ owner: userId });
  if (!shop) {
    const err = new Error('Please complete your shop setup before continuing.');
    err.status = 400;
    err.code = 'SHOP_NOT_CONFIGURED';
    throw err;
  }
  return shop;
};

module.exports = { getShopOrFail };
