const mongoose = require('mongoose');
const Project  = require('../models/projectModel');
const Sale     = require('../models/salesModel');
const Customer = require('../models/customerModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const round2 = (v) => parseFloat(Number(v || 0).toFixed(2));

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const generateProjectNumber = async (shopId, session = null) => {
  const fy = getFinancialYear();
  let q = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'project', financial_year: fy },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) q = q.session(session);
  const seq = await q;
  return `PRJ/${fy}/${String(seq.last_number).padStart(4, '0')}`;
};

// ── CREATE ────────────────────────────────────────────────────────────────────

const createProject = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { name, customer: customerId, customer_name, site_address, estimated_value, start_date, expected_end_date, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Project name is required' });

    let resolvedCustomerName = customer_name || '';
    if (customerId) {
      const cust = await Customer.findOne({ _id: customerId, shop: shop._id }).select('name').lean();
      if (!cust) return res.status(404).json({ message: 'Customer not found' });
      resolvedCustomerName = cust.name;
    }

    const projectNumber = await generateProjectNumber(shop._id);
    const project = await Project.create({
      shop: shop._id,
      project_number: projectNumber,
      name: name.trim(),
      customer: customerId || null,
      customer_name: resolvedCustomerName,
      site_address: site_address || '',
      estimated_value: Number(estimated_value) || 0,
      start_date: start_date ? new Date(start_date) : new Date(),
      expected_end_date: expected_end_date ? new Date(expected_end_date) : null,
      notes: notes || '',
    });

    return res.status(201).json(project);
  } catch (err) {
    logger.error('[projectController:createProject]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── LIST ──────────────────────────────────────────────────────────────────────

const getProjects = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { status, customer, cursor, limit: limitParam } = req.query;

    const filter = { shop: shop._id };
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 50, 200);
    const docs = await Project.find(filter)
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1)
      .lean();

    // Attach billing summary from sales
    const projectIds = docs.map((p) => p._id);
    const billingAgg = await Sale.aggregate([
      { $match: { shop: shop._id, project: { $in: projectIds }, document_type: { $in: ['invoice', 'credit_note'] } } },
      { $group: {
        _id: '$project',
        total_billed:  { $sum: { $cond: [{ $eq: ['$document_type', 'invoice'] }, '$total_amount', 0] } },
        total_paid:    { $sum: '$amount_paid' },
      }},
    ]);
    const billingMap = {};
    for (const b of billingAgg) billingMap[String(b._id)] = b;

    const hasMore = docs.length > pageSize;
    const page = hasMore ? docs.slice(0, pageSize) : docs;

    return res.json({
      projects: page.map((p) => {
        const billing = billingMap[String(p._id)] || {};
        return {
          ...p,
          total_billed:      round2(billing.total_billed || 0),
          total_paid:        round2(billing.total_paid   || 0),
          total_outstanding: round2((billing.total_billed || 0) - (billing.total_paid || 0)),
        };
      }),
      hasMore,
      nextCursor: hasMore ? String(page[page.length - 1]._id) : null,
    });
  } catch (err) {
    logger.error('[projectController:getProjects]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── SINGLE ────────────────────────────────────────────────────────────────────

const getProject = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const project = await Project.findOne({ _id: req.params.id, shop: shop._id })
      .populate('customer', 'name phone gstin address')
      .lean();
    if (!project) return res.status(404).json({ message: 'Project not found' });
    return res.json(project);
  } catch (err) {
    logger.error('[projectController:getProject]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────

const updateProject = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const project = await Project.findOne({ _id: req.params.id, shop: shop._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const { name, site_address, estimated_value, status, start_date, expected_end_date, actual_end_date, notes } = req.body;
    if (name !== undefined)              project.name             = name.trim();
    if (site_address !== undefined)      project.site_address     = site_address;
    if (estimated_value !== undefined)   project.estimated_value  = Number(estimated_value) || 0;
    if (status !== undefined)            project.status           = status;
    if (start_date !== undefined)        project.start_date       = start_date ? new Date(start_date) : null;
    if (expected_end_date !== undefined) project.expected_end_date = expected_end_date ? new Date(expected_end_date) : null;
    if (actual_end_date !== undefined)   project.actual_end_date  = actual_end_date ? new Date(actual_end_date) : null;
    if (notes !== undefined)             project.notes            = notes;

    await project.save();
    return res.json(project);
  } catch (err) {
    logger.error('[projectController:updateProject]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CLOSE ─────────────────────────────────────────────────────────────────────

const closeProject = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const project = await Project.findOne({ _id: req.params.id, shop: shop._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    project.status = 'completed';
    project.actual_end_date = new Date();
    await project.save();
    return res.json(project);
  } catch (err) {
    logger.error('[projectController:closeProject]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── PROJECT LEDGER ────────────────────────────────────────────────────────────

const getProjectLedger = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const project = await Project.findOne({ _id: req.params.id, shop: shop._id }).lean();
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const sales = await Sale.find({ shop: shop._id, project: project._id })
      .select('invoice_number createdAt buyer_name total_amount amount_paid payment_status document_type items')
      .sort({ createdAt: 1 })
      .lean();

    let runningTotal = 0;
    const entries = sales.map((sale) => {
      runningTotal = round2(runningTotal + (sale.total_amount || 0));
      return { ...sale, running_total: runningTotal };
    });

    const totalBilled = round2(sales.reduce((s, sale) => s + (sale.total_amount || 0), 0));
    const totalPaid   = round2(sales.reduce((s, sale) => s + (sale.amount_paid  || 0), 0));

    return res.json({
      project,
      sales: entries,
      summary: { total_billed: totalBilled, total_paid: totalPaid, total_outstanding: round2(totalBilled - totalPaid) },
    });
  } catch (err) {
    logger.error('[projectController:getProjectLedger]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── MATERIALS BREAKDOWN ───────────────────────────────────────────────────────

const getProjectMaterials = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const project = await Project.findOne({ _id: req.params.id, shop: shop._id }).lean();
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const agg = await Sale.aggregate([
      { $match: { shop: new mongoose.Types.ObjectId(shop._id), project: new mongoose.Types.ObjectId(project._id) } },
      { $unwind: '$items' },
      { $group: {
        _id:          '$items.product',
        product_name: { $first: '$items.product_name' },
        total_qty:    { $sum: '$items.quantity' },
        total_value:  { $sum: '$items.total_amount' },
      }},
      { $sort: { total_value: -1 } },
    ]);

    return res.json({ project, materials: agg });
  } catch (err) {
    logger.error('[projectController:getProjectMaterials]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { createProject, getProjects, getProject, updateProject, closeProject, getProjectLedger, getProjectMaterials };
