const Shop = require('../models/shopModel');
const { generateAccountingSummary } = require('../services/accountingService');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getAccountingSummary = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const summary = await generateAccountingSummary({
      shopId: shop._id,
      from: req.query.from || null,
      to: req.query.to || null,
    });
    summary.cash_account.opening_balance = Number((Number(shop.cash_opening_balance || 0) + Number(summary.cash_account.opening_balance || 0)).toFixed(2));
    summary.cash_account.closing_balance = Number((summary.cash_account.opening_balance + summary.cash_account.total_inflow - summary.cash_account.total_outflow).toFixed(2));
    summary.bank_account.opening_balance = Number((Number(shop.bank_opening_balance || 0) + Number(summary.bank_account.opening_balance || 0)).toFixed(2));
    summary.bank_account.closing_balance = Number((summary.bank_account.opening_balance + summary.bank_account.total_inflow - summary.bank_account.total_outflow).toFixed(2));

    let cashRunning = summary.cash_account.opening_balance;
    summary.cash_account.transactions = summary.cash_account.transactions.map((entry) => {
      cashRunning = Number((cashRunning + entry.inflow - entry.outflow).toFixed(2));
      return { ...entry, running_balance: cashRunning };
    });
    let bankRunning = summary.bank_account.opening_balance;
    summary.bank_account.transactions = summary.bank_account.transactions.map((entry) => {
      bankRunning = Number((bankRunning + entry.inflow - entry.outflow).toFixed(2));
      return { ...entry, running_balance: bankRunning };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAccountingSummary,
};
