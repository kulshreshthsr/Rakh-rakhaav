const Income = require('../models/incomeModel');
const Shop = require('../models/shopModel');
const { cloneForAudit, logAuditEvent } = require('../utils/auditTrail');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getIncome = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const income = await Income.find({ shop: shop._id }).sort({ date: -1 });
    res.json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateIncome = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const income = await Income.findOne({ _id: req.params.id, shop: shop._id });
    if (!income) return res.status(404).json({ message: 'Income entry not found' });
    if (!req.body.source) return res.status(400).json({ message: 'Income source is required' });
    if (Number(req.body.amount) <= 0) return res.status(400).json({ message: 'Income amount must be greater than zero' });
    if (!req.body.payment_mode) return res.status(400).json({ message: 'Income payment mode is required' });

    const updatedIncome = await Income.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      {
        $set: {
          source: req.body.source,
          category: req.body.category || 'other_income',
          amount: Number(req.body.amount),
          payment_mode: req.body.payment_mode,
          reference_id: req.body.reference_id || '',
          note: req.body.note || '',
          date: req.body.date || income.date,
        },
      },
      { new: true }
    );

    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'update',
      entity: 'income',
      entityId: updatedIncome._id,
      referenceId: updatedIncome.reference_id,
      beforeValue: income,
      afterValue: updatedIncome,
    });

    res.json(updatedIncome);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createIncome = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    if (!req.body.source) return res.status(400).json({ message: 'Income source is required' });
    if (Number(req.body.amount) <= 0) return res.status(400).json({ message: 'Income amount must be greater than zero' });
    if (!req.body.payment_mode) return res.status(400).json({ message: 'Income payment mode is required' });
    const income = await Income.create({
      shop: shop._id,
      source: req.body.source,
      category: req.body.category || 'other_income',
      amount: Number(req.body.amount),
      payment_mode: req.body.payment_mode,
      reference_id: req.body.reference_id || '',
      note: req.body.note || '',
      date: req.body.date || Date.now(),
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'income',
      entityId: income._id,
      referenceId: income.reference_id,
      afterValue: income,
    });
    res.status(201).json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteIncome = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const income = await Income.findOne({ _id: req.params.id, shop: shop._id });
    if (!income) return res.status(404).json({ message: 'Income entry not found' });
    await Income.deleteOne({ _id: req.params.id, shop: shop._id });
    if (income) {
      await logAuditEvent({
        shopId: income.shop,
        userId: req.user.id,
        actionType: 'delete',
        entity: 'income',
        entityId: income._id,
        referenceId: income.reference_id,
        beforeValue: cloneForAudit(income),
      });
    }
    res.json({ message: 'Income deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
};
