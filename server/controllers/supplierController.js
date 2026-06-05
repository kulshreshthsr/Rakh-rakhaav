const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const { logAuditEvent } = require('../utils/auditTrail');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

// ── GET ALL SUPPLIERS ────────────────────────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const suppliers = await Supplier.find({ shop: shop._id, isActive: { $ne: false } })
      .sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── GET SINGLE SUPPLIER ──────────────────────────────────────────────────────
const getSupplierById = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier नहीं मिला' });
    res.json(supplier);
  } catch (err) {
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CREATE SUPPLIER ──────────────────────────────────────────────────────────
const createSupplier = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
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
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE SUPPLIER ──────────────────────────────────────────────────────────
const updateSupplier = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const existingSupplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingSupplier) return res.status(404).json({ message: 'Supplier नहीं मिला' });
    const updatePayload = { ...req.body };
    // Strip computed fields from direct override
    delete updatePayload.totalPurchased;
    delete updatePayload.totalPaid;
    delete updatePayload.totalUdhaar;
    if (Object.prototype.hasOwnProperty.call(req.body, 'opening_balance')) {
      const nextOpening = Number(req.body.opening_balance || 0);
      const delta = nextOpening - Number(existingSupplier.opening_balance || 0);
      updatePayload.opening_balance = nextOpening;
      updatePayload.totalPurchased = Number((Number(existingSupplier.totalPurchased || 0) + delta).toFixed(2));
      updatePayload.totalUdhaar = Number((updatePayload.totalPurchased - Number(existingSupplier.totalPaid || 0)).toFixed(2));
    }
    if (updatePayload.reminder_enabled !== undefined) {
      updatePayload.reminder_enabled = Boolean(updatePayload.reminder_enabled);
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
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── DELETE SUPPLIER (soft) ───────────────────────────────────────────────────
const deleteSupplier = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
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
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── GET SUPPLIER LEDGER ──────────────────────────────────────────────────────
const getSupplierLedger = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier नहीं मिला' });

    const ledger = await SupplierUdhaar.find({
      shop: shop._id,
      supplier: req.params.id,
    }).sort({ date: -1 });

    res.json({ supplier, ledger });
  } catch (err) {
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── ADD MANUAL SUPPLIER UDHAAR ENTRY ────────────────────────────────────────
const addSupplierUdhaar = async (req, res) => {
  const { type, amount, note, date, payment_mode, reference_id, due_date } = req.body;
  try {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    const shop = await getShopOrFail(req.user.id);
    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier नहीं मिला' });

    const normalType = type === 'debit' ? 'debit' : 'credit';

    if (normalType === 'debit') {
      supplier.totalPurchased = parseFloat((supplier.totalPurchased + Number(amount)).toFixed(2));
    } else {
      supplier.totalPaid = parseFloat((supplier.totalPaid + Number(amount)).toFixed(2));
    }
    supplier.totalUdhaar = parseFloat((supplier.totalPurchased - supplier.totalPaid).toFixed(2));
    await supplier.save();

    const entry = await SupplierUdhaar.create({
      shop: shop._id,
      supplier: req.params.id,
      type: normalType,
      amount: Number(amount),
      running_balance: supplier.totalUdhaar,
      payment_mode: payment_mode || '',
      note,
      date: date || new Date(),
      reference_id: reference_id || '',
      reference_type: 'manual',
      due_date: due_date ? new Date(due_date) : null,
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'supplier_ledger',
      entityId: entry._id,
      afterValue: entry,
      metadata: { supplier_id: req.params.id },
    });

    res.status(201).json(entry);
  } catch (err) {
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── SETTLE SUPPLIER PAYMENT ──────────────────────────────────────────────────
const settleSupplierPayment = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { amount, note, payment_mode, payment_date } = req.body;

    const supplier = await Supplier.findOne({ _id: req.params.id, shop: shop._id });
    if (!supplier) return res.status(404).json({ message: 'Supplier नहीं मिला' });

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ message: 'Amount must be a positive number' });
    const payAmount = parseFloat(Number(amount).toFixed(2));
    if (payAmount > supplier.totalUdhaar) {
      return res.status(400).json({ message: 'Payment exceeds balance due' });
    }

    let entryDate = new Date();
    if (payment_date) {
      const parsed = new Date(payment_date);
      if (!Number.isNaN(parsed.getTime())) {
        if (parsed > new Date()) {
          return res.status(400).json({ message: 'Payment date future में नहीं हो सकती।' });
        }
        entryDate = parsed;
      }
    }

    supplier.totalPaid = parseFloat((supplier.totalPaid + payAmount).toFixed(2));
    supplier.totalUdhaar = parseFloat((supplier.totalPurchased - supplier.totalPaid).toFixed(2));
    await supplier.save();

    const entry = await SupplierUdhaar.create({
      shop: shop._id,
      supplier: supplier._id,
      type: 'credit',
      amount: payAmount,
      running_balance: supplier.totalUdhaar,
      payment_mode: payment_mode || 'cash',
      note: note || 'Payment made to supplier',
      date: entryDate,
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
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE REMINDER TIMESTAMP ────────────────────────────────────────────────
const updateReminderTimestamp = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { $set: { last_reminded_at: new Date() } },
      { new: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier नहीं मिला' });
    res.json({ ok: true, last_reminded_at: supplier.last_reminded_at });
  } catch (err) {
    logger.error('[supplierController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  addSupplierUdhaar,
  settleSupplierPayment,
  updateReminderTimestamp,
};
