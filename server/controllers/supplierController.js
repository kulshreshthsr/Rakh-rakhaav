const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const Shop = require('../models/shopModel');
const { logAuditEvent } = require('../utils/auditTrail');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

// ── GET ALL SUPPLIERS ────────────────────────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const suppliers = await Supplier.find({ shop: shop._id, isActive: { $ne: false } })
      .sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET SINGLE SUPPLIER ──────────────────────────────────────────────────────
const getSupplierById = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CREATE SUPPLIER ──────────────────────────────────────────────────────────
const createSupplier = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { name, phone, gstin, address, state, companyName, notes, opening_balance } = req.body;
    if (!name) return res.status(400).json({ message: 'Supplier name is required' });

    const supplier = await Supplier.create({
      shop: shop._id,
      name, phone, gstin, address, state, companyName, notes,
      opening_balance: Number(opening_balance || 0),
      totalPurchased: Number(opening_balance || 0),
      totalUdhaar: Number(opening_balance || 0),
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'supplier',
      entityId: supplier._id,
      afterValue: supplier,
    });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE SUPPLIER ──────────────────────────────────────────────────────────
const updateSupplier = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const existingSupplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingSupplier) return res.status(404).json({ message: 'Supplier not found' });
    const updatePayload = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updatePayload, 'opening_balance')) {
      const nextOpening = Number(updatePayload.opening_balance || 0);
      const delta = nextOpening - Number(existingSupplier.opening_balance || 0);
      updatePayload.opening_balance = nextOpening;
      updatePayload.totalPurchased = Number((Number(existingSupplier.totalPurchased || 0) + delta).toFixed(2));
      updatePayload.totalUdhaar = Number((updatePayload.totalPurchased - Number(existingSupplier.totalPaid || 0)).toFixed(2));
    }
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { $set: updatePayload },
      { new: true }
    );
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'update',
      entity: 'supplier',
      entityId: supplier._id,
      beforeValue: existingSupplier,
      afterValue: supplier,
    });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE SUPPLIER (soft) ───────────────────────────────────────────────────
const deleteSupplier = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    await Supplier.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { isActive: false }
    );
    if (supplier) {
      await logAuditEvent({
        shopId: shop._id,
        userId: req.user.id,
        actionType: 'delete',
        entity: 'supplier',
        entityId: supplier._id,
        beforeValue: supplier,
      });
    }
    res.json({ message: 'Supplier removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET SUPPLIER LEDGER (udhaar history) ─────────────────────────────────────
const getSupplierLedger = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    const ledger = await SupplierUdhaar.find({
      shop: shop._id,
      supplier: req.params.id,
    })
      .sort({ date: -1 });

    res.json({ supplier, ledger });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── SETTLE SUPPLIER PAYMENT ───────────────────────────────────────────────────
const settleSupplierPayment = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { amount, note, payment_mode } = req.body;

    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    const payAmount = parseFloat(Number(amount).toFixed(2));
    if (payAmount <= 0) return res.status(400).json({ message: 'Amount must be positive' });
    if (payAmount > supplier.totalUdhaar) {
      return res.status(400).json({ message: 'Payment exceeds balance due' });
    }

    // Update supplier totals
    supplier.totalPaid = parseFloat((supplier.totalPaid + payAmount).toFixed(2));
    supplier.totalUdhaar = parseFloat((supplier.totalPurchased - supplier.totalPaid).toFixed(2));
    await supplier.save();

    // Ledger entry: credit (we paid)
    const entry = await SupplierUdhaar.create({
      shop: shop._id,
      supplier: supplier._id,
      type: 'credit',
      amount: payAmount,
      running_balance: supplier.totalUdhaar,
      payment_mode: payment_mode || 'cash',
      note: note || 'Payment made to supplier',
      date: new Date(),
      reference_type: 'manual',
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'supplier_settlement',
      entityId: entry._id,
      afterValue: entry,
      metadata: { supplier_id: req.params.id },
    });

    res.json({ message: 'Payment recorded', balanceDue: supplier.totalUdhaar });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  settleSupplierPayment,
};
