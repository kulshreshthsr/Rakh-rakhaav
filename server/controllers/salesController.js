const mongoose = require('mongoose');
const Sale       = require('../models/salesModel');
const SaleReturn = require('../models/saleReturnModel');
const Product  = require('../models/productModel');
const Shop     = require('../models/shopModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Udhaar   = require('../models/udhaarModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { generateGSTComplianceReport } = require('../utils/gstReportGenerator');
const { cloneForAudit, logAuditEvent } = require('../utils/auditTrail');
const ruleEngine = require('../services/ruleEngine');
const ProductBatch    = require('../models/productBatchModel');
const ProductVariant  = require('../models/productVariantModel');
const Recipe          = require('../models/recipeModel');
const SerialInventory = require('../models/serialInventoryModel');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const { GST_STATE_CODE_MAP, GSTIN_REGEX, getStateFromGstin: _getStateFromGstinShared } = require('../lib/sharedUtils');

const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');
const { logStockMovements } = require('../utils/stockMovementLogger');

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

function parseWarrantyExpiry(warrantyStr, fromDate = new Date()) {
  if (!warrantyStr || warrantyStr === 'No Warranty') return null;
  const d = new Date(fromDate);
  const m = warrantyStr.match(/(\d+)\s*(month|year)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (/year/i.test(m[2])) d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Generate the next invoice number for a shop.
 * @param {object} shopOrId - MUST be the full shop document to use custom invoice_prefix,
 *   invoice_number_digits, and invoice_start_number. Passing only a shopId string falls back
 *   to the generic INV/FY/NNNN format silently.
 * @param {ClientSession|null} session
 * @param {Date} invoiceDate
 */
const generateInvoiceNumber = async (shopOrId, session = null, invoiceDate = new Date()) => {
  // Accept either a shop object (with invoice format fields) or just a shopId string
  const shopId = shopOrId?._id || shopOrId;
  const financialYear = getFinancialYear(invoiceDate);
  // Read invoice_start_number from shop object if available; default to 1.
  // On first upsert, last_number is seeded to (startNumber - 1) so that after
  // the +1 increment the first issued number equals invoice_start_number exactly.
  const startNumber = (shopOrId?.invoice_start_number && shopOrId.invoice_start_number > 1)
    ? shopOrId.invoice_start_number
    : 1;

  // Aggregation pipeline update: atomic, single round-trip, MongoDB 4.2+.
  // $ifNull handles the upsert case (field absent on new doc).
  let query = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'sale', financial_year: financialYear },
    [{ $set: { last_number: { $add: [{ $ifNull: ['$last_number', startNumber - 1] }, 1] } } }],
    { new: true, upsert: true, updatePipeline: true }
  );
  if (session) query = query.session(session);
  const sequence = await query;

  // Apply custom format if shop object was passed
  if (shopOrId?._id) {
    const digits = shopOrId.invoice_number_digits || 4;
    const prefix = shopOrId.invoice_prefix ? `${shopOrId.invoice_prefix}-` : '';
    return `${prefix}${String(sequence.last_number).padStart(digits, '0')}`;
  }
  return `INV/${financialYear}/${String(sequence.last_number).padStart(4, '0')}`;
};

const generateQuotationNumber = async (shopId, session = null, date = new Date()) => {
  const financialYear = getFinancialYear(date);
  let q = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'quotation', financial_year: financialYear },
    [{ $set: { last_number: { $add: [{ $ifNull: ['$last_number', 0] }, 1] } } }],
    { new: true, upsert: true, updatePipeline: true }
  );
  if (session) q = q.session(session);
  const seq = await q;
  return `QT/${financialYear}/${String(seq.last_number).padStart(4, '0')}`;
};

const normalizeState = (value = '') => value.trim().toLowerCase();
const normalizeGstin = (value = '') => String(value).replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);

// Reverse map: normalised state name → 2-digit GST state code
const STATE_NAME_TO_CODE = Object.fromEntries(
  Object.entries(GST_STATE_CODE_MAP).map(([code, name]) => [name.trim().toLowerCase(), code])
);
const getStateCodeFromName = (stateName = '') => STATE_NAME_TO_CODE[stateName.trim().toLowerCase()] || '';
const getStateCodeFromGstin = (gstin = '') => {
  const g = normalizeGstin(gstin);
  return g.length === 15 ? g.slice(0, 2) : '';
};
const normalizeOfflineOperationId = (value = '') => {
  const normalized = String(value || '').trim();
  return normalized || null;
};
const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));
const parseSaleDateInput = (value, referenceDate = new Date()) => {
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
const getStateFromGstin = (gstin = '') => {
  const normalized = normalizeGstin(gstin);
  if (!GSTIN_REGEX.test(normalized)) return '';
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || '';
};

const sumTaxHeads = (records = []) => ({
  cgst: round2(records.reduce((sum, record) => sum + (record.cgst_amount || 0), 0)),
  sgst: round2(records.reduce((sum, record) => sum + (record.sgst_amount || 0), 0)),
  igst: round2(records.reduce((sum, record) => sum + (record.igst_amount || 0), 0)),
});

const applyCredit = (availableCredit, liabilities, fromHead, targets, utilization) => {
  let remainingCredit = availableCredit[fromHead] || 0;

  for (const target of targets) {
    if (remainingCredit <= 0) break;
    const usable = Math.min(remainingCredit, liabilities[target] || 0);
    if (usable <= 0) continue;

    liabilities[target] = round2(liabilities[target] - usable);
    remainingCredit = round2(remainingCredit - usable);
    utilization[fromHead][target] = round2((utilization[fromHead][target] || 0) + usable);
  }

  availableCredit[fromHead] = remainingCredit;
};

const calculateGSTR3BSummary = (sales = [], purchases = []) => {
  const outputTax = sumTaxHeads(sales);
  const inputCredit = sumTaxHeads(purchases);
  const liabilities = { ...outputTax };
  const remainingCredit = { ...inputCredit };
  const utilization = {
    igst: { igst: 0, cgst: 0, sgst: 0 },
    cgst: { igst: 0, cgst: 0, sgst: 0 },
    sgst: { igst: 0, cgst: 0, sgst: 0 },
  };

  // As per GST utilization order: IGST credit first, then CGST/SGST.
  applyCredit(remainingCredit, liabilities, 'igst', ['igst', 'cgst', 'sgst'], utilization);
  applyCredit(remainingCredit, liabilities, 'cgst', ['cgst', 'igst'], utilization);
  applyCredit(remainingCredit, liabilities, 'sgst', ['sgst', 'igst'], utilization);

  const outputTotal = round2(outputTax.cgst + outputTax.sgst + outputTax.igst);
  const inputTotal = round2(inputCredit.cgst + inputCredit.sgst + inputCredit.igst);
  const payable = {
    cgst: round2(liabilities.cgst),
    sgst: round2(liabilities.sgst),
    igst: round2(liabilities.igst),
  };
  const payableTotal = round2(payable.cgst + payable.sgst + payable.igst);
  const excessCredit = {
    cgst: round2(remainingCredit.cgst),
    sgst: round2(remainingCredit.sgst),
    igst: round2(remainingCredit.igst),
  };

  return {
    outward_taxable: round2(sales.reduce((sum, record) => sum + (record.taxable_amount || 0), 0)),
    output_gst: outputTotal,
    input_gst: inputTotal,
    output_tax: outputTax,
    input_tax_credit: inputCredit,
    credit_utilized: utilization,
    payable_by_head: payable,
    payable_total: payableTotal,
    excess_credit: excessCredit,
    net_payable: payableTotal,
  };
};

const calculateGST = (taxable_amount, gst_rate, shopStateCode, buyerStateCode) => {
  const totalGst = round2((taxable_amount * gst_rate) / 100);
  // Use 2-digit GST state codes for reliable inter/intra-state determination.
  // If either code is missing, default to intra-state (CGST+SGST) as safe fallback.
  const isIGST = shopStateCode && buyerStateCode && shopStateCode !== buyerStateCode;
  if (isIGST) {
    return {
      cgst_amount: 0, sgst_amount: 0,
      igst_amount: totalGst,
      total_gst: totalGst,
      gst_type:    'IGST',
    };
  } else {
    const cgst = round2(totalGst / 2);
    const sgst = round2(totalGst - cgst);
    return {
      cgst_amount: cgst, sgst_amount: sgst, igst_amount: 0,
      total_gst: totalGst,
      gst_type:    'CGST_SGST',
    };
  }
};

const getExistingItemQuantities = (record) => {
  const quantityMap = new Map();
  const sourceItems = record?.items?.length
    ? record.items
    : (record?.product ? [{ product: record.product, quantity: record.quantity }] : []);

  for (const item of sourceItems) {
    const productId = String(item.product);
    quantityMap.set(productId, (quantityMap.get(productId) || 0) + Number(item.quantity || 0));
  }

  return quantityMap;
};

const syncSaleStock = async (previousSale, nextItems, invoiceNumber = '', session = null) => {
  const previousMap = getExistingItemQuantities(previousSale);
  const nextMap = new Map();

  for (const item of nextItems) {
    const productId = String(item.product);
    nextMap.set(productId, (nextMap.get(productId) || 0) + Number(item.quantity || 0));
  }

  const productIds = [...new Set([...previousMap.keys(), ...nextMap.keys()])];

  for (const productId of productIds) {
    const previousQty = previousMap.get(productId) || 0;
    const nextQty = nextMap.get(productId) || 0;
    const delta = nextQty - previousQty;
    if (!delta) continue;

    let productQuery = Product.findById(productId);
    if (session) productQuery = productQuery.session(session);
    const product = await productQuery;
    if (!product) throw new Error('Product not found while updating sale');
    if (delta > 0 && product.quantity < delta) {
      throw new Error(`${product.name}: sirf ${product.quantity} stock available hai`);
    }

    const quantityAfter = round2(product.quantity - delta);
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: -delta },
    }, session ? { session } : {});
    await logStockMovements(shop._id, [{
      product: product._id,
      type: delta > 0 ? 'sale' : 'sale_return',
      quantityChange: -delta,
      quantityAfter,
      referenceId: invoiceNumber,
      referenceType: 'sale',
      note: '',
      performedBy: req.user?.id,
    }], { session });
  }
};

