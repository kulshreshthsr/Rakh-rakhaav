const Customer = require('../models/customerModel');
const Udhaar = require('../models/udhaarModel');
const { logAuditEvent } = require('../utils/auditTrail');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

// ── GET ALL CUSTOMERS ────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const customers = await Customer.find({
      shop: shop._id,
      isActive: { $ne: false },
    }).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CREATE CUSTOMER ──────────────────────────────────────────────────────────
const createCustomer = async (req, res) => {
  const { name, phone, email, address, gstin, notes, opening_balance } = req.body;
  try {
    if (!name) return res.status(400).json({ message: 'Customer name is required' });
    const shop = await getShopOrFail(req.user.id);
    const customer = await Customer.create({
      shop: shop._id,
      name, phone, email, address, gstin, notes,
      opening_balance: Number(opening_balance || 0),
      totalSales: Number(opening_balance || 0),
      totalUdhaar: Number(opening_balance || 0),
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'customer',
      entityId: customer._id,
      afterValue: customer,
    });
    res.status(201).json(customer);
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE CUSTOMER ──────────────────────────────────────────────────────────
const updateCustomer = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const existingCustomer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!existingCustomer) return res.status(404).json({ message: 'Customer नहीं मिला' });
    const { name, phone, email, address, gstin, notes, opening_balance,
            reminder_enabled, reminder_frequency } = req.body;
    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (phone !== undefined) updatePayload.phone = phone;
    if (email !== undefined) updatePayload.email = email;
    if (address !== undefined) updatePayload.address = address;
    if (gstin !== undefined) updatePayload.gstin = gstin;
    if (notes !== undefined) updatePayload.notes = notes;
    if (reminder_enabled !== undefined) updatePayload.reminder_enabled = Boolean(reminder_enabled);
    if (reminder_frequency !== undefined) updatePayload.reminder_frequency = reminder_frequency || null;
    if (opening_balance !== undefined) {
      const nextOpening = Number(opening_balance || 0);
      if (!Number.isFinite(nextOpening) || nextOpening < 0) {
        return res.status(400).json({ message: 'opening_balance must be a non-negative number' });
      }
      const delta = nextOpening - Number(existingCustomer.opening_balance || 0);
      updatePayload.opening_balance = nextOpening;
      updatePayload.totalSales = Number((Number(existingCustomer.totalSales || 0) + delta).toFixed(2));
      updatePayload.totalUdhaar = Number((updatePayload.totalSales - Number(existingCustomer.totalPaid || 0)).toFixed(2));
    }
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { $set: updatePayload },
      { new: true }
    );
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'update',
      entity: 'customer',
      entityId: customer._id,
      beforeValue: existingCustomer,
      afterValue: customer,
    });
    res.json(customer);
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── DELETE CUSTOMER (soft) ───────────────────────────────────────────────────
const deleteCustomer = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer नहीं मिला' });

    if (customer.totalUdhaar > 0) {
      return res.status(400).json({
        message: `Customer ka ₹${customer.totalUdhaar.toFixed(2)} udhaar baaki hai. Pehle settle karo.`,
      });
    }

    await Customer.findOneAndUpdate({ _id: req.params.id, shop: shop._id }, { isActive: false });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'delete',
      entity: 'customer',
      entityId: customer._id,
      beforeValue: customer,
    });
    res.json({ message: 'Customer removed' });
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── GET UDHAAR LEDGER ────────────────────────────────────────────────────────
const getUdhaar = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer नहीं मिला' });

    const entries = await Udhaar.find({
      shop: shop._id,
      customer: req.params.id,
    }).sort({ date: -1 });
    res.json({ customer, entries });
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── ADD MANUAL UDHAAR ENTRY ──────────────────────────────────────────────────
const addUdhaar = async (req, res) => {
  const { type, amount, note, date, payment_mode, reference_id, due_date } = req.body;
  try {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    const shop = await getShopOrFail(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer नहीं मिला' });

    const normalType = type === 'diya' ? 'debit' : type === 'liya' ? 'credit' : type;

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
      entity: 'customer_ledger',
      entityId: entry._id,
      referenceId: entry.reference_id,
      afterValue: entry,
      metadata: { customer_id: req.params.id },
    });

    res.status(201).json(entry);
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── SETTLE / PARTIAL PAYMENT ─────────────────────────────────────────────────
const settlePayment = async (req, res) => {
  try {
    const { amount, note, payment_mode, payment_date } = req.body;
    const shop = await getShopOrFail(req.user.id);
    const customer = await Customer.findOne({ _id: req.params.id, shop: shop._id });
    if (!customer) return res.status(404).json({ message: 'Customer नहीं मिला' });

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    const payAmount = parseFloat(Number(amount).toFixed(2));
    if (payAmount > customer.totalUdhaar) {
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

    customer.totalPaid = parseFloat((customer.totalPaid + payAmount).toFixed(2));
    customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
    await customer.save();

    const entry = await Udhaar.create({
      shop: shop._id,
      customer: req.params.id,
      type: 'credit',
      amount: payAmount,
      running_balance: customer.totalUdhaar,
      payment_mode: payment_mode || 'cash',
      note: note || 'Payment received',
      date: entryDate,
      reference_type: 'manual',
    });
    await logAuditEvent({
      shopId: shop._id,
      userId: req.user.id,
      actionType: 'create',
      entity: 'customer_settlement',
      entityId: entry._id,
      afterValue: entry,
      metadata: { customer_id: req.params.id },
    });

    res.json({
      message: 'Payment recorded ✅',
      balanceDue: customer.totalUdhaar,
      customer,
    });
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── RECALCULATE ALL UDHAAR RUNNING BALANCES FOR A CUSTOMER ──────────────────
const recalculateUdhaarBalances = async (shopId, customerId) => {
  const entries = await Udhaar.find({ shop: shopId, customer: customerId }).sort({ date: 1, createdAt: 1 });
  let balance = 0;
  const bulkOps = entries.map((entry) => {
    if (entry.type === 'debit') balance = parseFloat((balance + entry.amount).toFixed(2));
    else balance = parseFloat((balance - entry.amount).toFixed(2));
    return {
      updateOne: {
        filter: { _id: entry._id },
        update: { $set: { running_balance: balance } },
      },
    };
  });
  if (bulkOps.length > 0) await Udhaar.bulkWrite(bulkOps);
  await Customer.findOneAndUpdate(
    { _id: customerId, shop: shopId },
    { $set: { totalUdhaar: Math.max(0, balance) } }
  );
  return balance;
};

// ── UPDATE MANUAL UDHAAR ENTRY ───────────────────────────────────────────────
const updateUdhaar = async (req, res) => {
  const { amount, note, date, payment_mode, due_date } = req.body;
  try {
    const shop = await getShopOrFail(req.user.id);
    const entry = await Udhaar.findOne({ _id: req.params.entryId, shop: shop._id, customer: req.params.id });
    if (!entry) return res.status(404).json({ message: 'Udhaar entry नहीं मिली' });
    if (entry.reference_type !== 'manual') {
      return res.status(400).json({ message: 'Only manual entries can be edited' });
    }

    if (amount !== undefined) entry.amount = Number(amount);
    if (note !== undefined) entry.note = note;
    if (date !== undefined) entry.date = new Date(date);
    if (payment_mode !== undefined) entry.payment_mode = payment_mode;
    if (due_date !== undefined) entry.due_date = due_date ? new Date(due_date) : null;
    await entry.save();

    await recalculateUdhaarBalances(shop._id, req.params.id);
    await logAuditEvent({
      shopId: shop._id, userId: req.user.id, actionType: 'update',
      entity: 'customer_ledger', entityId: entry._id, afterValue: entry,
      metadata: { customer_id: req.params.id },
    });
    res.json(entry);
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── DELETE MANUAL UDHAAR ENTRY ───────────────────────────────────────────────
const deleteUdhaar = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const entry = await Udhaar.findOne({ _id: req.params.entryId, shop: shop._id, customer: req.params.id });
    if (!entry) return res.status(404).json({ message: 'Udhaar entry नहीं मिली' });
    if (entry.reference_type !== 'manual') {
      return res.status(400).json({ message: 'Only manual entries can be deleted' });
    }

    await Udhaar.deleteOne({ _id: entry._id });
    await recalculateUdhaarBalances(shop._id, req.params.id);
    await logAuditEvent({
      shopId: shop._id, userId: req.user.id, actionType: 'delete',
      entity: 'customer_ledger', entityId: entry._id, beforeValue: entry,
      metadata: { customer_id: req.params.id },
    });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── ADMIN: BACKFILL ALL UDHAAR BALANCES FOR A SHOP ──────────────────────────
const backfillUdhaarBalances = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const customers = await Customer.find({ shop: shop._id }).select('_id').lean();
    let processed = 0;
    for (const cust of customers) {
      const entries = await Udhaar.find({ shop: shop._id, customer: cust._id }).countDocuments();
      if (entries > 0) {
        await recalculateUdhaarBalances(shop._id, cust._id);
        processed++;
      }
    }
    res.json({ message: `Backfilled ${processed} customers` });
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE REMINDER TIMESTAMP ────────────────────────────────────────────────
const updateReminderTimestamp = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: shop._id },
      { $set: { last_reminded_at: new Date() } },
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer नहीं मिला' });
    res.json({ ok: true, last_reminded_at: customer.last_reminded_at });
  } catch (err) {
    logger.error('[customerController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getUdhaar,
  addUdhaar,
  updateUdhaar,
  deleteUdhaar,
  settlePayment,
  updateReminderTimestamp,
  backfillUdhaarBalances,
};
