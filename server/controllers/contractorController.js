const Contractor = require('../models/contractorModel');
const Sale       = require('../models/salesModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

// GET /api/contractors
const getContractors = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const contractors = await Contractor.find({ shop: shop._id, isActive: true }).sort({ name: 1 });
    res.json(contractors);
  } catch (err) { logger.error(err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// POST /api/contractors
const createContractor = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const {
      name, phone, gst_no, address,
      contractor_discount, credit_limit,
      site_names, notes,
    } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const contractor = await Contractor.create({
      shop: shop._id, name, phone, gst_no, address,
      contractor_discount: Number(contractor_discount) || 0,
      credit_limit: Number(credit_limit) || 0,
      site_names: Array.isArray(site_names) ? site_names : [],
      notes,
    });
    res.status(201).json(contractor);
  } catch (err) { logger.error(err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// GET /api/contractors/:id
const getContractor = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const contractor = await Contractor.findOne({ _id: req.params.id, shop: shop._id });
    if (!contractor) return res.status(404).json({ message: 'Contractor not found' });
    res.json(contractor);
  } catch (err) { logger.error(err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// PATCH /api/contractors/:id
const updateContractor = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const contractor = await Contractor.findOne({ _id: req.params.id, shop: shop._id });
    if (!contractor) return res.status(404).json({ message: 'Contractor not found' });
    const allowed = ['name','phone','gst_no','address','contractor_discount','credit_limit','site_names','notes','isActive'];
    allowed.forEach(key => { if (req.body[key] !== undefined) contractor[key] = req.body[key]; });
    await contractor.save();
    res.json(contractor);
  } catch (err) { logger.error(err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// GET /api/contractors/:id/sales
const getContractorSales = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const contractor = await Contractor.findOne({ _id: req.params.id, shop: shop._id });
    if (!contractor) return res.status(404).json({ message: 'Contractor not found' });

    const sales = await Sale.find({
      shop: shop._id,
      $or: [
        { 'extra_fields.contractor_id': String(req.params.id) },
        { buyer_name: contractor.name },
      ],
    }).sort({ createdAt: -1 }).limit(50);
    res.json(sales);
  } catch (err) { logger.error(err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// POST /api/contractors/:id/payment — record payment, reduce outstanding
const recordPayment = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const contractor = await Contractor.findOne({ _id: req.params.id, shop: shop._id });
    if (!contractor) return res.status(404).json({ message: 'Contractor not found' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid payment amount required' });

    contractor.current_outstanding = Math.max(0, contractor.current_outstanding - amount);
    await contractor.save();

    res.json({ message: 'Payment recorded', contractor });
  } catch (err) { logger.error(err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

module.exports = { getContractors, createContractor, getContractor, updateContractor, getContractorSales, recordPayment };
