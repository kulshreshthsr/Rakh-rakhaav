const mongoose = require('mongoose');
const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');
const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { cloneForAudit, logAuditEvent } = require('../utils/auditTrail');
const ProductBatch    = require('../models/productBatchModel');
const ProductVariant  = require('../models/productVariantModel');
const SerialInventory = require('../models/serialInventoryModel');

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

const getOrCreateShop = async (userId, session = null) => {
  let query = Shop.findOne({ owner: userId });
  if (session) query = query.session(session);
  let shop = await query;
  if (!shop) {
    const created = await Shop.create([{ name: 'My Shop', owner: userId }], session ? { session } : {});
    shop = created[0];
  }
  return shop;
};

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

const generateBillNumber = async (shopId, session = null, invoiceDate = new Date()) => {
  const financialYear = getFinancialYear(invoiceDate);
  let query = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'purchase', financial_year: financialYear },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) query = query.session(session);
  const sequence = await query;
  return `PUR/${financialYear}/${String(sequence.last_number).padStart(4, '0')}`;
};

const normalizeState = (value = '') => value.trim().toLowerCase();
const normalizeGstin = (value = '') => String(value).replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);
const normalizeOfflineOperationId = (value = '') => {
  const normalized = String(value || '').trim();
  return normalized || null;
};
const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));
const parsePurchaseDateInput = (value, referenceDate = new Date()) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      const nextDate = new Date(referenceDate);
      if (Number.isNaN(nextDate.getTime())) return null;
      nextDate.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
      return nextDate;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getStateFromGstin = (gstin = '') => GST_STATE_CODE_MAP[normalizeGstin(gstin).slice(0, 2)] || '';

const calculateGST = (taxable_amount, gst_rate, shopState, supplierState) => {
  const totalGst = round2((taxable_amount * gst_rate) / 100);
  const normalizedShopState = normalizeState(shopState);
  const normalizedSupplierState = normalizeState(supplierState);
  const isIGST = normalizedSupplierState && normalizedShopState && normalizedShopState !== normalizedSupplierState;
  if (isIGST) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: totalGst, total_gst: totalGst, gst_type: 'IGST' };
  }
  const cgst = round2(totalGst / 2);
  const sgst = round2(totalGst - cgst);
  return { cgst_amount: cgst, sgst_amount: sgst, igst_amount: 0, total_gst: totalGst, gst_type: 'CGST_SGST' };
};