/**
 * Handles sub-inventory deduction AFTER the core product.quantity has already been updated.
 * Reads item_metadata from each sale item to determine which records to update:
 *   batch_id      → deduct from ProductBatch
 *   variant_id    → deduct from ProductVariant
 *   serial_ids[]  → mark SerialInventory records as 'sold'
 *   deduct_recipe → true → deduct recipe ingredients for this dish
 */
const syncSubInventory = async (previousItems = [], nextItems = [], invoiceNumber = '', session = null) => {
  // Key = "productId:batchId" | "productId:variantId" | "productId:" (no sub-key)
  const makeKey = (item) => {
    const meta = item.item_metadata instanceof Map
      ? Object.fromEntries(item.item_metadata)
      : (item.item_metadata || {});
    const sub = meta.batch_id || meta.variant_id || '';
    return `${String(item.product)}:${sub}`;
  };

  // Build map of previous quantities per composite key
  const prevMap = new Map();
  for (const item of previousItems) {
    const key = makeKey(item);
    prevMap.set(key, {
      qty: (prevMap.get(key)?.qty || 0) + Number(item.quantity || 0),
      meta: item.item_metadata instanceof Map
        ? Object.fromEntries(item.item_metadata)
        : (item.item_metadata || {}),
      product: item.product,
    });
  }

  // Build map of next quantities per composite key
  const nextMap = new Map();
  for (const item of nextItems) {
    const key = makeKey(item);
    const meta = item.item_metadata instanceof Map
      ? Object.fromEntries(item.item_metadata)
      : (item.item_metadata || {});
    nextMap.set(key, {
      qty: (nextMap.get(key)?.qty || 0) + Number(item.quantity || 0),
      meta,
      product: item.product,
    });
  }

  const allKeys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const opts = session ? { session } : {};

  for (const key of allKeys) {
    const prev     = prevMap.get(key);
    const next     = nextMap.get(key);
    const prevQty  = prev?.qty || 0;
    const nextQty  = next?.qty || 0;
    const delta    = nextQty - prevQty;  // positive = more sold, negative = fewer sold
    const meta     = next?.meta || prev?.meta || {};
    const product  = next?.product || prev?.product;

    if (delta === 0) continue;

    // ── Batch ──────────────────────────────────────────────────────────────
    if (meta.batch_id) {
      await ProductBatch.findByIdAndUpdate(meta.batch_id, { $inc: { quantity: -delta } }, opts);
      if (delta > 0) {
        await ProductBatch.updateOne(
          { _id: meta.batch_id, quantity: { $lte: 0 } },
          { $set: { is_depleted: true, quantity: 0 } },
          opts
        );
      } else {
        // Restoring stock — un-deplete if now positive
        await ProductBatch.updateOne(
          { _id: meta.batch_id, quantity: { $gt: 0 } },
          { $set: { is_depleted: false } },
          opts
        );
      }
    }

    // ── Variant ────────────────────────────────────────────────────────────
    if (meta.variant_id) {
      await ProductVariant.findByIdAndUpdate(meta.variant_id, { $inc: { quantity: -delta } }, opts);
    }

    // ── Serial — only mark/unmark when adding or removing serials ──────────
    if (Array.isArray(meta.serial_ids) && meta.serial_ids.length > 0) {
      if (delta > 0) {
        const saleDate = new Date();
        const update = { status: 'sold', sale_invoice: invoiceNumber, sale_date: saleDate };

        // Auto-set warranty_expiry from product metadata warranty period
        if (product) {
          const productDoc = await Product.findById(product).select('metadata').session(session || null);
          const warrantyStr = productDoc?.metadata?.get?.('warranty') || '';
          const expiry = parseWarrantyExpiry(warrantyStr, saleDate);
          if (expiry) update.warranty_expiry = expiry;
        }

        await SerialInventory.updateMany({ _id: { $in: meta.serial_ids } }, { $set: update }, opts);
      } else {
        await SerialInventory.updateMany(
          { _id: { $in: meta.serial_ids } },
          { $set: { status: 'in_stock' }, $unset: { sale_invoice: '', sale_date: '', warranty_expiry: '' } },
          opts
        );
      }
    }

    // ── Recipe ingredients ─────────────────────────────────────────────────
    if (meta.deduct_recipe && product) {
      const recipe = await Recipe.findOne({ dish: product }).session(session || null);
      if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
        const servings = recipe.serving_quantity || 1;
        for (const ing of recipe.ingredients) {
          const deductQty = (ing.quantity / servings) * delta;
          if (deductQty !== 0 && ing.ingredient) {
            await Product.findByIdAndUpdate(ing.ingredient, { $inc: { quantity: -deductQty } }, opts);
          }
        }
      }
    }
  }
};

