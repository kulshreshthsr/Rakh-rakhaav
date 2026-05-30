const WarrantyClaim = require('../models/warrantyClaimModel');
const Sale          = require('../models/salesModel');
const Shop          = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) {
    const created = await Shop.create([{ name: 'My Shop', owner: userId }]);
    shop = created[0];
  }
  return shop;
};

// GET /api/warranty
const getClaims = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
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
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/warranty
const createClaim = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
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

    const claim = await WarrantyClaim.create({
      shop: shop._id,
      originalSaleId, originalInvoiceNo, purchaseDate,
      productName, serialNumber, imeiNumber, brandName, modelNumber,
      issueDescription, claimType, customerName, customerPhone,
      brandTicketNo, receivedBy, notes,
    });

    res.status(201).json(claim);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/warranty/serial/:sn
const getBySerial = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const claims = await WarrantyClaim.find({
      shop: shop._id,
      serialNumber: req.params.sn,
      claimStatus: { $nin: ['delivered', 'rejected'] },
    }).sort({ claimDate: -1 });
    res.json(claims);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PATCH /api/warranty/:id
const updateClaim = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const claim = await WarrantyClaim.findOne({ _id: req.params.id, shop: shop._id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const allowed = ['claimStatus', 'brandTicketNo', 'resolution', 'replacedSerial', 'notes', 'receivedBy'];
    allowed.forEach(k => { if (req.body[k] !== undefined) claim[k] = req.body[k]; });

    if (req.body.claimStatus === 'delivered' && !claim.resolvedAt) {
      claim.resolvedAt = new Date();
    }

    await claim.save();
    res.json(claim);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getClaims, createClaim, getBySerial, updateClaim };