const getExistingPurchaseQuantities = (record) => {
  const sourceItems = record.items && record.items.length > 0
    ? record.items
    : (record.product ? [{ product: record.product, quantity: record.quantity }] : []);

  return sourceItems.reduce((map, item) => {
    if (!item.product) return map;
    const productId = String(item.product);
    map.set(productId, (map.get(productId) || 0) + Number(item.quantity || 0));
    return map;
  }, new Map());
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock sync with history logging
// ─────────────────────────────────────────────────────────────────────────────

const syncPurchaseStock = async (previousPurchase, nextItems, invoiceNumber = '', session = null) => {
  const previousQuantities = previousPurchase ? getExistingPurchaseQuantities(previousPurchase) : new Map();
  const nextQuantities = nextItems.reduce((map, item) => {
    const productId = String(item.product);
    map.set(productId, (map.get(productId) || 0) + Number(item.quantity || 0));
    return map;
  }, new Map());

  const allProductIds = [...new Set([...previousQuantities.keys(), ...nextQuantities.keys()])];

  for (const productId of allProductIds) {
    const delta = (nextQuantities.get(productId) || 0) - (previousQuantities.get(productId) || 0);
    if (!delta) continue;

    let productQuery = Product.findById(productId);
    if (session) productQuery = productQuery.session(session);
    const product = await productQuery;
    if (!product) continue;

    const quantityAfter = round2(product.quantity + delta);
    const nextItem = nextItems.find((item) => String(item.product) === productId);

    const update = {
      $inc: { quantity: delta },
      $push: {
        stock_history: {
          type: delta > 0 ? 'purchase' : 'purchase_return',
          quantity_change: delta,
          quantity_after: quantityAfter,
          reference_id: invoiceNumber,
          date: new Date(),
        },
      },
    };
    if (nextItem) update.$set = { cost_price: nextItem.price_per_unit };

    await Product.findByIdAndUpdate(productId, update, session ? { session } : {});
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-inventory sync on purchase receive
// ─────────────────────────────────────────────────────────────────────────────

const syncSubInventoryOnPurchase = async (previousItems = [], nextItems = [], invoiceNumber = '', shopId, session = null) => {
  const opts = session ? { session } : {};

  for (const item of nextItems) {
    const meta = item.item_metadata instanceof Map
      ? Object.fromEntries(item.item_metadata)
      : (item.item_metadata || {});
    if (!item.product) continue;

    // ── Batch receive ──────────────────────────────────────────────────────
    if (meta.batch_number) {
      const qty = Number(item.quantity || 0);
      const existing = await ProductBatch.findOne({
        shop: shopId, product: item.product,
        batch_number: String(meta.batch_number).trim(),
      }).session(session || null);

      if (existing) {
        existing.quantity += qty;
        existing.is_depleted = false;
        if (meta.expiry_date)       existing.expiry_date      = new Date(meta.expiry_date);
        if (meta.manufacture_date)  existing.manufacture_date = new Date(meta.manufacture_date);
        if (meta.mrp != null)       existing.mrp              = Number(meta.mrp);
        if (meta.manufacturer)      existing.manufacturer     = meta.manufacturer;
        existing.purchase_invoice = invoiceNumber;
        await existing.save(opts);
      } else {
        await ProductBatch.create([{
          shop: shopId, product: item.product,
          batch_number:     String(meta.batch_number).trim(),
          expiry_date:      meta.expiry_date      ? new Date(meta.expiry_date)      : undefined,
          manufacture_date: meta.manufacture_date ? new Date(meta.manufacture_date) : undefined,
          quantity:         qty,
          mrp:              meta.mrp        != null ? Number(meta.mrp)        : undefined,
          cost_price:       item.price_per_unit != null ? Number(item.price_per_unit) : 0,
          manufacturer:     meta.manufacturer,
          purchase_invoice: invoiceNumber,
        }], opts);
      }
    }

    // ── Variant receive ────────────────────────────────────────────────────
    if (meta.variant_id) {
      await ProductVariant.findByIdAndUpdate(
        meta.variant_id,
        { $inc: { quantity: Number(item.quantity || 0) } },
        opts
      );
    }

    // ── Serial number receive ──────────────────────────────────────────────
    const serialNumbers = Array.isArray(meta.serial_numbers) ? meta.serial_numbers
      : (meta.serial_number ? [meta.serial_number] : []);
    if (serialNumbers.length > 0) {
      const docs = serialNumbers
        .filter(sn => sn && typeof sn === 'string' && sn.trim())
        .map(sn => ({
          shop: shopId, product: item.product,
          serial_number:    sn.trim(),
          imei_number:      meta.imei_prefix ? `${meta.imei_prefix}${sn.trim()}` : undefined,
          status:           'in_stock',
          purchase_invoice: invoiceNumber,
          warranty_expiry:  meta.warranty_expiry ? new Date(meta.warranty_expiry) : undefined,
          color:   meta.color,
          storage: meta.storage,
          ram:     meta.ram,
        }));
      if (docs.length > 0) {
        try { await SerialInventory.create(docs, opts); } catch (_) { /* ignore duplicate serials */ }
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-inventory reversal on purchase delete
// ─────────────────────────────────────────────────────────────────────────────

const reverseSubInventoryForPurchase = async (items = [], shopId, session = null) => {
  const opts = session ? { session } : {};

  for (const item of items) {
    const meta = item.item_metadata instanceof Map
      ? Object.fromEntries(item.item_metadata)
      : (item.item_metadata || {});

    if (meta.batch_number) {
      const existing = await ProductBatch.findOne({
        shop: shopId, product: item.product,
        batch_number: String(meta.batch_number).trim(),
      }).session(session || null);
      if (existing) {
        const newQty = Math.max(0, existing.quantity - Number(item.quantity || 0));
        existing.quantity = newQty;
        existing.is_depleted = newQty === 0;
        await existing.save(opts);
      }
    }

    if (meta.variant_id) {
      await ProductVariant.findByIdAndUpdate(
        meta.variant_id,
        { $inc: { quantity: -Number(item.quantity || 0) } },
        opts
      );
    }

    const serialNumbers = Array.isArray(meta.serial_numbers) ? meta.serial_numbers
      : (meta.serial_number ? [meta.serial_number] : []);
    if (serialNumbers.length > 0) {
      await SerialInventory.deleteMany({
        shop: shopId,
        serial_number: { $in: serialNumbers.filter(sn => sn && String(sn).trim()) },
        status: 'in_stock',
      }, opts);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Supplier ledger helpers
// ─────────────────────────────────────────────────────────────────────────────

const reverseSupplierLedgerForPurchase = async (purchase, session = null) => {
  if (purchase.payment_type !== 'credit') return;

  const supplierId = purchase.supplier;
  const supplier = supplierId
    ? await Supplier.findById(supplierId).session(session || null)
    : await Supplier.findOne({
        shop: purchase.shop,
        name: { $regex: new RegExp(`^${purchase.supplier_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      }).session(session || null);

  if (!supplier) return;

  supplier.totalPurchased = Math.max(0, round2((supplier.totalPurchased || 0) - (purchase.total_amount || 0)));
  supplier.totalPaid = Math.max(0, round2((supplier.totalPaid || 0) - (purchase.amount_paid || 0)));
  supplier.totalUdhaar = Math.max(0, round2(supplier.totalPurchased - supplier.totalPaid));
  await supplier.save(session ? { session } : {});
  await SupplierUdhaar.deleteMany(
    { shop: purchase.shop, reference_id: purchase.invoice_number, reference_type: 'purchase' },
    session ? { session } : {}
  );
};

const syncSupplierLedgerForPurchase = async (shopId, purchase, itemNames = [], session = null) => {
  if (purchase.payment_type !== 'credit' || !purchase.supplier_name) return;

  const {
    supplier_name: supplierName, supplier_phone: supplierPhone,
    supplier_gstin: supplierGstin, supplier_address: supplierAddress,
    supplier_state: supplierState, total_amount: grandTotal,
    amount_paid: paid, invoice_number: invoiceNumber,
  } = purchase;

  let supplierQuery = Supplier.findOne({
    shop: shopId,
    $or: [
      { name: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ...(supplierPhone ? [{ phone: supplierPhone }] : []),
    ],
  });
  if (session) supplierQuery = supplierQuery.session(session);
  let supplier = await supplierQuery;

  if (!supplier) {
    const createdSuppliers = await Supplier.create([{
      shop: shopId, name: supplierName,
      phone: supplierPhone || '', gstin: supplierGstin || '',
      address: supplierAddress || '', state: supplierState || '',
      totalPurchased: 0, totalPaid: 0, totalUdhaar: 0,
    }], session ? { session } : {});
    supplier = createdSuppliers[0];
  }

  supplier.totalPurchased = round2((supplier.totalPurchased || 0) + grandTotal);
  supplier.totalPaid = round2((supplier.totalPaid || 0) + paid);
  supplier.totalUdhaar = round2(supplier.totalPurchased - supplier.totalPaid);
  await supplier.save(session ? { session } : {});

  purchase.supplier = supplier._id;
  await purchase.save(session ? { session } : {});

  await SupplierUdhaar.deleteMany(
    { shop: shopId, reference_id: invoiceNumber, reference_type: 'purchase' },
    session ? { session } : {}
  );
  await SupplierUdhaar.create([{
    shop: shopId, supplier: supplier._id, type: 'debit',
    amount: grandTotal, running_balance: supplier.totalUdhaar,
    note: `Credit Purchase - ${itemNames.join(', ')} (${invoiceNumber})`,
    date: new Date(), reference_id: invoiceNumber, reference_type: 'purchase',
  }], session ? { session } : {});

  if (paid > 0) {
    await SupplierUdhaar.create([{
      shop: shopId, supplier: supplier._id, type: 'credit',
      amount: paid, running_balance: supplier.totalUdhaar,
      payment_mode: purchase.amount_paid_mode || '',
      note: `Advance payment at time of purchase (${invoiceNumber})`,
      date: new Date(), reference_id: invoiceNumber, reference_type: 'purchase',
    }], session ? { session } : {});
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Build purchase record data
// ─────────────────────────────────────────────────────────────────────────────

const buildPurchaseRecordData = async ({ shop, payload, existingPurchase = null, invoiceNumber = null, session = null }) => {
  const {
    items, product_id, quantity, price_per_unit,
    supplier_name, supplier_phone, supplier_gstin,
    supplier_address, supplier_state,
    payment_type = 'cash', amount_paid = 0, amount_paid_mode = '',
    purchase_date, due_date, notes,
  } = payload;

  if (payment_type === 'credit' && !supplier_name) {
    throw new Error('Credit purchase ke liye supplier ka naam zaroori hai!');
  }

  const rawItems = items && items.length > 0
    ? items
    : [{ product_id, quantity, price_per_unit }];

  if (!rawItems?.length) throw new Error('Kam se kam ek item zaroori hai');

  const normalizedSupplierGstin = normalizeGstin(supplier_gstin);
  if (normalizedSupplierGstin && !GSTIN_REGEX.test(normalizedSupplierGstin)) {
    throw new Error('Invalid GSTIN format');
  }
  const resolvedSupplierState = getStateFromGstin(normalizedSupplierGstin) || supplier_state || '';
  const parsedPurchaseDate = parsePurchaseDateInput(purchase_date, existingPurchase?.createdAt || new Date());
  if (purchase_date && !parsedPurchaseDate) throw new Error('Invalid purchase date');
  const purchaseDate = parsedPurchaseDate || existingPurchase?.createdAt || new Date();
  const requestedAmountPaid = Number(amount_paid || 0);
  if (!Number.isFinite(requestedAmountPaid) || requestedAmountPaid < 0) {
    throw new Error('Invalid amount paid');
  }

  const resolvedItems = [];
  let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalGST = 0, grandTotal = 0;

  for (const item of rawItems) {
    let productQuery = Product.findById(item.product_id || item.product);
    if (session) productQuery = productQuery.session(session);
    const product = await productQuery;
    if (!product) throw new Error(`Product not found: ${item.product_id || item.product}`);

    const qty = Number(item.quantity);
    const ppu = Number(item.price_per_unit);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(ppu) || ppu < 0) {
      throw new Error(`Invalid quantity or price for ${product.name}`);
    }
    const gst_rate = Number.isFinite(Number(item.gst_rate)) ? Number(item.gst_rate) : (product.gst_rate || 0);
    const taxable = parseFloat((qty * ppu).toFixed(2));
    const gstCalc = calculateGST(taxable, gst_rate, shop.state, resolvedSupplierState);
    const lineTotal = parseFloat((taxable + gstCalc.total_gst).toFixed(2));

    totalTaxable += taxable;
    totalCGST += gstCalc.cgst_amount;
    totalSGST += gstCalc.sgst_amount;
    totalIGST += gstCalc.igst_amount;
    totalGST += gstCalc.total_gst;
    grandTotal += lineTotal;

    resolvedItems.push({
      product: product._id,
      product_name: item.product_name || product.name,
      hsn_code: item.hsn_code || product.hsn_code,
      quantity: qty,
      price_per_unit: ppu,
      gst_rate,
      taxable_amount: taxable,
      ...gstCalc,
      total_amount: lineTotal,
      item_metadata: item.item_metadata || {},
    });
  }

  totalTaxable = round2(totalTaxable);
  totalGST = round2(totalGST);
  grandTotal = round2(grandTotal);
  if (requestedAmountPaid > grandTotal) throw new Error('Amount paid cannot exceed bill total');
  const paid = round2(payment_type === 'credit' ? requestedAmountPaid : grandTotal);
  const firstItem = resolvedItems[0];

  // Parse due_date if provided
  let parsedDueDate = null;
  if (due_date) {
    parsedDueDate = parsePurchaseDateInput(due_date, purchaseDate);
  } else if (payment_type === 'credit' && existingPurchase?.due_date) {
    parsedDueDate = existingPurchase.due_date;
  }

  return {
    itemNames: resolvedItems.map((item) => item.product_name),
    resolvedItems,
    data: {
      shop: shop._id,
      items: resolvedItems,
      product: firstItem.product,
      product_name: firstItem.product_name,
      hsn_code: firstItem.hsn_code,
      quantity: firstItem.quantity,
      price_per_unit: firstItem.price_per_unit,
      gst_rate: firstItem.gst_rate,
      gst_type: firstItem.gst_type,
      invoice_type: normalizedSupplierGstin ? 'B2B' : 'B2C',
      invoice_number: invoiceNumber || existingPurchase?.invoice_number || await generateBillNumber(shop._id, session, purchaseDate),
      taxable_amount: totalTaxable,
      cgst_amount: round2(totalCGST),
      sgst_amount: round2(totalSGST),
      igst_amount: round2(totalIGST),
      total_gst: totalGST,
      total_amount: grandTotal,
      payment_type,
      amount_paid: paid,
      amount_paid_mode: payment_type === 'credit' ? (amount_paid_mode || '') : payment_type,
      supplier_name: supplier_name || '',
      supplier_phone: supplier_phone || '',
      supplier_gstin: normalizedSupplierGstin,
      supplier_address: supplier_address || '',
      supplier_state: resolvedSupplierState,
      due_date: parsedDueDate,
      notes,
      createdAt: purchaseDate,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PURCHASES
// ─────────────────────────────────────────────────────────────────────────────

const getPurchases = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { supplierId, payment_status, from, to, limit: limitParam, cursor } = req.query;

    const filter = { shop: shop._id };
    if (supplierId) filter.supplier = supplierId;
    if (payment_status) filter.payment_status = payment_status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    // Default: last 3 months if no date range specified
    if (!filter.createdAt && !from && !to) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      filter.createdAt = { $gte: threeMonthsAgo };
    }
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 200, 500);
    const purchases = await Purchase.find(filter)
      .populate('supplier', 'name phone gstin')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1);

    const hasMore = purchases.length > pageSize;
    const page = hasMore ? purchases.slice(0, pageSize) : purchases;
    const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

    const summary = page.reduce(
      (acc, p) => {
        acc.totalPurchaseValue += p.total_amount || 0;
        acc.totalITC += p.total_gst || 0;
        acc.totalPaid += p.amount_paid || 0;
        acc.totalDue += p.balance_due || 0;
        return acc;
      },
      { totalPurchaseValue: 0, totalITC: 0, totalPaid: 0, totalDue: 0 }
    );

    res.json({ purchases: page, summary, hasMore, nextCursor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PURCHASE
// ─────────────────────────────────────────────────────────────────────────────

const createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let createdPurchaseId;
    let auditShopId = null;
    const offlineOperationId = normalizeOfflineOperationId(req.body?.offline_operation_id);

    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id, session);
      auditShopId = shop._id;
      if (offlineOperationId) {
        const existingPurchase = await Purchase.findOne({
          shop: shop._id,
          offline_operation_id: offlineOperationId,
        }).session(session);
        if (existingPurchase) {
          createdPurchaseId = existingPurchase._id;
          return;
        }
      }
      const parsedPurchaseDate = parsePurchaseDateInput(req.body?.purchase_date, new Date()) || new Date();
      const invoiceNumber = await generateBillNumber(shop._id, session, parsedPurchaseDate);
      const { data, itemNames } = await buildPurchaseRecordData({
        shop, payload: req.body, invoiceNumber, session,
      });

      await syncPurchaseStock(null, data.items, data.invoice_number, session);
      await syncSubInventoryOnPurchase([], data.items, data.invoice_number, shop._id, session);

      const createdPurchases = await Purchase.create([{
        ...data, shop: shop._id,
        offline_operation_id: offlineOperationId,
      }], { session });

      const createdPurchase = createdPurchases[0];
      createdPurchaseId = createdPurchase._id;
      await syncSupplierLedgerForPurchase(shop._id, createdPurchase, itemNames, session);
    });

    const hydratedPurchase = await Purchase.findById(createdPurchaseId).populate('supplier', 'name phone gstin');
    await logAuditEvent({
      shopId: auditShopId || hydratedPurchase?.shop,
      userId: req.user.id,
      actionType: 'create', entity: 'purchase',
      entityId: hydratedPurchase._id,
      referenceId: hydratedPurchase.invoice_number,
      afterValue: hydratedPurchase,
    });
    return res.status(201).json(hydratedPurchase);
  } catch (err) {
    if (err?.code === 11000 && req.body?.offline_operation_id) {
      const shop = await getOrCreateShop(req.user.id);
      const existingPurchase = await Purchase.findOne({
        shop: shop._id,
        offline_operation_id: normalizeOfflineOperationId(req.body.offline_operation_id),
      }).populate('supplier', 'name phone gstin');
      if (existingPurchase) return res.status(200).json(existingPurchase);
    }
    res.status(500).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PURCHASE
// ─────────────────────────────────────────────────────────────────────────────

const updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let purchaseId;
    let beforeValue = null;
    let auditShopId = null;

    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id, session);
      auditShopId = shop._id;
      const purchase = await Purchase.findOne({ _id: req.params.id, shop: shop._id }).session(session);
      if (!purchase) throw new Error('Purchase not found');
      beforeValue = cloneForAudit(purchase);

      const { data, itemNames } = await buildPurchaseRecordData({
        shop, payload: req.body, existingPurchase: purchase,
        invoiceNumber: purchase.invoice_number, session,
      });

      await reverseSupplierLedgerForPurchase(purchase, session);
      await syncPurchaseStock(purchase, data.items, purchase.invoice_number, session);
      await syncSubInventoryOnPurchase(purchase.items || [], data.items, purchase.invoice_number, shop._id, session);

      Object.assign(purchase, data, { supplier: null });
      await purchase.save({ session });
      await syncSupplierLedgerForPurchase(shop._id, purchase, itemNames, session);
      purchaseId = purchase._id;
    });

    const hydratedPurchase = await Purchase.findById(purchaseId).populate('supplier', 'name phone gstin');
    await logAuditEvent({
      shopId: auditShopId || hydratedPurchase?.shop,
      userId: req.user.id,
      actionType: 'update', entity: 'purchase',
      entityId: hydratedPurchase._id,
      referenceId: hydratedPurchase.invoice_number,
      beforeValue, afterValue: hydratedPurchase,
    });
    res.json(hydratedPurchase);
  } catch (err) {
    if (err.message === 'Purchase not found') return res.status(404).json({ message: err.message });
    res.status(500).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PURCHASE (reverses stock + sub-inventory + supplier ledger)
// ─────────────────────────────────────────────────────────────────────────────

const deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let deletedPurchase = null;
    let auditShopId = null;
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id, session);
      auditShopId = shop._id;
      const purchase = await Purchase.findOne({ _id: req.params.id, shop: shop._id }).session(session);
      if (!purchase) throw new Error('Purchase not found');
      deletedPurchase = cloneForAudit(purchase);

      // Reverse stock with history logging
      const itemsToReverse = purchase.items && purchase.items.length > 0
        ? purchase.items
        : (purchase.product ? [{ product: purchase.product, quantity: purchase.quantity }] : []);

      for (const item of itemsToReverse) {
        let productQuery = Product.findById(item.product);
        if (session) productQuery = productQuery.session(session);
        const product = await productQuery;
        if (!product) continue;
        const quantityAfter = round2(product.quantity - Number(item.quantity || 0));
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
          $push: {
            stock_history: {
              type: 'purchase_return',
              quantity_change: -Number(item.quantity),
              quantity_after: quantityAfter,
              note: `Purchase deleted: ${purchase.invoice_number}`,
              reference_id: purchase.invoice_number,
              date: new Date(),
            },
          },
        }, { session });
      }

      // Reverse sub-inventory records (batches, variants, serials)
      await reverseSubInventoryForPurchase(purchase.items || [], shop._id, session);
      await reverseSupplierLedgerForPurchase(purchase, session);
      await Purchase.findOneAndDelete({ _id: req.params.id, shop: shop._id }, { session });
    });

    if (deletedPurchase) {
      await logAuditEvent({
        shopId: auditShopId || deletedPurchase.shop,
        userId: req.user.id,
        actionType: 'delete', entity: 'purchase',
        entityId: deletedPurchase._id,
        referenceId: deletedPurchase.invoice_number,
        beforeValue: deletedPurchase,
      });
    }

    res.json({ message: 'Purchase deleted and stock reversed' });
  } catch (err) {
    if (err.message === 'Purchase not found') return res.status(404).json({ message: err.message });
    res.status(500).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ITC SUMMARY (used by GST page)
// ─────────────────────────────────────────────────────────────────────────────

const getITCSummary = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const purchases = await Purchase.find({
      shop: shop._id,
      createdAt: { $gte: start, $lte: end },
    });

    const summary = purchases.reduce(
      (acc, p) => {
        acc.totalPurchaseValue += p.total_amount || 0;
        acc.totalITC += p.total_gst || 0;
        acc.totalCGST += p.cgst_amount || 0;
        acc.totalSGST += p.sgst_amount || 0;
        acc.totalIGST += p.igst_amount || 0;
        acc.count += 1;
        return acc;
      },
      { totalPurchaseValue: 0, totalITC: 0, totalCGST: 0, totalSGST: 0, totalIGST: 0, count: 0 }
    );

    Object.keys(summary).forEach((k) => {
      if (k !== 'count') summary[k] = parseFloat(summary[k].toFixed(2));
    });

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { getPurchases, createPurchase, updatePurchase, deletePurchase, getITCSummary };
