const Expense = require('../models/expenseModel');
const Shop = require('../models/shopModel');
const { cloneForAudit, logAuditEvent } = require('../utils/auditTrail');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getExpenses = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const expenses = await Expense.find({ shop: shop._id }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateExpense = async (req, res) => {
  const { category, amount, note, date, payment_mode, reference_id } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const existingExpense = await Expense.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingExpense) return res.status(404).json({ message: 'Expense not found' });
    if (!category) return res.status(400).json({ message: 'Expense category is required' });
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Expense amount must be greater than zero' });
    if (!payment_mode) return res.status(400).json({ message: 'Expense payment mode is required' });

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      {
        $set: {
          category,
          amount: Number(amount),
          note: note || '',
          date: date || existingExpense.date,
          payment_mode,
          reference_id: reference_id || '',
        },
      },
      { new: true }
    );

    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'update',
      entity: 'expense',
      entityId: expense._id,
      referenceId: expense.reference_id,
      beforeValue: existingExpense,
      afterValue: expense,
    });

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createExpense = async (req, res) => {
  const { category, amount, note, date, payment_mode, reference_id } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    if (!category) return res.status(400).json({ message: 'Expense category is required' });
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Expense amount must be greater than zero' });
    if (!payment_mode) return res.status(400).json({ message: 'Expense payment mode is required' });
    const expense = await Expense.create({
      shop: shop._id,
      category,
      amount: Number(amount),
      note,
      date: date || Date.now(),
      payment_mode,
      reference_id: reference_id || '',
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'expense',
      entityId: expense._id,
      referenceId: expense.reference_id,
      afterValue: expense,
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const existingExpense = await Expense.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingExpense) return res.status(404).json({ message: 'Expense not found' });
    await Expense.deleteOne({ _id: req.params.id, shop: shop._id });
    if (existingExpense) {
      await logAuditEvent({
        shopId: existingExpense.shop,
        userId: req.user.id,
        actionType: 'delete',
        entity: 'expense',
        entityId: existingExpense._id,
        referenceId: existingExpense.reference_id,
        beforeValue: cloneForAudit(existingExpense),
      });
    }
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
