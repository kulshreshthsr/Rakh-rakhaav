const ServiceJob   = require('../models/serviceJobModel');
const Customer     = require('../models/customerModel');
const SerialInventory = require('../models/serialInventoryModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const getFinancialYear = (date = new Date()) => {
  const year  = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const generateJobNumber = async (shopId) => {
  const fy  = getFinancialYear();
  const seq = await DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'service_job', financial_year: fy },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `JOB/${fy}/${String(seq.last_number).padStart(4, '0')}`;
};

// ── CREATE ────────────────────────────────────────────────────────────────────

const createJob = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const {
      customer: customerId, customer_name, customer_phone,
      product_name, brand, model_number, serial_number, imei,
      problem_reported, problem_type, job_type,
      estimated_cost, technician_name, estimated_delivery, notes,
    } = req.body;

    if (!customer_name)      return res.status(400).json({ message: 'Customer name is required' });
    if (!product_name)       return res.status(400).json({ message: 'Product name is required' });
    if (!problem_reported)   return res.status(400).json({ message: 'Problem reported is required' });

    let resolvedPhone = customer_phone || '';
    if (customerId) {
      const cust = await Customer.findOne({ _id: customerId, shop: shop._id }).select('phone name').lean();
      if (cust) resolvedPhone = cust.phone || resolvedPhone;
    }

    // If IMEI provided, try to auto-fill product details from SerialInventory
    let autoProduct = {};
    if (imei && !product_name) {
      const unit = await SerialInventory.findOne({
        shop: shop._id,
        $or: [{ imei_1: imei }, { imei_2: imei }, { imei_number: imei }],
      }).populate('product', 'name').lean();
      if (unit?.product) autoProduct = { product_name: unit.product.name };
    }

    const jobNumber = await generateJobNumber(shop._id);
    const initialStatus = { status: 'received', changed_at: new Date(), changed_by: req.user?.name || 'system', note: 'Job received' };

    const job = await ServiceJob.create({
      shop: shop._id,
      job_number: jobNumber,
      customer: customerId || null,
      customer_name,
      customer_phone: resolvedPhone,
      product_name:  autoProduct.product_name || product_name,
      brand:          brand          || '',
      model_number:   model_number   || '',
      serial_number:  serial_number  || '',
      imei:           imei           || '',
      problem_reported,
      problem_type:  problem_type  || 'other',
      job_type:      job_type      || 'paid_repair',
      estimated_cost: Number(estimated_cost) || 0,
      technician_name: technician_name || '',
      estimated_delivery: estimated_delivery ? new Date(estimated_delivery) : null,
      notes: notes || '',
      status: 'received',
      status_history: [initialStatus],
    });

    return res.status(201).json(job);
  } catch (err) {
    logger.error('[serviceJobController:createJob]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── LIST ──────────────────────────────────────────────────────────────────────

const getJobs = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { status, technician, search, from, to, cursor, limit: limitParam } = req.query;

    const filter = { shop: shop._id };
    if (status && status !== 'all') {
      const statuses = status.split(',');
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (technician) filter.technician_name = { $regex: technician, $options: 'i' };
    if (from || to) {
      filter.received_date = {};
      if (from) filter.received_date.$gte = new Date(from);
      if (to)   filter.received_date.$lte = new Date(to);
    }
    if (search) {
      filter.$or = [
        { customer_name:  { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } },
        { product_name:   { $regex: search, $options: 'i' } },
        { serial_number:  { $regex: search, $options: 'i' } },
        { imei:           { $regex: search, $options: 'i' } },
        { job_number:     { $regex: search, $options: 'i' } },
      ];
    }
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 100, 500);
    const jobs = await ServiceJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = jobs.length > pageSize;
    const page    = hasMore ? jobs.slice(0, pageSize) : jobs;
    return res.json({ jobs: page, hasMore, nextCursor: hasMore ? String(page[page.length - 1]._id) : null });
  } catch (err) {
    logger.error('[serviceJobController:getJobs]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── SINGLE ────────────────────────────────────────────────────────────────────

const getJob = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const job  = await ServiceJob.findOne({ _id: req.params.id, shop: shop._id })
      .populate('customer', 'name phone gstin address')
      .lean();
    if (!job) return res.status(404).json({ message: 'Service job not found' });
    return res.json(job);
  } catch (err) {
    logger.error('[serviceJobController:getJob]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────

const updateJobStatus = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const job  = await ServiceJob.findOne({ _id: req.params.id, shop: shop._id });
    if (!job) return res.status(404).json({ message: 'Service job not found' });

    const { status, note, technician_name, final_cost, payment_status, amount_paid, actual_delivery } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const prevStatus = job.status;
    job.status = status;
    job.status_history.push({
      status,
      changed_at: new Date(),
      changed_by: req.user?.name || 'staff',
      note: note || '',
    });

    if (technician_name !== undefined) job.technician_name = technician_name;
    if (final_cost      !== undefined) job.final_cost      = Number(final_cost) || 0;
    if (payment_status  !== undefined) job.payment_status  = payment_status;
    if (amount_paid     !== undefined) job.amount_paid     = Number(amount_paid) || 0;

    if (status === 'delivered') {
      job.actual_delivery = actual_delivery ? new Date(actual_delivery) : new Date();
    }

    await job.save();

    // Build WhatsApp message when job is ready for pickup
    let whatsappLink = null;
    if (status === 'ready' && job.customer_phone) {
      const shopDoc = req.shopName ? req.shopName : 'our service center';
      const msg = encodeURIComponent(`Your ${job.product_name} (Job# ${job.job_number}) is ready for pickup at ${shopDoc}. Please bring this message as your receipt.`);
      whatsappLink = `https://wa.me/91${job.customer_phone.replace(/\D/g, '').slice(-10)}?text=${msg}`;
    }

    return res.json({ job, whatsappLink, prevStatus });
  } catch (err) {
    logger.error('[serviceJobController:updateJobStatus]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── ADD PART ──────────────────────────────────────────────────────────────────

const addPart = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const job  = await ServiceJob.findOne({ _id: req.params.id, shop: shop._id });
    if (!job) return res.status(404).json({ message: 'Service job not found' });
    if (['delivered', 'cancelled'].includes(job.status)) return res.status(400).json({ message: 'Cannot add parts to a closed job' });

    const { part_name, part_cost, quantity } = req.body;
    if (!part_name) return res.status(400).json({ message: 'Part name is required' });

    job.parts_used.push({ part_name, part_cost: Number(part_cost) || 0, quantity: Number(quantity) || 1 });
    await job.save();
    return res.json(job);
  } catch (err) {
    logger.error('[serviceJobController:addPart]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── JOB CARD (customer receipt) ───────────────────────────────────────────────

const getJobCard = async (req, res) => {
  try {
    const shop    = await getShopOrFail(req.user.id);
    const job     = await ServiceJob.findOne({ _id: req.params.id, shop: shop._id }).lean();
    if (!job) return res.status(404).json({ message: 'Service job not found' });

    const shopDoc = await require('../models/shopModel').findById(shop._id).select('name phone address gstin').lean();
    const whatsappMsg = job.customer_phone
      ? `https://wa.me/91${job.customer_phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hi, your ${job.product_name} has been received for repair. Job# ${job.job_number}. Estimated delivery: ${job.estimated_delivery ? new Date(job.estimated_delivery).toLocaleDateString() : 'TBD'}. Expected cost: ₹${job.estimated_cost || 'TBD'}.`)}`
      : null;

    return res.json({ job, shop: shopDoc, whatsappMsg });
  } catch (err) {
    logger.error('[serviceJobController:getJobCard]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── MARK DELIVERED ────────────────────────────────────────────────────────────

const markDelivered = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const job  = await ServiceJob.findOne({ _id: req.params.id, shop: shop._id });
    if (!job) return res.status(404).json({ message: 'Service job not found' });
    if (job.status === 'delivered') return res.status(400).json({ message: 'Job already delivered' });

    const { customer_signature, amount_paid, payment_status } = req.body;

    job.status             = 'delivered';
    job.actual_delivery    = new Date();
    job.customer_signature = customer_signature || '';
    if (amount_paid    !== undefined) job.amount_paid    = Number(amount_paid) || 0;
    if (payment_status !== undefined) job.payment_status = payment_status;
    job.status_history.push({ status: 'delivered', changed_at: new Date(), changed_by: 'staff', note: 'Device delivered to customer' });
    await job.save();

    return res.json(job);
  } catch (err) {
    logger.error('[serviceJobController:markDelivered]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { createJob, getJobs, getJob, updateJobStatus, addPart, getJobCard, markDelivered };
