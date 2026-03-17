const Customer = require('../models/customerModel');
const Udhaar = require('../models/udhaarModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getCustomers = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customers = await Customer.find({ shop: shop._id }).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createCustomer = async (req, res) => {
  const { name, phone } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const customer = await Customer.create({ shop: shop._id, name, phone });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    await Udhaar.deleteMany({ customer: req.params.id });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUdhaar = async (req, res) => {
  try {
    const entries = await Udhaar.find({ customer: req.params.id }).sort({ date: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addUdhaar = async (req, res) => {
  const { type, amount, note, date } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const entry = await Udhaar.create({
      shop: shop._id,
      customer: req.params.id,
      type, amount, note, date,
    });

    const multiplier = type === 'diya' ? amount : -amount;
    await Customer.findByIdAndUpdate(req.params.id, {
      $inc: { totalUdhaar: multiplier }
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const settleUdhaar = async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { totalUdhaar: 0 });
    await Udhaar.deleteMany({ customer: req.params.id });
    res.json({ message: 'Udhaar settled!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCustomers, createCustomer, deleteCustomer, getUdhaar, addUdhaar, settleUdhaar };