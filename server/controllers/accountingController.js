const { generateAccountingSummary, generatePLStatement } = require('../services/accountingService');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const getAccountingSummary = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
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
    if (error.code === 'SHOP_NOT_CONFIGURED') return res.status(400).json({ code: error.code, message: error.message });
    logger.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getPLStatement = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const statement = await generatePLStatement({
      shopId: shop._id,
      from:   req.query.from || null,
      to:     req.query.to   || null,
    });
    res.json(statement);
  } catch (error) {
    if (error.code === 'SHOP_NOT_CONFIGURED')
      return res.status(400).json({ code: error.code, message: error.message });
    logger.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  getAccountingSummary,
  getPLStatement,
};