const syncCustomerLedgerForSale = async (shopId, saleDoc, itemNames = [], session = null) => {
  if (saleDoc.payment_type !== 'credit' || !saleDoc.buyer_name) {
    saleDoc.customer = null;
    await saleDoc.save(session ? { session, validateBeforeSave: false } : { validateBeforeSave: false });
    return;
  }

  let customer = saleDoc.customer
    ? await Customer.findById(saleDoc.customer).session(session || null)
    : null;

  if (!customer) {
    let customerQuery = Customer.findOne({
      shop: shopId,
      $or: [
        { name: { $regex: new RegExp(`^${saleDoc.buyer_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ...(saleDoc.buyer_phone ? [{ phone: saleDoc.buyer_phone }] : []),
      ],
    });
    if (session) customerQuery = customerQuery.session(session);
    customer = await customerQuery;
  }

  if (!customer) {
    const createdCustomers = await Customer.create([{
      shop: shopId,
      name: saleDoc.buyer_name,
      phone: saleDoc.buyer_phone || '',
      gstin: saleDoc.buyer_gstin || '',
      address: saleDoc.buyer_address || '',
      totalSales: 0,
      totalPaid: 0,
      totalUdhaar: 0,
    }], session ? { session } : {});
    customer = createdCustomers[0];
  }

  customer.name = saleDoc.buyer_name;
  customer.phone = saleDoc.buyer_phone || '';
  customer.gstin = saleDoc.buyer_gstin || '';
  customer.address = saleDoc.buyer_address || '';
  customer.totalSales = round2((customer.totalSales || 0) + saleDoc.total_amount);
  customer.totalPaid = round2((customer.totalPaid || 0) + (saleDoc.amount_paid || 0));
  customer.totalUdhaar = round2(customer.totalSales - customer.totalPaid);
  await customer.save(session ? { session } : {});

  saleDoc.customer = customer._id;
  await saleDoc.save(session ? { session, validateBeforeSave: false } : { validateBeforeSave: false });
  await Udhaar.deleteMany({ shop: shopId, reference_id: saleDoc.invoice_number, reference_type: 'sale' }, session ? { session } : {});

  // running_balance after debit = final balance + any advance not yet applied
  const balanceAfterDebit  = round2(customer.totalUdhaar + (saleDoc.amount_paid || 0));
  const balanceAfterCredit = customer.totalUdhaar;

  await Udhaar.create([{
    shop: shopId,
    customer: customer._id,
    type: 'debit',
    amount: saleDoc.total_amount,
    running_balance: balanceAfterDebit,
    note: `Credit Sale - ${itemNames.join(', ')} (${saleDoc.invoice_number})`,
    date: saleDoc.createdAt || new Date(),
    reference_id: saleDoc.invoice_number,
    reference_type: 'sale',
  }], session ? { session } : {});

  if (saleDoc.amount_paid > 0) {
    await Udhaar.create([{
      shop: shopId,
      customer: customer._id,
      type: 'credit',
      amount: saleDoc.amount_paid,
      running_balance: balanceAfterCredit,
      payment_mode: saleDoc.amount_paid_mode || '',
      note: `Advance payment at time of sale (${saleDoc.invoice_number})`,
      date: saleDoc.createdAt || new Date(),
      reference_id: saleDoc.invoice_number,
      reference_type: 'sale',
    }], session ? { session } : {});
  }
};

const reverseCustomerLedgerForSale = async (saleDoc, session = null) => {
  if (saleDoc.payment_type !== 'credit') return;

  const customer = saleDoc.customer
    ? await Customer.findById(saleDoc.customer).session(session || null)
    : await Customer.findOne({
        shop: saleDoc.shop,
        name: { $regex: new RegExp(`^${saleDoc.buyer_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      }).session(session || null);

  if (!customer) return;

  customer.totalSales = Math.max(0, round2((customer.totalSales || 0) - (saleDoc.total_amount || 0)));
  customer.totalPaid  = Math.max(0, round2((customer.totalPaid  || 0) - (saleDoc.amount_paid  || 0)));
  // Prevent negative udhaar: if totalPaid was overclamped relative to totalSales, normalize
  customer.totalUdhaar = Math.max(0, round2(customer.totalSales - customer.totalPaid));
  await customer.save(session ? { session } : {});
  await Udhaar.deleteMany({ shop: saleDoc.shop, reference_id: saleDoc.invoice_number, reference_type: 'sale' }, session ? { session } : {});
};

const reverseSubInventoryForSale = async (items = [], session = null) => {
  const opts = session ? { session } : {};
  for (const item of items) {
    const meta = item.item_metadata instanceof Map
      ? Object.fromEntries(item.item_metadata)
      : (item.item_metadata || {});

    if (meta.batch_id) {
      await ProductBatch.findByIdAndUpdate(
        meta.batch_id,
        { $inc: { quantity: Number(item.quantity || 0) }, $set: { is_depleted: false } },
        opts
      );
    }

    if (meta.variant_id) {
      await ProductVariant.findByIdAndUpdate(
        meta.variant_id,
        { $inc: { quantity: Number(item.quantity || 0) } },
        opts
      );
    }

    if (Array.isArray(meta.serial_ids) && meta.serial_ids.length > 0) {
      await SerialInventory.updateMany(
        { _id: { $in: meta.serial_ids } },
        { $set: { status: 'in_stock' }, $unset: { sale_invoice: '', sale_date: '' } },
        opts
      );
    }

    if (meta.deduct_recipe && item.product) {
      const recipe = await Recipe.findOne({ dish: item.product }).session(session || null);
      if (recipe?.ingredients?.length > 0) {
        const servings = recipe.serving_quantity || 1;
        for (const ing of recipe.ingredients) {
          const restoreQty = (ing.quantity / servings) * Number(item.quantity || 0);
          if (restoreQty > 0 && ing.ingredient) {
            await Product.findByIdAndUpdate(ing.ingredient, { $inc: { quantity: restoreQty } }, opts);
          }
        }
      }
    }
  }
};

const CUSTOMER_TYPE_TO_TIER = {
  contractor: 'dealer',
  project:    'project',
  walk_in:    'default',
};

function resolveItemPrice(product, tier) {
  if (tier === 'dealer')  return product.dealer_price  > 0 ? product.dealer_price  : product.price;
  if (tier === 'project') return product.project_price > 0 ? product.project_price : product.price;
  if (tier === 'mrp')     return product.mrp           > 0 ? product.mrp           : product.price;
  return product.price;
}

const buildSaleRecordData = async ({
  shop,
  payload,
  existingSale = null,
  invoiceNumber = null,
  session = null,
  skipStockCheck = false,
}) => {
  const {
    items,
    product_id, quantity, price_per_unit,
    buyer_name, buyer_phone, buyer_gstin,
    buyer_address, buyer_state,
    payment_type = 'cash',
    amount_paid = 0,
    amount_paid_mode = '',
    notes,
    sale_date,
    extra_fields,
    discount_type = 'none',
    discount_value = 0,
    price_tier: saleTierParam,
    customer: customerId,
    project: projectId,
    project_name: projectNameParam,
  } = payload;

  if (!items || items.length === 0) {
    const _splitDate = parseSaleDateInput(payload.sale_date) || new Date();
    return {
      itemNames: [],
      resolvedItems: [],
      data: {
        shop: shop._id,
        items: [],
        invoice_number: await generateInvoiceNumber(shop, session, _splitDate),
        total_amount: round2(Number(payload.total_amount) || Number(payload.amount_paid) || 0),
        taxable_amount: 0, total_gst: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0,
        total_cost: 0, gross_profit: 0,
        payment_type: payload.payment_type || 'cash',
        amount_paid:  round2(Number(payload.amount_paid) || 0),
        buyer_name: payload.buyer_name || '',
        buyer_phone: payload.buyer_phone || '',
        notes: payload.notes || '',
        extra_fields: payload.extra_fields || {},
        sale_type: 'payment_split',
        document_type: 'invoice',
        createdAt: _splitDate,
      },
    };
  }

  const _bizErr = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

  if (payment_type === 'credit' && !buyer_name) {
    throw _bizErr('Udhaar sale ke liye buyer ka naam zaroori hai!');
  }

  const rawItems = items && items.length > 0
    ? items
    : [{ product_id, quantity, price_per_unit }];

  if (!rawItems?.length) {
    throw _bizErr('Kam se kam ek item zaroori hai');
  }

  const normalizedBuyerGstin = normalizeGstin(buyer_gstin);
  if (normalizedBuyerGstin && !GSTIN_REGEX.test(normalizedBuyerGstin)) {
    throw _bizErr('Invalid GSTIN format');
  }
  const parsedSaleDate = parseSaleDateInput(sale_date, existingSale?.createdAt || new Date());
  if (sale_date && !parsedSaleDate) {
    throw _bizErr('Invalid sale date');
  }
  const saleDate = parsedSaleDate || existingSale?.createdAt || new Date();
  const resolvedBuyerState = getStateFromGstin(normalizedBuyerGstin) || buyer_state || '';
  // Derive 2-digit state codes for reliable IGST/CGST determination
  const shopStateCode = shop.gst_state_code || getStateCodeFromGstin(shop.gstin || '') || getStateCodeFromName(shop.state || '');
  const buyerStateCode = getStateCodeFromGstin(normalizedBuyerGstin) || getStateCodeFromName(resolvedBuyerState);
  const requestedAmountPaid = Number(amount_paid || 0);
  if (!Number.isFinite(requestedAmountPaid) || requestedAmountPaid < 0) {
    throw _bizErr('Invalid amount paid');
  }

  // ── Resolve sale-level price tier from customer_type ─────────────────────
  let saleLevelTier = saleTierParam || 'default';
  if (saleLevelTier === 'default' && customerId) {
    let custQ = Customer.findById(customerId).select('customer_type').lean();
    if (session) custQ = custQ.session(session);
    const cust = await custQ;
    if (cust?.customer_type) {
      saleLevelTier = CUSTOMER_TYPE_TO_TIER[cust.customer_type] || 'default';
    }
  }

  let totalTaxable = 0, totalCGST = 0, totalSGST = 0;
  let totalIGST = 0, totalGST = 0, grandTotal = 0;
  let totalCost = 0;
  const invoice_type = normalizedBuyerGstin ? 'B2B' : 'B2C';
  const resolvedItems = [];
  const previousQuantities = getExistingItemQuantities(existingSale);

  for (const item of rawItems) {
    let productQuery = Product.findById(item.product_id || item.product);
    if (session) productQuery = productQuery.session(session);
    const product = await productQuery;
    if (!product) throw _bizErr(`Product not found: ${item.product_id}`);

    const qty = Number(item.quantity);

    // ── Resolve price: item.price_per_unit takes priority; fall back to tier ─
    const itemTier = item.price_tier || saleLevelTier;
    let ppu;
    let priceTierUsed;
    if (item.price_per_unit !== undefined && item.price_per_unit !== null) {
      ppu = Number(item.price_per_unit);
      priceTierUsed = item.price_tier || 'custom';
    } else {
      ppu = resolveItemPrice(product, itemTier);
      priceTierUsed = itemTier;
    }

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(ppu) || ppu < 0) {
      throw _bizErr(`Invalid quantity or price for ${product.name}`);
    }

    const previousQty = previousQuantities.get(String(product._id)) || 0;
    const extraNeeded = Math.max(0, qty - previousQty);
    if (!skipStockCheck && product.quantity < extraNeeded) {
      throw _bizErr(`${product.name}: sirf ${product.quantity} stock available hai`);
    }

    const cost = Number.isFinite(Number(item.cost_price)) && Number(item.cost_price) > 0
      ? Number(item.cost_price)
      : (product.weighted_avg_cost > 0 ? product.weighted_avg_cost : (product.cost_price || 0));
    const gst_rate = Number.isFinite(Number(item.gst_rate)) ? Number(item.gst_rate) : (product.gst_rate || 0);
    const taxable = parseFloat((qty * ppu).toFixed(2));
    const gstCalc = calculateGST(taxable, gst_rate, shopStateCode, buyerStateCode);
    const lineTotal = parseFloat((taxable + gstCalc.total_gst).toFixed(2));
    const lineCost = parseFloat((cost * qty).toFixed(2));

    totalTaxable += taxable;
    totalCGST += gstCalc.cgst_amount;
    totalSGST += gstCalc.sgst_amount;
    totalIGST += gstCalc.igst_amount;
    totalGST += gstCalc.total_gst;
    grandTotal += lineTotal;
    totalCost += lineCost;

    resolvedItems.push({
      product: product._id,
      product_name: item.product_name || product.name,
      hsn_code: item.hsn_code || product.hsn_code,
      quantity: qty,
      price_per_unit: ppu,
      cost_price: cost,
      gst_rate,
      taxable_amount: taxable,
      ...gstCalc,
      total_amount: lineTotal,
      item_metadata: item.item_metadata || {},
      price_tier_used: priceTierUsed,
    });
  }

  totalTaxable = round2(totalTaxable);
  totalGST = round2(totalGST);
  grandTotal = round2(grandTotal);
  totalCost = round2(totalCost);

  // ── Bill-level discount (applied to taxable base before GST) ────────────
  let discount_amount = 0;
  const discVal = Number(discount_value) || 0;
  if (discount_type === 'flat' && discVal > 0) {
    discount_amount = round2(Math.min(discVal, totalTaxable));
  } else if (discount_type === 'percent' && discVal > 0) {
    discount_amount = round2((totalTaxable * discVal) / 100);
  }
  if (discount_amount > 0 && totalTaxable > 0) {
    const ratio = (totalTaxable - discount_amount) / totalTaxable;
    totalTaxable = round2(totalTaxable - discount_amount);
    totalGST    = round2(totalGST * ratio);
    totalCGST   = round2(totalCGST * ratio);
    totalSGST   = round2(totalSGST * ratio);
    totalIGST   = round2(totalIGST * ratio);
    grandTotal  = round2(totalTaxable + totalGST);
  }

  if (requestedAmountPaid > grandTotal) {
    throw _bizErr('Amount paid cannot exceed invoice total');
  }
  const paid = round2(payment_type === 'credit' ? requestedAmountPaid : grandTotal);
  const grossProfit = round2(totalTaxable - totalCost);
  const firstItem = resolvedItems[0];
  const uniqueRates = [...new Set(resolvedItems.map((item) => Number(item.gst_rate || 0)))];

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
      cost_price: firstItem.cost_price,
      gst_rate: uniqueRates.length === 1 ? firstItem.gst_rate : 0,
      gst_type: firstItem.gst_type,
      invoice_type,
      invoice_number: invoiceNumber || await generateInvoiceNumber(shop, session, saleDate),
      discount_type: discount_type || 'none',
      discount_value: discVal,
      discount_amount,
      taxable_amount: totalTaxable,
      cgst_amount: round2(totalCGST),
      sgst_amount: round2(totalSGST),
      igst_amount: round2(totalIGST),
      total_gst: totalGST,
      total_amount: grandTotal,
      total_cost: totalCost,
      gross_profit: grossProfit,
      payment_type,
      amount_paid: paid,
      amount_paid_mode: payment_type === 'credit' ? (amount_paid_mode || '') : payment_type,
      buyer_name: buyer_name || (invoice_type === 'B2C' ? 'Walk-in Customer' : ''),
      buyer_phone,
      buyer_gstin: normalizedBuyerGstin,
      buyer_address,
      buyer_state: resolvedBuyerState,
      notes,
      extra_fields: extra_fields || {},
      customer: customerId || null,
      project: projectId || null,
      project_name: projectNameParam || '',
      createdAt: saleDate,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE SALE BY ID
// ─────────────────────────────────────────────────────────────────────────────

const getSaleById = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id })
      .populate('customer', 'name phone');
    if (!sale) return res.status(404).json({ message: 'Sale नहीं मिली' });
    res.json(sale);
  } catch (err) {
    logger.error('[salesController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL SALES
// ─────────────────────────────────────────────────────────────────────────────

const getSales = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { payment_type, from, to, limit: limitParam, cursor } = req.query;

    const filter = { shop: shop._id };
    if (payment_type) filter.payment_type = payment_type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    // Default: last 3 months if no date range provided
    if (!filter.createdAt && !from && !to) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      filter.createdAt = { $gte: threeMonthsAgo };
    }
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 200, 500);
    const sales = await Sale.find(filter)
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1);

    const hasMore = sales.length > pageSize;
    const page = hasMore ? sales.slice(0, pageSize) : sales;
    const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

    const summary = page.reduce((acc, s) => {
      acc.totalRevenue += s.total_amount  || 0;
      acc.totalGST     += s.total_gst     || 0;
      acc.totalCOGS    += s.total_cost    || 0;
      acc.totalProfit  += s.gross_profit  || 0;
      return acc;
    }, { totalRevenue: 0, totalGST: 0, totalCOGS: 0, totalProfit: 0 });

    // Fetch return totals for the same period to compute net figures
    const returnFilter = { shop: shop._id, status: { $ne: 'cancelled' } };
    if (filter.createdAt) returnFilter.createdAt = filter.createdAt;
    const returnAgg = await SaleReturn.aggregate([
      { $match: returnFilter },
      { $group: {
        _id: null,
        totalReturnedAmount: { $sum: '$total_amount' },
        totalReturnedGST:    { $sum: '$total_gst'    },
      }},
    ]);
    const returnTotals = returnAgg[0] || { totalReturnedAmount: 0, totalReturnedGST: 0 };

    const netSummary = {
      totalRevenue: parseFloat((summary.totalRevenue - returnTotals.totalReturnedAmount).toFixed(2)),
      totalGST:     parseFloat((summary.totalGST     - returnTotals.totalReturnedGST   ).toFixed(2)),
      totalCOGS:    parseFloat(summary.totalCOGS.toFixed(2)),
      totalProfit:  parseFloat(summary.totalProfit.toFixed(2)),
      totalReturnedAmount: parseFloat(returnTotals.totalReturnedAmount.toFixed(2)),
      totalReturnedGST:    parseFloat(returnTotals.totalReturnedGST.toFixed(2)),
    };

    res.json({ sales: page, summary: netSummary, hasMore, nextCursor });
  } catch (err) {
    logger.error('[salesController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SALE
// ─────────────────────────────────────────────────────────────────────────────

const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let createdSaleId;
    let auditShopId = null;
    let createdShop = null;
    const offlineOperationId = normalizeOfflineOperationId(req.body?.offline_operation_id);

    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      createdShop = shop;
      auditShopId = shop._id;
      if (offlineOperationId) {
        const existingSale = await Sale.findOne({
          shop: shop._id,
          offline_operation_id: offlineOperationId,
        }).session(session);

        if (existingSale) {
          createdSaleId = existingSale._id;
          return;
        }
      }
      // Composition dealers must issue Bill of Supply, not Tax Invoice
      const requestBody = { ...req.body };
      if (shop.gst_type === 'composition' && requestBody.document_type === 'invoice') {
        requestBody.document_type = 'bill_of_supply';
      }

      const { data, itemNames } = await buildSaleRecordData({
        shop,
        payload: requestBody,
        session,
      });

      // Quotations skip stock deduction and use a separate number sequence
      const isQuotation = requestBody.document_type === 'quotation';
      if (isQuotation) {
        data.document_type   = 'quotation';
        data.invoice_number  = await generateQuotationNumber(shop._id, session, data.createdAt);
        data.taxable_amount  = data.total_amount;
        data.cgst_amount     = 0;
        data.sgst_amount     = 0;
        data.igst_amount     = 0;
        data.total_gst       = 0;
        data.payment_type    = 'credit';
        data.amount_paid     = 0;
        data.quotation_valid_till = req.body.quotation_valid_till
          ? new Date(req.body.quotation_valid_till)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // ── Contractor credit check (hardware only) ──────────────────
      let hardwareContractor = null;
      if (shop.businessType === 'hardware' && data.payment_type === 'credit') {
        const Contractor = require('../models/contractorModel');
        const efRaw = req.body.extra_fields || {};
        const contractorId = efRaw.contractor_id;
        if (contractorId) {
          hardwareContractor = await Contractor.findOne({ _id: contractorId, shop: shop._id }).session(session);
          if (hardwareContractor && hardwareContractor.credit_limit > 0) {
            const newOutstanding = hardwareContractor.current_outstanding + data.total_amount;
            if (newOutstanding > hardwareContractor.credit_limit) {
              throw Object.assign(new Error(
                `Credit limit exceeded. Limit: ₹${hardwareContractor.credit_limit}, ` +
                `Current outstanding: ₹${hardwareContractor.current_outstanding}, ` +
                `This bill: ₹${data.total_amount}. ` +
                `Over limit by ₹${round2(newOutstanding - hardwareContractor.credit_limit)}.`
              ), { statusCode: 400 });
            }
          }
        }
      }

      if (!isQuotation) {
        await syncSaleStock(null, data.items, data.invoice_number, session);
        await syncSubInventory([], data.items, data.invoice_number, session);
      }

      // Auto-flag EWB required when invoice value >= ₹50,000 and vehicle is present
      if (!isQuotation && data.total_amount >= 50000 && req.body.vehicle_number) {
        data.ewb_status = 'pending';
      }

      const createdSales = await Sale.create([{
        ...data,
        shop: shop._id,
        offline_operation_id: offlineOperationId,
      }], { session });

      const createdSale = createdSales[0];
      createdSaleId = createdSale._id;
      if (!isQuotation) {
        logStockMovements(shop._id, (data.items || []).map(item => ({
          product:        item.product,
          type:           'sale',
          quantityChange: -(Number(item.quantity) || 0),
          quantityAfter:  0,
          referenceId:    data.invoice_number,
          referenceType:  'sale',
          note:           `Sale to ${data.buyer_name || 'Walk-in'}`,
        })));
        await syncCustomerLedgerForSale(shop._id, createdSale, itemNames, session);

        // Update last_sale_date in product.metadata for slow-moving stock rule
        const soldProductIds = [...new Set((data.items || []).map((item) => String(item.product)))];
        if (soldProductIds.length > 0) {
          Product.updateMany(
            { _id: { $in: soldProductIds } },
            { $set: { 'metadata.last_sale_date': new Date() } }
          ).catch(() => {});
        }
      }

      // Update contractor outstanding after sale created
      if (hardwareContractor && data.payment_type === 'credit') {
        hardwareContractor.current_outstanding = round2(hardwareContractor.current_outstanding + data.total_amount);
        await hardwareContractor.save({ session });
      }
    });

    const hydratedSale = await Sale.findById(createdSaleId).populate('customer', 'name phone gstin');
    if (!hydratedSale) {
      logger.error('[createSale] hydratedSale is null after transaction, createdSaleId:', createdSaleId);
      return res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR' });
    }

    // Auto-generate IRN for B2B invoices when e-invoice is configured (fire-and-forget)
    if (
      hydratedSale.buyer_gstin &&
      hydratedSale.document_type === 'invoice' &&
      process.env.E_INVOICE_API_KEY
    ) {
      eInvoiceService.generateIRN(hydratedSale, createdShop)
        .then(({ irn, ack_no, ack_date, signed_qr_code }) =>
          Sale.findByIdAndUpdate(hydratedSale._id, {
            $set: { irn, ack_no, ack_date, signed_qr_code, einvoice_status: 'generated' },
          }).catch(() => {})
        )
        .catch(() =>
          Sale.findByIdAndUpdate(hydratedSale._id, { $set: { einvoice_status: 'pending' } }).catch(() => {})
        );
    }

    // Fire-and-forget — audit failure must never block the sale response
    logAuditEvent({
      shopId: auditShopId || hydratedSale.shop,
      userId: req.user.id,
      actionType: 'create',
      entity: 'sale',
      entityId: hydratedSale._id,
      referenceId: hydratedSale.invoice_number,
      afterValue: hydratedSale,
    }).catch((auditErr) => logger.error('[createSale] logAuditEvent failed:', auditErr.message));

    return res.status(201).json(hydratedSale);
  } catch (err) {
    logger.error('[createSale]', err.message || err, err.stack);
    if (err?.code === 11000 && req.body?.offline_operation_id) {
      const shop = await getShopOrFail(req.user.id);
      const existingSale = await Sale.findOne({
        shop: shop._id,
        offline_operation_id: normalizeOfflineOperationId(req.body.offline_operation_id),
      }).populate('customer', 'name phone gstin');
      if (existingSale) {
        return res.status(200).json(existingSale);
      }
    }
    const _sc = err.statusCode || err.status || 500;
    if (_sc < 500) return res.status(_sc).json({ message: err.message, code: 'BUSINESS_ERROR' });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const updateSale = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let saleId;
    let beforeValue = null;
    let auditShopId = null;

    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      auditShopId = shop._id;
      const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id }).session(session);
      if (!sale) throw new Error('Sale नहीं मिली');
      beforeValue = cloneForAudit(sale);

      const { data, itemNames } = await buildSaleRecordData({
        shop,
        payload: req.body,
        existingSale: sale,
        invoiceNumber: sale.invoice_number,
        session,
      });

      await reverseCustomerLedgerForSale(sale, session);
      await syncSaleStock(sale, data.items, sale.invoice_number, session);
      await syncSubInventory(sale.items || [], data.items, sale.invoice_number, session);

      Object.assign(sale, data, { customer: null });
      if (data.createdAt) {
        sale.createdAt = data.createdAt;
        sale.markModified('createdAt');
      }
      await sale.save({ session });
      if (data.createdAt) {
        await Sale.collection.updateOne(
          { _id: sale._id },
          { $set: { createdAt: data.createdAt } },
          { session }
        );
        sale.createdAt = data.createdAt;
      }
      await syncCustomerLedgerForSale(shop._id, sale, itemNames, session);
      saleId = sale._id;
    });

    const hydratedSale = await Sale.findById(saleId).populate('customer', 'name phone gstin');
    await logAuditEvent({
      shopId: auditShopId || hydratedSale?.shop,
      userId: req.user.id,
      actionType: 'update',
      entity: 'sale',
      entityId: hydratedSale._id,
      referenceId: hydratedSale.invoice_number,
      beforeValue,
      afterValue: hydratedSale,
    });
    res.json(hydratedSale);
  } catch (err) {
    if (err.message === 'Sale नहीं मिली') {
      return res.status(404).json({ message: err.message });
    }
    const isDev = process.env.NODE_ENV !== 'production'; res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// DELETE SALE
// ─────────────────────────────────────────────────────────────────────────────

const deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let deletedSale = null;
    let auditShopId = null;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      auditShopId = shop._id;
      const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id }).session(session);
      if (!sale) throw new Error('Sale नहीं मिली');
      deletedSale = cloneForAudit(sale);

      const itemsToReverse = sale.items && sale.items.length > 0
        ? sale.items
        : (sale.product ? [{ product: sale.product, quantity: sale.quantity, item_metadata: {} }] : []);

      for (const item of itemsToReverse) {
        let productQuery = Product.findById(item.product);
        if (session) productQuery = productQuery.session(session);
        const product = await productQuery;
        if (!product) continue;
        const quantityAfter = round2(product.quantity + Number(item.quantity || 0));
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: item.quantity },
        }, { session });
        await logStockMovements(sale.shop, [{
          product: product._id,
          type: 'sale_return',
          quantityChange: Number(item.quantity),
          quantityAfter,
          referenceId: sale.invoice_number,
          referenceType: 'sale_delete',
          note: `Sale deleted: ${sale.invoice_number}`,
          performedBy: req.user?.id,
        }], { session });
      }

      await reverseSubInventoryForSale(sale.items || [], session);
      await reverseCustomerLedgerForSale(sale, session);
      await Sale.findOneAndDelete({ _id: req.params.id, shop: shop._id }, { session });
    });

    if (deletedSale) {
      await logAuditEvent({
        shopId: auditShopId || deletedSale.shop,
        userId: req.user.id,
        actionType: 'delete',
        entity: 'sale',
        entityId: deletedSale._id,
        referenceId: deletedSale.invoice_number,
        beforeValue: deletedSale,
      });
    }

    res.json({ message: 'Sale deleted and stock reversed' });
  } catch (err) {
    if (err.message === 'Sale नहीं मिली') {
      return res.status(404).json({ message: err.message });
    }
    const isDev = process.env.NODE_ENV !== 'production'; res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFIT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const getProfitSummary = async (req, res) => {
  try {
    const shop         = await getShopOrFail(req.user.id);
    const { month, year, from, to } = req.query;
    const filter       = { shop: shop._id };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    } else if (month && year) {
      filter.createdAt = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const [salesAgg] = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id:                null,
          totalRevenue:       { $sum: '$total_amount'  },
          totalTaxable:       { $sum: '$taxable_amount' },
          totalGSTCollected:  { $sum: '$total_gst'     },
          totalCOGS:          { $sum: '$total_cost'    },
          totalGrossProfit:   { $sum: '$gross_profit'  },
          salesCount:         { $sum: 1                },
        },
      },
    ]);

    const [purchasesAgg] = await Purchase.aggregate([
      { $match: { shop: shop._id, ...(filter.createdAt ? { createdAt: filter.createdAt } : {}) } },
      {
        $group: {
          _id:             null,
          totalSpent:      { $sum: '$total_amount' },
          totalITC:        { $sum: '$total_gst'    },
          purchasesCount:  { $sum: 1               },
        },
      },
    ]);

    const s = salesAgg    || { totalRevenue: 0, totalTaxable: 0, totalGSTCollected: 0, totalCOGS: 0, totalGrossProfit: 0, salesCount: 0 };
    const p = purchasesAgg || { totalSpent: 0, totalITC: 0, purchasesCount: 0 };
    const [sales, purchases] = await Promise.all([
      Sale.find(filter).select('taxable_amount cgst_amount sgst_amount igst_amount'),
      Purchase.find({
        shop: shop._id,
        ...(filter.createdAt ? { createdAt: filter.createdAt } : {}),
      }).select('taxable_amount cgst_amount sgst_amount igst_amount'),
    ]);
    const gstr3b = calculateGSTR3BSummary(sales, purchases);

    res.json({
      totalRevenue:   parseFloat(s.totalRevenue.toFixed(2)),
      totalTaxable:   parseFloat(s.totalTaxable.toFixed(2)),
      salesCount:     s.salesCount,
      totalCOGS:      parseFloat(s.totalCOGS.toFixed(2)),
      grossProfit:    parseFloat(s.totalGrossProfit.toFixed(2)),
      netProfit:      parseFloat(s.totalGrossProfit.toFixed(2)),
      gstCollected:   parseFloat(s.totalGSTCollected.toFixed(2)),
      gstITC:         parseFloat(p.totalITC.toFixed(2)),
      netGSTPayable:  gstr3b.payable_total,
      payableByHead:  gstr3b.payable_by_head,
      excessCredit:   gstr3b.excess_credit,
      totalSpent:     parseFloat(p.totalSpent.toFixed(2)),
      purchasesCount: p.purchasesCount,
    });
  } catch (err) {
    logger.error('[salesController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GST SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const getGSTSummary = async (req, res) => {
  try {
    const shop           = await getShopOrFail(req.user.id);
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);

    const sales     = await Sale.find({ shop: shop._id, createdAt: { $gte: startDate, $lte: endDate } });
    const purchases = await Purchase.find({ shop: shop._id, createdAt: { $gte: startDate, $lte: endDate } });

    const b2b = sales.filter(s => s.invoice_type === 'B2B');
    const b2c = sales.filter(s => s.invoice_type === 'B2C');

    const salesTaxHeads = sumTaxHeads(sales);
    const purchaseTaxHeads = sumTaxHeads(purchases);
    const gstr3b = calculateGSTR3BSummary(sales, purchases);

    const summary = {
      month:     parseInt(month),
      year:      parseInt(year),
      sales: {
        total:          sales.length,
        taxable_amount: parseFloat(sales.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        total_gst:      parseFloat(sales.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
        cgst:           salesTaxHeads.cgst,
        sgst:           salesTaxHeads.sgst,
        igst:           salesTaxHeads.igst,
        total_amount:   parseFloat(sales.reduce((s, x) => s + (x.total_amount   || 0), 0).toFixed(2)),
        b2b_count:      b2b.length,
        b2c_count:      b2c.length,
        b2b_taxable:    parseFloat(b2b.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        b2c_taxable:    parseFloat(b2c.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
      },
      purchases: {
        total:          purchases.length,
        taxable_amount: parseFloat(purchases.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        total_gst:      parseFloat(purchases.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
        cgst:           purchaseTaxHeads.cgst,
        sgst:           purchaseTaxHeads.sgst,
        igst:           purchaseTaxHeads.igst,
      },
      gstr1: {
        b2b_invoices: b2b.map(s => ({
          invoice_number: s.invoice_number,
          date:           s.createdAt,
          buyer_name:     s.buyer_name,
          buyer_gstin:    s.buyer_gstin,
          taxable_amount: s.taxable_amount,
          gst_rate:       s.items?.length
            ? [...new Set(s.items.map((item) => item.gst_rate))].join('/')
            : s.gst_rate,
          cgst:           s.cgst_amount,
          sgst:           s.sgst_amount,
          igst:           s.igst_amount,
          total:          s.total_amount,
          gst_type:       s.gst_type,
        })),
        b2c_summary: {
          count:          b2c.length,
          taxable_amount: parseFloat(b2c.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
          total_gst:      parseFloat(b2c.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
          total_amount:   parseFloat(b2c.reduce((s, x) => s + (x.total_amount   || 0), 0).toFixed(2)),
        },
      },
      gstr3b,
    };

    res.json(summary);
  } catch (err) {
    logger.error('[salesController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getGSTComplianceReport = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { month, year, from, to } = req.query;
    const filter = { shop: shop._id };

    if (from || to) {
      if (!from || !to) {
        return res.status(400).json({ message: 'Both from and to dates are required' });
      }

      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date range' });
      }

      filter.createdAt = {
        $gte: fromDate,
        $lte: toDate,
      };
    } else {
      const monthNumber = Number(month);
      const yearNumber = Number(year);
      if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber) || yearNumber < 2000) {
        return res.status(400).json({ message: 'Valid month and year are required' });
      }

      filter.createdAt = {
        $gte: new Date(yearNumber, monthNumber - 1, 1),
        $lte: new Date(yearNumber, monthNumber, 0, 23, 59, 59, 999),
      };
    }

    const [sales, purchases] = await Promise.all([
      Sale.find(filter).sort({ createdAt: 1 }).lean(),
      Purchase.find({ shop: shop._id, createdAt: filter.createdAt }).sort({ createdAt: 1 }).lean(),
    ]);

    const report = generateGSTComplianceReport({
      title: 'GST Report',
      sales,
      purchases,
    });

    res.json(report);
  } catch (err) {
    logger.error('[salesController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW STATUS UPDATE (lightweight — only writes extra_fields.workflow_status)
// ─────────────────────────────────────────────────────────────────────────────

const updateSaleWorkflow = async (req, res) => {
  try {
    const { workflow_status } = req.body;
    if (!workflow_status || typeof workflow_status !== 'string') {
      return res.status(400).json({ message: 'workflow_status is required' });
    }
    const shop = await getShopOrFail(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id });
    if (!sale) return res.status(404).json({ message: 'Sale नहीं मिली' });

    // extra_fields is a Mongoose Map — use .set()
    if (!sale.extra_fields) sale.extra_fields = new Map();
    sale.extra_fields.set('workflow_status', workflow_status);
    sale.markModified('extra_fields');
    await sale.save({ validateBeforeSave: false });

    res.json(sale);

    // Fire-and-forget: auto-resolve workflow delay notifications when stage advances
    ruleEngine.handleEvent('WORKFLOW_ADVANCED', {
      shopId:   shop._id,
      saleId:   sale._id,
      newStage: workflow_status,
    }).catch(() => {});

    // Audit log
    ruleEngine.createAuditLog({
      shopId:     shop._id,
      userId:     req.user.subUserId || req.user.id,
      username:   req.user.username,
      action:     'WORKFLOW_ADVANCED',
      entity:     'sale',
      entityId:   String(sale._id),
      entityName: sale.invoice_number,
      details:    { newStage: workflow_status },
    }).catch(() => {});
  } catch (err) {
    logger.error('[salesController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── Delivery Challan (hardware) ────────────────────────────────────────────

const createChallan = async (req, res) => {
  // Delivery Challan — no stock deduction, no payment, DC-YYYY-NNNN number
  const session = await mongoose.startSession();
  try {
    let createdChallanId;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);

      // Build item data — no stock check (goods still with supplier)
      const { data } = await buildSaleRecordData({
        shop,
        payload: req.body,
        session,
        skipStockCheck: true,
      });

      // Use a placeholder invoice_number; challan_number generated by pre-save hook
      const tempNumber = `CHALLAN-TEMP-${Date.now()}`;

      const {
        challan_type, challan_date,
        vehicle_number, transport_name, lr_number, eway_bill_number,
        dispatch_from, deliver_to,
        po_number, po_date, indent_number,
        consignee_name, consignee_address, consignee_gstin,
        consignee_contact, consignee_phone,
        special_instructions, challan_terms,
        // Per-item UOM/remarks come through data.items via item_metadata
      } = req.body;

      // Merge per-item UOM and remarks from request body items array
      const bodyItems = Array.isArray(req.body.items) ? req.body.items : [];
      const enrichedItems = data.items.map((item, idx) => ({
        ...item,
        unit_of_measurement: bodyItems[idx]?.unit_of_measurement || 'NOS',
        remarks: bodyItems[idx]?.remarks || '',
      }));

      const created = await Sale.create([{
        ...data,
        items: enrichedItems,
        shop: shop._id,
        document_type: 'challan',
        invoice_number: tempNumber,
        challan_date: challan_date ? new Date(challan_date) : new Date(),
        challan_type: challan_type || 'supply_of_goods',
        challan_status: 'draft',
        payment_status: 'not_applicable',
        payment_type: 'cash',
        amount_paid: 0,
        balance_due: 0,
        vehicle_number: vehicle_number || '',
        transport_name: transport_name || '',
        lr_number: lr_number || '',
        eway_bill_number: eway_bill_number || '',
        dispatch_from: dispatch_from || shop.address || '',
        deliver_to: deliver_to || consignee_address || '',
        po_number: po_number || '',
        po_date: po_date ? new Date(po_date) : null,
        indent_number: indent_number || '',
        consignee_name: consignee_name || data.buyer_name || '',
        consignee_address: consignee_address || data.buyer_address || '',
        consignee_gstin: consignee_gstin || data.buyer_gstin || '',
        consignee_contact: consignee_contact || '',
        consignee_phone: consignee_phone || data.buyer_phone || '',
        special_instructions: special_instructions || '',
        challan_terms: challan_terms || '',
      }], { session });

      // Now update invoice_number with the auto-generated challan_number
      const challanDoc = created[0];
      await Sale.collection.updateOne(
        { _id: challanDoc._id },
        { $set: { invoice_number: challanDoc.challan_number } },
        { session }
      );
      createdChallanId = challanDoc._id;
    });

    const challan = await Sale.findById(createdChallanId);
    res.status(201).json(challan);
  } catch (err) {
    const _sc = err.statusCode || 500;
    if (_sc < 500) return res.status(_sc).json({ message: err.message, code: 'BUSINESS_ERROR' });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

const markChallanDispatched = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const challan = await Sale.findOne({ _id: req.params.id, shop: shop._id, document_type: 'challan' });
    if (!challan) return res.status(404).json({ message: 'Challan not found' });
    if (challan.challan_status === 'converted') {
      return res.status(400).json({ message: 'Challan has already been converted to invoice' });
    }
    challan.challan_status = 'dispatched';
    await challan.save();
    res.json({ challan, message: 'Marked as dispatched' });
  } catch (err) {
    const isDev = process.env.NODE_ENV !== 'production'; res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

const markChallanDelivered = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { received_by, received_at, notes } = req.body;
    if (!received_by) return res.status(400).json({ message: 'received_by is required' });

    const challan = await Sale.findOne({
      _id: req.params.id,
      shop: shop._id,
      document_type: 'challan',
    });
    if (!challan) return res.status(404).json({ message: 'Challan not found' });
    if (challan.challan_status === 'converted') {
      return res.status(400).json({ message: 'Challan has already been converted to invoice' });
    }

    challan.challan_status = 'delivered';
    challan.received_by = received_by;
    challan.received_at = received_at ? new Date(received_at) : new Date();
    if (notes) challan.extra_fields.set('delivery_notes', notes);
    await challan.save();

    res.json({ challan, message: 'Marked as delivered' });
  } catch (err) {
    const isDev = process.env.NODE_ENV !== 'production'; res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

const convertToInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let invoiceId;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      const challan = await Sale.findOne({ _id: req.params.id, shop: shop._id, document_type: 'challan' }).session(session);
      if (!challan) throw Object.assign(new Error('Challan not found'), { statusCode: 404 });
      if (challan.converted_to_invoice) throw Object.assign(new Error('Already converted to invoice'), { statusCode: 400 });

      const invoiceNumber = await generateInvoiceNumber(shop, session);
      const challanObj = challan.toObject();
      delete challanObj._id;
      delete challanObj.createdAt;
      delete challanObj.updatedAt;
      delete challanObj.__v;

      const [invoice] = await Sale.create([{
        ...challanObj,
        document_type: 'invoice',
        invoice_number: invoiceNumber,
        converted_from_challan: challan._id,
        challan_status: undefined,
        payment_status: 'unpaid',
        payment_type: 'cash',
        amount_paid: 0,
      }], { session });

      challan.converted_to_invoice = invoice._id;
      challan.challan_status = 'converted';
      await challan.save({ session });

      // Deduct stock now that invoice is confirmed
      await syncSaleStock(null, invoice.items || [], invoiceNumber, session);
      await syncSubInventory([], invoice.items || [], invoiceNumber, session);

      invoiceId = invoice._id;
    });
    const invoice = await Sale.findById(invoiceId);
    res.json({ invoice, message: 'Challan converted to invoice' });
  } catch (err) {
    const _sc = err.statusCode || 500;
    if (_sc < 500) return res.status(_sc).json({ message: err.message, code: 'BUSINESS_ERROR' });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERT QUOTATION → INVOICE
// POST /api/sales/:id/convert-quotation
// ─────────────────────────────────────────────────────────────────────────────

const convertQuotation = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let invoiceId;
    await session.withTransaction(async () => {
      const shop      = await getShopOrFail(req.user.id);
      const quotation = await Sale.findOne({
        _id: req.params.id, shop: shop._id, document_type: 'quotation',
      }).session(session);
      if (!quotation) throw Object.assign(new Error('Quotation not found'), { statusCode: 404 });
      if (quotation.converted_to_invoice) {
        throw Object.assign(new Error('Quotation already converted to invoice'), { statusCode: 400 });
      }

      const payload = {
        items: req.body.items || quotation.items.map(i => ({
          product_id:     String(i.product),
          product_name:   i.product_name,
          quantity:       i.quantity,
          price_per_unit: i.price_per_unit,
          gst_rate:       i.gst_rate,
          item_metadata:  i.item_metadata instanceof Map ? Object.fromEntries(i.item_metadata) : (i.item_metadata || {}),
        })),
        buyer_name:   req.body.buyer_name   || quotation.buyer_name,
        buyer_phone:  req.body.buyer_phone  || quotation.buyer_phone,
        buyer_gstin:  req.body.buyer_gstin  || quotation.buyer_gstin,
        buyer_state:  req.body.buyer_state  || quotation.buyer_state,
        payment_type: req.body.payment_type || 'cash',
        amount_paid:  req.body.amount_paid  || 0,
        notes:        req.body.notes        || quotation.notes,
        extra_fields: {
          ...(quotation.extra_fields instanceof Map ? Object.fromEntries(quotation.extra_fields) : quotation.extra_fields),
          converted_from_quotation: quotation.invoice_number,
        },
      };

      const { data, itemNames } = await buildSaleRecordData({ shop, payload, session });

      await syncSaleStock(null, data.items, data.invoice_number, session);
      await syncSubInventory([], data.items, data.invoice_number, session);

      const [invoice] = await Sale.create([{ ...data, shop: shop._id }], { session });
      invoiceId = invoice._id;

      await Sale.findByIdAndUpdate(quotation._id, {
        $set: { converted_to_invoice: invoice.invoice_number, quotation_status: 'converted' },
      }, { session });

      await syncCustomerLedgerForSale(shop._id, invoice, itemNames, session);
    });

    const invoice = await Sale.findById(invoiceId).populate('customer', 'name phone gstin');
    res.status(201).json({ invoice, message: 'Quotation converted to invoice' });
  } catch (err) {
    const sc = err.statusCode || 500;
    if (sc < 500) return res.status(sc).json({ message: err.message, code: 'BUSINESS_ERROR' });
    res.status(500).json({ message: 'कुछ गलत हुआ' });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT NOTE
// POST /api/sales/credit-note
// Issues a GST credit note against an existing invoice.
// ─────────────────────────────────────────────────────────────────────────────

const { validateGSTIN: _validateGSTIN, getSupplyType, calculateItemGST } = require('../lib/gstUtils');
const { generateGSTComplianceReport: _gstReport } = require('../utils/gstReportGenerator');

const generateNoteNumber = async (shopId, docType, session = null) => {
  const prefix = docType === 'credit_note' ? 'CN' : 'DN';
  const financialYear = getFinancialYear();
  let query = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: docType, financial_year: financialYear },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) query = query.session(session);
  const seq = await query;
  return `${prefix}/${financialYear}/${String(seq.last_number).padStart(4, '0')}`;
};

const createCreditNote = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let noteId;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      const {
        original_invoice_no, original_invoice_date,
        buyer_name, buyer_gstin, buyer_state_code,
        reason = 'return_of_goods',
        items: rawItems = [],
        note_date,
      } = req.body;

      if (!original_invoice_no) throw new Error('original_invoice_no is required');
      if (!rawItems.length)     throw new Error('At least one item is required');

      const originalSale = await Sale.findOne({ shop: shop._id, invoice_number: original_invoice_no }).session(session);
      if (!originalSale) throw new Error(`Original invoice ${original_invoice_no} not found in this shop`);

      const normalizedBuyerGstin = buyer_gstin ? normalizeGstin(buyer_gstin) : '';
      if (normalizedBuyerGstin && !GSTIN_REGEX.test(normalizedBuyerGstin)) {
        throw new Error('Invalid buyer GSTIN format');
      }

      const shopStateCode   = shop.gst_state_code || (shop.gstin ? shop.gstin.substring(0, 2) : '');
      const buyerStateCode  = normalizedBuyerGstin ? normalizedBuyerGstin.substring(0, 2) : (buyer_state_code || shopStateCode);
      const supplyType      = getSupplyType(shopStateCode, buyerStateCode);

      const resolvedItems = [];
      let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

      for (const item of rawItems) {
        const gstCalc = calculateItemGST(
          Number(item.price_per_unit || 0),
          Number(item.quantity || 0),
          Number(item.gst_rate || 0),
          supplyType
        );
        resolvedItems.push({
          product:      item.product_id,
          product_name: item.product_name || '',
          hsn_code:     item.hsn_code     || '',
          quantity:     Number(item.quantity),
          price_per_unit: Number(item.price_per_unit),
          gst_rate:     Number(item.gst_rate || 0),
          taxable_amount: gstCalc.taxableAmount,
          cgst_rate:    gstCalc.cgstRate,
          sgst_rate:    gstCalc.sgstRate,
          igst_rate:    gstCalc.igstRate,
          cgst_amount:  gstCalc.cgstAmount,
          sgst_amount:  gstCalc.sgstAmount,
          igst_amount:  gstCalc.igstAmount,
          total_gst:    gstCalc.totalGst,
          gst_type:     gstCalc.gst_type,
          total_amount: round2(gstCalc.taxableAmount + gstCalc.totalGst),
        });
        totalTaxable += gstCalc.taxableAmount;
        totalCGST    += gstCalc.cgstAmount;
        totalSGST    += gstCalc.sgstAmount;
        totalIGST    += gstCalc.igstAmount;
      }

      const noteNumber = await generateNoteNumber(shop._id, 'credit_note', session);
      const noteDate   = note_date ? new Date(note_date) : new Date();

      const [creditNote] = await Sale.create([{
        shop:                  shop._id,
        document_type:         'credit_note',
        invoice_number:        noteNumber,
        original_invoice_no,
        original_invoice_date: original_invoice_date ? new Date(original_invoice_date) : originalSale.createdAt,
        credit_debit_reason:   reason,
        buyer_name:            buyer_name || originalSale.buyer_name,
        buyer_gstin:           normalizedBuyerGstin || originalSale.buyer_gstin,
        buyer_state_code:      buyerStateCode,
        is_b2b:                !!normalizedBuyerGstin || !!originalSale.buyer_gstin,
        supply_type:           supplyType,
        place_of_supply:       buyerStateCode,
        items:                 resolvedItems,
        taxable_amount:        round2(totalTaxable),
        cgst_amount:           round2(totalCGST),
        sgst_amount:           round2(totalSGST),
        igst_amount:           round2(totalIGST),
        total_gst:             round2(totalCGST + totalSGST + totalIGST),
        total_amount:          round2(totalTaxable + totalCGST + totalSGST + totalIGST),
        payment_type:          'cash',
        amount_paid:           round2(totalTaxable + totalCGST + totalSGST + totalIGST),
        createdAt:             noteDate,
        invoice_type:          (normalizedBuyerGstin || originalSale.buyer_gstin) ? 'B2B' : 'B2C',
      }], { session });

      // Restore stock if return_of_goods
      if (reason === 'return_of_goods') {
        for (const item of rawItems) {
          if (item.product_id) {
            await Product.findByIdAndUpdate(
              item.product_id,
              { $inc: { quantity: Number(item.quantity || 0) } },
              { session }
            );
          }
        }
      }

      noteId = creditNote._id;
    });

    const hydratedNote = await Sale.findById(noteId);
    res.status(201).json(hydratedNote);
  } catch (err) {
    const _sc = err.statusCode || 400;
    if (_sc < 500) return res.status(_sc).json({ message: err.message, code: 'BUSINESS_ERROR' });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBIT NOTE
// POST /api/sales/debit-note
// ─────────────────────────────────────────────────────────────────────────────

const createDebitNote = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let noteId;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      const {
        original_invoice_no, original_invoice_date,
        buyer_name, buyer_gstin, buyer_state_code,
        reason = 'additional_charges',
        items: rawItems = [],
        note_date,
      } = req.body;

      if (!original_invoice_no) throw new Error('original_invoice_no is required');
      if (!rawItems.length)     throw new Error('At least one item is required');

      const originalSale = await Sale.findOne({ shop: shop._id, invoice_number: original_invoice_no }).session(session);
      if (!originalSale) throw new Error(`Original invoice ${original_invoice_no} not found in this shop`);

      const normalizedBuyerGstin = buyer_gstin ? normalizeGstin(buyer_gstin) : '';
      if (normalizedBuyerGstin && !GSTIN_REGEX.test(normalizedBuyerGstin)) {
        throw new Error('Invalid buyer GSTIN format');
      }

      const shopStateCode  = shop.gst_state_code || (shop.gstin ? shop.gstin.substring(0, 2) : '');
      const buyerStateCode = normalizedBuyerGstin ? normalizedBuyerGstin.substring(0, 2) : (buyer_state_code || shopStateCode);
      const supplyType     = getSupplyType(shopStateCode, buyerStateCode);

      const resolvedItems = [];
      let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;

      for (const item of rawItems) {
        const gstCalc = calculateItemGST(
          Number(item.price_per_unit || 0),
          Number(item.quantity || 0),
          Number(item.gst_rate || 0),
          supplyType
        );
        resolvedItems.push({
          product:        item.product_id,
          product_name:   item.product_name || '',
          hsn_code:       item.hsn_code     || '',
          quantity:       Number(item.quantity),
          price_per_unit: Number(item.price_per_unit),
          gst_rate:       Number(item.gst_rate || 0),
          taxable_amount: gstCalc.taxableAmount,
          cgst_rate:      gstCalc.cgstRate,
          sgst_rate:      gstCalc.sgstRate,
          igst_rate:      gstCalc.igstRate,
          cgst_amount:    gstCalc.cgstAmount,
          sgst_amount:    gstCalc.sgstAmount,
          igst_amount:    gstCalc.igstAmount,
          total_gst:      gstCalc.totalGst,
          gst_type:       gstCalc.gst_type,
          total_amount:   round2(gstCalc.taxableAmount + gstCalc.totalGst),
        });
        totalTaxable += gstCalc.taxableAmount;
        totalCGST    += gstCalc.cgstAmount;
        totalSGST    += gstCalc.sgstAmount;
        totalIGST    += gstCalc.igstAmount;
      }

      const noteNumber = await generateNoteNumber(shop._id, 'debit_note', session);
      const noteDate   = note_date ? new Date(note_date) : new Date();

      const [debitNote] = await Sale.create([{
        shop:                  shop._id,
        document_type:         'debit_note',
        invoice_number:        noteNumber,
        original_invoice_no,
        original_invoice_date: original_invoice_date ? new Date(original_invoice_date) : originalSale.createdAt,
        credit_debit_reason:   reason,
        buyer_name:            buyer_name || originalSale.buyer_name,
        buyer_gstin:           normalizedBuyerGstin || originalSale.buyer_gstin,
        buyer_state_code:      buyerStateCode,
        is_b2b:                !!normalizedBuyerGstin || !!originalSale.buyer_gstin,
        supply_type:           supplyType,
        place_of_supply:       buyerStateCode,
        items:                 resolvedItems,
        taxable_amount:        round2(totalTaxable),
        cgst_amount:           round2(totalCGST),
        sgst_amount:           round2(totalSGST),
        igst_amount:           round2(totalIGST),
        total_gst:             round2(totalCGST + totalSGST + totalIGST),
        total_amount:          round2(totalTaxable + totalCGST + totalSGST + totalIGST),
        payment_type:          'cash',
        amount_paid:           round2(totalTaxable + totalCGST + totalSGST + totalIGST),
        createdAt:             noteDate,
        invoice_type:          (normalizedBuyerGstin || originalSale.buyer_gstin) ? 'B2B' : 'B2C',
      }], { session });

      noteId = debitNote._id;
    });

    const hydratedNote = await Sale.findById(noteId);
    res.status(201).json(hydratedNote);
  } catch (err) {
    const _sc = err.statusCode || 400;
    if (_sc < 500) return res.status(_sc).json({ message: err.message, code: 'BUSINESS_ERROR' });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ── E-INVOICE (IRN) ───────────────────────────────────────────────────────────

const eInvoiceService = require('../services/eInvoiceService');

const generateIRN = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    if (sale.einvoice_status === 'generated') return res.status(400).json({ message: 'IRN already generated', irn: sale.irn });
    if (!sale.buyer_gstin) return res.status(400).json({ message: 'IRN is only applicable for B2B invoices with a buyer GSTIN' });

    const { irn, ack_no, ack_date, signed_qr_code } = await eInvoiceService.generateIRN(sale, shop);
    sale.irn             = irn;
    sale.ack_no          = ack_no;
    sale.ack_date        = ack_date;
    sale.signed_qr_code  = signed_qr_code;
    sale.einvoice_status = 'generated';
    await sale.save();

    return res.json({ irn, ack_no, ack_date, signed_qr_code, einvoice_status: 'generated' });
  } catch (err) {
    logger.error('[salesController:generateIRN]', err.message || err);
    return res.status(500).json({ message: err.message || 'IRN generation failed' });
  }
};

