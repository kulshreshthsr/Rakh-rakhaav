const Customer = require('../models/customerModel');
const Udhaar = require('../models/udhaarModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

// ── GET ALL CUSTOMERS ────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customers = await Customer.find({
      shop: shop._id,
      isActive: { $ne: false },
    }).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CREATE CUSTOMER ──────────────────────────────────────────────────────────
const createCustomer = async (req, res) => {
  const { name, phone, email, address, gstin, notes } = req.body;
  try {
    if (!name) return res.status(400).json({ message: 'Customer name is required' });
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.create({
      shop: shop._id,
      name, phone, email, address, gstin, notes,
    });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE CUSTOMER ──────────────────────────────────────────────────────────
const updateCustomer = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { $set: req.body },
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE CUSTOMER (soft) ───────────────────────────────────────────────────
const deleteCustomer = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Warn if balance still due
    if (customer.totalUdhaar > 0) {
      return res.status(400).json({
        message: `Customer ka ₹${customer.totalUdhaar.toFixed(2)} udhaar baaki hai. Pehle settle karo.`,
      });
    }

    // Soft delete
    await Customer.findOneAndUpdate({ _id: req.params.id, shop: shop._id }, { isActive: false });
    res.json({ message: 'Customer removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET UDHAAR LEDGER ────────────────────────────────────────────────────────
const getUdhaar = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const entries = await Udhaar.find({
      shop: shop._id,
      customer: req.params.id,
    }).sort({ date: -1 });
    res.json({ customer, entries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ADD MANUAL UDHAAR ENTRY ──────────────────────────────────────────────────
const addUdhaar = async (req, res) => {
  const { type, amount, note, date } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Normalise legacy 'diya'/'liya' to 'debit'/'credit'
    const normalType = type === 'diya' ? 'debit' : type === 'liya' ? 'credit' : type;

    // Update customer balance
    if (normalType === 'debit') {
      customer.totalSales = parseFloat((customer.totalSales + Number(amount)).toFixed(2));
    } else {
      customer.totalPaid = parseFloat((customer.totalPaid + Number(amount)).toFixed(2));
    }
    customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
    await customer.save();

    const entry = await Udhaar.create({
      shop: shop._id,
      customer: req.params.id,
      type: normalType,
      amount: Number(amount),
      running_balance: customer.totalUdhaar,
      note,
      date: date || new Date(),
      reference_type: 'manual',
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── SETTLE / PARTIAL PAYMENT ─────────────────────────────────────────────────
// Replaces old settleUdhaar that wiped everything
const settlePayment = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const payAmount = parseFloat(Number(amount).toFixed(2));
    if (payAmount <= 0) return res.status(400).json({ message: 'Amount must be positive' });
    if (payAmount > customer.totalUdhaar) {
      return res.status(400).json({ message: 'Payment exceeds balance due' });
    }

    // Update customer balance
    customer.totalPaid = parseFloat((customer.totalPaid + payAmount).toFixed(2));
    customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
    await customer.save();

    // Ledger entry: credit (customer paid)
    await Udhaar.create({
      shop: shop._id,
      customer: req.params.id,
      type: 'credit',
      amount: payAmount,
      running_balance: customer.totalUdhaar,
      note: note || 'Payment received',
      date: new Date(),
      reference_type: 'manual',
    });

    res.json({
      message: 'Payment recorded ✅',
      balanceDue: customer.totalUdhaar,
      customer,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getUdhaar,
  addUdhaar,
  settlePayment,
};
