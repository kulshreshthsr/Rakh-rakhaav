const Expense = require('../models/expenseModel');
const Shop = require('../models/shopModel');

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

const createExpense = async (req, res) => {
  const { category, amount, note, date } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const expense = await Expense.create({ shop: shop._id, category, amount, note, date: date || Date.now() });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getExpenses, createExpense, deleteExpense };