const cancelIRN = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    if (sale.einvoice_status !== 'generated') return res.status(400).json({ message: 'No active IRN to cancel' });

    const { reason = '4', remarks = '' } = req.body;
    await eInvoiceService.cancelIRN(sale.irn, reason, remarks);
    sale.einvoice_status = 'cancelled';
    await sale.save();

    return res.json({ message: 'IRN cancelled', einvoice_status: 'cancelled' });
  } catch (err) {
    logger.error('[salesController:cancelIRN]', err.message || err);
    return res.status(500).json({ message: err.message || 'IRN cancellation failed' });
  }
};

// ── E-WAY BILL ────────────────────────────────────────────────────────────────

const ewayBillService = require('../services/ewayBillService');

const generateEwayBill = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    if (sale.ewb_status === 'generated') return res.status(400).json({ message: 'E-Way Bill already generated', ewb_number: sale.ewb_number });
    if (sale.ewb_status === 'cancelled') return res.status(400).json({ message: 'Cannot generate EWB for a cancelled bill' });

    const { ewb_number, ewb_valid_until } = await ewayBillService.generateEWB(sale, shop);

    sale.ewb_number       = ewb_number;
    sale.ewb_generated_at = new Date();
    sale.ewb_valid_until  = ewb_valid_until;
    sale.ewb_status       = 'generated';
    if (!sale.eway_bill_number) sale.eway_bill_number = ewb_number;
    await sale.save();

    return res.json({ ewb_number, ewb_valid_until, ewb_status: 'generated' });
  } catch (err) {
    logger.error('[salesController:generateEwayBill]', err.message || err);
    return res.status(500).json({ message: err.message || 'E-Way Bill generation failed' });
  }
};

const cancelEwayBill = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    if (sale.ewb_status !== 'generated') return res.status(400).json({ message: 'No active E-Way Bill to cancel' });

    const { reason = 'Others', remarks = '' } = req.body;
    await ewayBillService.cancelEWB(sale.ewb_number, reason, remarks);

    sale.ewb_status       = 'cancelled';
    sale.ewb_cancel_reason = reason;
    await sale.save();

    return res.json({ message: 'E-Way Bill cancelled', ewb_status: 'cancelled' });
  } catch (err) {
    logger.error('[salesController:cancelEwayBill]', err.message || err);
    return res.status(500).json({ message: err.message || 'E-Way Bill cancellation failed' });
  }
};

module.exports = {
  getSaleById,
  getSales,
  createSale,
  updateSale,
  deleteSale,
  updateSaleWorkflow,
  getGSTSummary,
  getGSTComplianceReport,
  getProfitSummary,
  calculateGSTR3BSummary,
  createChallan,
  markChallanDispatched,
  markChallanDelivered,
  convertToInvoice,
  convertQuotation,
  createCreditNote,
  createDebitNote,
  generateEwayBill,
  cancelEwayBill,
  generateIRN,
  cancelIRN,
};
