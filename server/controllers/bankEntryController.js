const BankEntry = require('../models/bankEntryModel');
const Shop = require('../models/shopModel');
const { cloneForAudit, logAuditEvent } = require('../utils/auditTrail');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getBankEntries = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const entries = await BankEntry.find({ shop: shop._id }).sort({ date: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBankEntry = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const entry = await BankEntry.findOne({ _id: req.params.id, shop: shop._id });
    if (!entry) return res.status(404).json({ message: 'Bank entry not found' });
    if (!req.body.entry_type) return res.status(400).json({ message: 'Bank entry type is required' });
    if (Number(req.body.amount) <= 0) return res.status(400).json({ message: 'Bank entry amount must be greater than zero' });

    const updatedEntry = await BankEntry.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      {
        $set: {
          entry_type: req.body.entry_type,
          amount: Number(req.body.amount),
          reference_id: req.body.reference_id || '',
          note: req.body.note || '',
          date: req.body.date || entry.date,
        },
      },
      { new: true }
    );

    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'update',
      entity: 'bank_entry',
      entityId: updatedEntry._id,
      referenceId: updatedEntry.reference_id,
      beforeValue: entry,
      afterValue: updatedEntry,
    });

    res.json(updatedEntry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBankEntry = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    if (!req.body.entry_type) return res.status(400).json({ message: 'Bank entry type is required' });
    if (Number(req.body.amount) <= 0) return res.status(400).json({ message: 'Bank entry amount must be greater than zero' });
    const entry = await BankEntry.create({
      shop: shop._id,
      entry_type: req.body.entry_type,
      amount: Number(req.body.amount),
      reference_id: req.body.reference_id || '',
      note: req.body.note || '',
      date: req.body.date || Date.now(),
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'bank_entry',
      entityId: entry._id,
      referenceId: entry.reference_id,
      afterValue: entry,
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteBankEntry = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const entry = await BankEntry.findOne({ _id: req.params.id, shop: shop._id });
    if (!entry) return res.status(404).json({ message: 'Bank entry not found' });
    await BankEntry.deleteOne({ _id: req.params.id, shop: shop._id });
    if (entry) {
      await logAuditEvent({
        shopId: entry.shop,
        userId: req.user.id,
        actionType: 'delete',
        entity: 'bank_entry',
        entityId: entry._id,
        referenceId: entry.reference_id,
        beforeValue: cloneForAudit(entry),
      });
    }
    res.json({ message: 'Bank entry deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBankEntries,
  createBankEntry,
  updateBankEntry,
  deleteBankEntry,
};
