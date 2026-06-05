const Expense = require('../models/expenseModel');
const { cloneForAudit, logAuditEvent } = require('../utils/auditTrail');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const MAX_AMOUNT = 10_00_00_000; // ₹10 crore upper bound

const getExpenses = async (req, res) => {
  try {
    const shop     = await getShopOrFail(req.user.id);
    const expenses = await Expense.find({ shop: shop._id }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    logger.error('[expenseController.getExpenses]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const createExpense = async (req, res) => {
  const {
    category, amount, note, date, payment_mode, reference_id,
    is_recurring, frequency, next_due_date, recurring_parent_id,
    is_recurring_template, is_tax_deductible,
  } = req.body;
  try {
    const shop = await getShopOrFail(req.user.id);
    if (!category)
      return res.status(400).json({ message: 'Category चुनें।' });
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ message: 'Amount ₹0 से ज़्यादा होना चाहिए।' });
    if (Number(amount) > MAX_AMOUNT)
      return res.status(400).json({ message: '₹10 करोड़ से ज़्यादा का amount नहीं चलेगा। एक बार check करें।' });
    if (!payment_mode)
      return res.status(400).json({ message: 'Payment mode चुनें।' });

    const expense = await Expense.create({
      shop:                  shop._id,
      category,
      amount:                Number(amount),
      note:                  note || '',
      date:                  date || Date.now(),
      payment_mode,
      reference_id:          reference_id || '',
      is_recurring:          !!is_recurring,
      frequency:             is_recurring ? (frequency || null) : null,
      next_due_date:         is_recurring ? (next_due_date || null) : null,
      recurring_parent_id:   recurring_parent_id || null,
      is_recurring_template: !!is_recurring_template,
      is_tax_deductible:     !!is_tax_deductible,
    });

    await logAuditEvent({
      shopId:      shop._id,
      userId:      req.user.id,
      actionType:  'create',
      entity:      'expense',
      entityId:    expense._id,
      referenceId: expense.reference_id,
      afterValue:  expense,
    });

    res.status(201).json(expense);
  } catch (err) {
    logger.error('[expenseController.createExpense]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateExpense = async (req, res) => {
  const {
    category, amount, note, date, payment_mode, reference_id,
    is_recurring, frequency, next_due_date, recurring_parent_id,
    is_recurring_template, is_tax_deductible,
  } = req.body;
  try {
    const shop            = await getShopOrFail(req.user.id);
    const existingExpense = await Expense.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingExpense)
      return res.status(404).json({ message: 'खर्च record नहीं मिला।' });
    if (!category)
      return res.status(400).json({ message: 'Category चुनें।' });
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ message: 'Amount ₹0 से ज़्यादा होना चाहिए।' });
    if (Number(amount) > MAX_AMOUNT)
      return res.status(400).json({ message: '₹10 करोड़ से ज़्यादा का amount नहीं चलेगा। एक बार check करें।' });
    if (!payment_mode)
      return res.status(400).json({ message: 'Payment mode चुनें।' });

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      {
        $set: {
          category,
          amount:                Number(amount),
          note:                  note || '',
          date:                  date || existingExpense.date,
          payment_mode,
          reference_id:          reference_id || '',
          is_recurring:          !!is_recurring,
          frequency:             is_recurring ? (frequency || null) : null,
          next_due_date:         is_recurring ? (next_due_date || null) : null,
          recurring_parent_id:   recurring_parent_id || null,
          is_recurring_template: !!is_recurring_template,
          is_tax_deductible:     !!is_tax_deductible,
        },
      },
      { new: true }
    );

    await logAuditEvent({
      shopId:      shop._id,
      userId:      req.user.id,
      actionType:  'update',
      entity:      'expense',
      entityId:    expense._id,
      referenceId: expense.reference_id,
      beforeValue: existingExpense,
      afterValue:  expense,
    });

    res.json(expense);
  } catch (err) {
    logger.error('[expenseController.updateExpense]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const shop            = await getShopOrFail(req.user.id);
    const existingExpense = await Expense.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingExpense)
      return res.status(404).json({ message: 'खर्च record नहीं मिला।' });

    await Expense.deleteOne({ _id: req.params.id, shop: shop._id });

    await logAuditEvent({
      shopId:      existingExpense.shop,
      userId:      req.user.id,
      actionType:  'delete',
      entity:      'expense',
      entityId:    existingExpense._id,
      referenceId: existingExpense.reference_id,
      beforeValue: cloneForAudit(existingExpense),
    });

    res.json({ message: 'खर्च delete हो गया।' });
  } catch (err) {
    logger.error('[expenseController.deleteExpense]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
