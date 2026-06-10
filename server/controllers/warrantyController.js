const WarrantyClaim = require('../models/warrantyClaimModel');
const Sale          = require('../models/salesModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

// GET /api/warranty
const getClaims = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { status, search, from, to } = req.query;

    const filter = { shop: shop._id };

    if (status && status !== 'all') {
      const statuses = status.split(',');
      filter.claimStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (from || to) {
      filter.claimDate = {};
      if (from) filter.claimDate.$gte = new Date(from);
      if (to)   filter.claimDate.$lte = new Date(to);
    }
    if (search) {
      filter.$or = [
        { serialNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { originalInvoiceNo: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { brandTicketNo: { $regex: search, $options: 'i' } },
      ];
    }

    const claims = await WarrantyClaim.find(filter).sort({ claimDate: -1 }).limit(100);

    // Summary counts for dashboard
    const summary = await WarrantyClaim.aggregate([
      { $match: { shop: shop._id, claimStatus: { $in: ['received', 'sent_to_brand', 'under_repair'] } } },
      { $group: { _id: '$claimStatus', count: { $sum: 1 } } },
    ]);
    const readyCount = await WarrantyClaim.countDocuments({ shop: shop._id, claimStatus: 'ready' });

    res.json({ claims, summary, readyCount });
  } catch (err) { logger.error('[warrantyController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// POST /api/warranty
const createClaim = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const {
      originalInvoiceNo, productName, serialNumber, imeiNumber,
      brandName, modelNumber, issueDescription, claimType,
      customerName, customerPhone, brandTicketNo, receivedBy, notes,
    } = req.body;

    if (!productName) return res.status(400).json({ message: 'Product name is required' });
    if (!issueDescription) return res.status(400).json({ message: 'Issue description is required' });
    if (!claimType) return res.status(400).json({ message: 'Claim type is required' });
    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });

    // Try to resolve originalSaleId from invoice number
    let originalSaleId = null;
    let purchaseDate   = null;
    if (originalInvoiceNo) {
      const sale = await Sale.findOne({ shop: shop._id, invoice_number: originalInvoiceNo });
      if (sale) { originalSaleId = sale._id; purchaseDate = sale.createdAt; }
    }

    // Auto-compute warranty validity
    let is_within_warranty = null;
    let warranty_expiry_date = null;
    if (purchaseDate) {
      // Look up warranty expiry from SerialInventory if we have a serial
      if (serialNumber) {
        const SerialInventory = require('../models/serialInventoryModel');
        const unit = await SerialInventory.findOne({ shop: shop._id, serial_number: serialNumber }).lean();
        if (unit?.warranty_expiry) {
          warranty_expiry_date = unit.warranty_expiry;
          is_within_warranty = new Date() <= new Date(unit.warranty_expiry);
        }
      }
    }

    const claim = await WarrantyClaim.create({
      shop: shop._id,
      originalSaleId, originalInvoiceNo, purchaseDate,
      productName, serialNumber, imeiNumber, brandName, modelNumber,
      issueDescription, claimType, customerName, customerPhone,
      brandTicketNo, receivedBy, notes,
      is_within_warranty,
      warranty_expiry_date,
    });

    res.status(201).json(claim);
  } catch (err) { logger.error('[warrantyController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// GET /api/warranty/serial/:sn
const getBySerial = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const claims = await WarrantyClaim.find({
      shop: shop._id,
      serialNumber: req.params.sn,
      claimStatus: { $nin: ['delivered', 'rejected'] },
    }).sort({ claimDate: -1 });
    res.json(claims);
  } catch (err) { logger.error('[warrantyController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

// PATCH /api/warranty/:id
const updateClaim = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const claim = await WarrantyClaim.findOne({ _id: req.params.id, shop: shop._id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const allowed = [
      'claimStatus', 'brandTicketNo', 'resolution', 'replacedSerial', 'notes', 'receivedBy',
      'estimated_repair_cost', 'actual_repair_cost', 'sla_days', 'escalated',
    ];
    allowed.forEach(k => { if (req.body[k] !== undefined) claim[k] = req.body[k]; });

    if (req.body.claimStatus === 'delivered' && !claim.resolvedAt) {
      claim.resolvedAt = new Date();
    }

    // Build WhatsApp notification link when status moves to 'ready'
    let whatsappLink = null;
    if (req.body.claimStatus === 'ready' && claim.customerPhone) {
      claim.customer_notified_at = new Date();
      const phone = claim.customerPhone.replace(/\D/g, '').slice(-10);
      const shopDoc = await require('../models/shopModel').findOne({ _id: claim.shop }).select('name').lean();
      const shopName = shopDoc?.name || 'our store';
      const msg = encodeURIComponent(`Dear ${claim.customerName}, your ${claim.productName} is ready for pickup at ${shopName}. Reference: ${claim.originalInvoiceNo || claim._id}.`);
      whatsappLink = `https://wa.me/91${phone}?text=${msg}`;
    }

    await claim.save();
    res.json({ claim, whatsappLink });
  } catch (err) { logger.error('[warrantyController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' }); }
};

module.exports = { getClaims, createClaim, getBySerial, updateClaim };
