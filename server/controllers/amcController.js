const AMC = require('../models/amcModel');
const Customer = require('../models/customerModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const getFinancialYear = (date = new Date()) => {
  const year  = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const generateAmcNumber = async (shopId) => {
  const fy  = getFinancialYear();
  const seq = await DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'amc', financial_year: fy },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `AMC/${fy}/${String(seq.last_number).padStart(4, '0')}`;
};

// ── CREATE ────────────────────────────────────────────────────────────────────

const createAMC = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const {
      customer: customerId, customer_name, customer_phone,
      product_name, product_brand, serial_number, model_number,
      amc_start_date, amc_end_date, amc_amount,
      payment_status, visits_included, notes,
    } = req.body;

    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });
    if (!product_name)  return res.status(400).json({ message: 'Product name is required' });
    if (!amc_start_date || !amc_end_date) return res.status(400).json({ message: 'Start and end dates are required' });

    let resolvedCustomerName = customer_name;
    let resolvedPhone = customer_phone || '';
    if (customerId) {
      const cust = await Customer.findOne({ _id: customerId, shop: shop._id }).select('name phone').lean();
      if (!cust) return res.status(404).json({ message: 'Customer not found' });
      resolvedCustomerName = cust.name;
      resolvedPhone = cust.phone || resolvedPhone;
    }

    const amcNumber = await generateAmcNumber(shop._id);
    const amc = await AMC.create({
      shop: shop._id,
      amc_number: amcNumber,
      customer: customerId || null,
      customer_name: resolvedCustomerName,
      customer_phone: resolvedPhone,
      product_name, product_brand: product_brand || '',
      serial_number: serial_number || '',
      model_number:  model_number  || '',
      amc_start_date: new Date(amc_start_date),
      amc_end_date:   new Date(amc_end_date),
      amc_amount:     Number(amc_amount) || 0,
      payment_status: payment_status || 'unpaid',
      visits_included: Number(visits_included) || 0,
      notes: notes || '',
      status: 'active',
    });

    return res.status(201).json(amc);
  } catch (err) {
    logger.error('[amcController:createAMC]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── LIST ──────────────────────────────────────────────────────────────────────

const getAMCs = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { status, customer, search, cursor, limit: limitParam } = req.query;

    const filter = { shop: shop._id };
    if (status && status !== 'all') filter.status = status;
    if (customer) filter.customer = customer;
    if (cursor) filter._id = { $lt: cursor };
    if (search) {
      filter.$or = [
        { customer_name: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } },
        { product_name:   { $regex: search, $options: 'i' } },
        { serial_number:  { $regex: search, $options: 'i' } },
        { amc_number:     { $regex: search, $options: 'i' } },
      ];
    }

    const pageSize = Math.min(Number(limitParam) || 50, 200);
    const amcs = await AMC.find(filter)
      .sort({ amc_end_date: 1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = amcs.length > pageSize;
    const page    = hasMore ? amcs.slice(0, pageSize) : amcs;
    return res.json({ amcs: page, hasMore, nextCursor: hasMore ? String(page[page.length - 1]._id) : null });
  } catch (err) {
    logger.error('[amcController:getAMCs]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── SINGLE ────────────────────────────────────────────────────────────────────

const getAMC = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const amc  = await AMC.findOne({ _id: req.params.id, shop: shop._id })
      .populate('customer', 'name phone gstin address')
      .lean();
    if (!amc) return res.status(404).json({ message: 'AMC not found' });
    return res.json(amc);
  } catch (err) {
    logger.error('[amcController:getAMC]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── RENEW ─────────────────────────────────────────────────────────────────────

const renewAMC = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const amc  = await AMC.findOne({ _id: req.params.id, shop: shop._id });
    if (!amc) return res.status(404).json({ message: 'AMC not found' });

    const { amc_end_date, amc_amount, payment_status } = req.body;
    if (!amc_end_date) return res.status(400).json({ message: 'New end date is required' });

    amc.amc_start_date = new Date();
    amc.amc_end_date   = new Date(amc_end_date);
    amc.status         = 'active';
    amc.visits_used    = 0;
    if (amc_amount   !== undefined) amc.amc_amount    = Number(amc_amount) || 0;
    if (payment_status !== undefined) amc.payment_status = payment_status;
    await amc.save();

    return res.json(amc);
  } catch (err) {
    logger.error('[amcController:renewAMC]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CANCEL ────────────────────────────────────────────────────────────────────

const cancelAMC = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const amc  = await AMC.findOne({ _id: req.params.id, shop: shop._id });
    if (!amc) return res.status(404).json({ message: 'AMC not found' });
    amc.status = 'cancelled';
    await amc.save();
    return res.json({ message: 'AMC cancelled', amc });
  } catch (err) {
    logger.error('[amcController:cancelAMC]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── LOG VISIT ─────────────────────────────────────────────────────────────────

const logVisit = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const amc  = await AMC.findOne({ _id: req.params.id, shop: shop._id });
    if (!amc) return res.status(404).json({ message: 'AMC not found' });
    if (amc.status !== 'active') return res.status(400).json({ message: 'Cannot log visit for a non-active AMC' });

    const { technician_name, issue_reported, work_done, parts_used, next_visit_date, visit_date } = req.body;
    if (!work_done && !issue_reported) return res.status(400).json({ message: 'Issue reported or work done is required' });

    amc.visits.push({
      visit_date:      visit_date ? new Date(visit_date) : new Date(),
      technician_name: technician_name || '',
      issue_reported:  issue_reported  || '',
      work_done:       work_done       || '',
      parts_used:      parts_used      || '',
      next_visit_date: next_visit_date ? new Date(next_visit_date) : null,
    });
    amc.visits_used = (amc.visits_used || 0) + 1;
    await amc.save();

    return res.json(amc);
  } catch (err) {
    logger.error('[amcController:logVisit]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── EXPIRING SOON ─────────────────────────────────────────────────────────────

const getExpiringAMCs = async (req, res) => {
  try {
    const shop   = await getShopOrFail(req.user.id);
    const days   = Number(req.query.days) || 30;
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const amcs   = await AMC.find({
      shop:         shop._id,
      status:       'active',
      amc_end_date: { $lte: cutoff, $gte: new Date() },
    }).sort({ amc_end_date: 1 }).lean();
    return res.json({ amcs, count: amcs.length });
  } catch (err) {
    logger.error('[amcController:getExpiringAMCs]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { createAMC, getAMCs, getAMC, renewAMC, cancelAMC, logVisit, getExpiringAMCs };
