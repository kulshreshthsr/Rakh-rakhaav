const Shop = require('../models/shopModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const updateExpenseBudgets = async (req, res) => {
  const { expense_budgets } = req.body;
  try {
    const shop = await getShopOrFail(req.user.id);

    if (!Array.isArray(expense_budgets))
      return res.status(400).json({ message: 'expense_budgets must be an array' });

    const validated = expense_budgets
      .filter(b => b.category && typeof b.monthly_limit === 'number' && b.monthly_limit >= 0)
      .map(b => ({ category: String(b.category), monthly_limit: Number(b.monthly_limit) }));

    await Shop.findByIdAndUpdate(shop._id, { $set: { expense_budgets: validated } });

    res.json({ success: true, expense_budgets: validated });
  } catch (err) {
    logger.error('[shopController.updateExpenseBudgets]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { updateExpenseBudgets };
