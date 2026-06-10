const mongoose = require('mongoose');
const PurchaseReturn = require('../models/purchaseReturnModel');
const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const DocumentSequence = require('../models/documentSequenceModel');
const ProductBatch = require('../models/productBatchModel');
const ProductVariant = require('../models/productVariantModel');
const SerialInventory = require('../models/serialInventoryModel');
const { logAuditEvent } = require('../utils/auditTrail');
const { getShopOrFail } = require('../utils/shopGuard');
const { logStockMovements } = require('../utils/stockMovementLogger');

const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

const generateCreditNoteNumber = async (shopId, session = null) => {
  const financialYear = getFinancialYear();
  let query = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'purchase_return', financial_year: financialYear },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) query = query.session(session);
  const sequence = await query;
  return `CN/${financialYear}/${String(sequence.last_number).padStart(4, '0')}`;
};

// ── GET ALL RETURNS ────────────────────────────────────────────────────────────
const getPurchaseReturns = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { from, to, supplierId, limit: limitParam, cursor } = req.query;

    const filter = { shop: shop._id };
    if (supplierId) filter.supplier = supplierId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 100, 500);
    const returns = await PurchaseReturn.find(filter)
      .populate('supplier', 'name phone')
      .populate('original_purchase', 'invoice_number total_amount')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1);

    const hasMore = returns.length > pageSize;
    const page = hasMore ? returns.slice(0, pageSize) : returns;
    res.json({ returns: page, hasMore, nextCursor: hasMore ? String(page[page.length - 1]._id) : null });
  } catch (err) {
    if (err.code === 'SHOP_NOT_CONFIGURED') return res.status(400).json({ code: err.code, message: err.message });
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CREATE RETURN ──────────────────────────────────────────────────────────────
const createPurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let returnId;
    let auditShopId;

    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      auditShopId = shop._id;

      const { purchase_id, items, refund_mode = 'adjust', reason, notes } = req.body;

      if (!purchase_id || !Array.isArray(items) || items.length === 0) {
        throw new Error('purchase_id and at least one item are required');
      }

      const originalPurchase = await Purchase.findOne({ _id: purchase_id, shop: shop._id }).session(session);
      if (!originalPurchase) throw new Error('Original purchase not found');

      // Build quantity map from original purchase
      const allItems = originalPurchase.items?.length > 0
        ? originalPurchase.items
        : (originalPurchase.product
          ? [{ product: originalPurchase.product, quantity: originalPurchase.quantity, price_per_unit: originalPurchase.price_per_unit, gst_rate: originalPurchase.gst_rate, gst_type: originalPurchase.gst_type || 'CGST_SGST', cgst_amount: originalPurchase.cgst_amount, sgst_amount: originalPurchase.sgst_amount, igst_amount: originalPurchase.igst_amount, total_gst: originalPurchase.total_gst, taxable_amount: originalPurchase.taxable_amount, total_amount: originalPurchase.total_amount, item_metadata: {} }]
          : []);

      const originalQtyMap = new Map();
      for (const item of allItems) {
        const pid = String(item.product);
        originalQtyMap.set(pid, (originalQtyMap.get(pid) || 0) + Number(item.quantity || 0));
      }

      // Check how much has already been returned
      const existingReturns = await PurchaseReturn.find({
        shop: shop._id, original_purchase: purchase_id, status: { $ne: 'cancelled' },
      }).session(session);
      const alreadyReturnedMap = new Map();
      for (const ret of existingReturns) {
        for (const item of ret.items) {
          const pid = String(item.product);
          alreadyReturnedMap.set(pid, (alreadyReturnedMap.get(pid) || 0) + Number(item.quantity || 0));
        }
      }

      let totalTaxable = 0, totalGST = 0, grandTotal = 0;
      let totalCGST = 0, totalSGST = 0, totalIGST = 0;
      const resolvedItems = [];

      for (const item of items) {
        const productId = item.product_id || item.product;
        const product = await Product.findById(productId).session(session);
        if (!product) throw new Error(`Product not found: ${productId}`);

        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);

        const originalQty = originalQtyMap.get(String(product._id)) || 0;
        const alreadyReturned = alreadyReturnedMap.get(String(product._id)) || 0;
        const maxReturnable = originalQty - alreadyReturned;
        if (qty > maxReturnable) {
          throw new Error(`${product.name}: can only return ${maxReturnable} (${alreadyReturned} already returned of ${originalQty})`);
        }

        const originalItem = allItems.find(i => String(i.product) === String(product._id)) || {};
        const ppu = Number(item.price_per_unit || originalItem.price_per_unit || product.cost_price || 0);
        const gst_rate = Number(item.gst_rate ?? originalItem.gst_rate ?? product.gst_rate ?? 0);
        const taxable = round2(qty * ppu);
        const gst = round2((taxable * gst_rate) / 100);
        const gst_type = originalItem.gst_type || 'CGST_SGST';
        const cgst_amount = gst_type === 'IGST' ? 0 : round2(gst / 2);
        const sgst_amount = gst_type === 'IGST' ? 0 : round2(gst - cgst_amount);
        const igst_amount = gst_type === 'IGST' ? gst : 0;
        const lineTotal = round2(taxable + gst);

        totalTaxable += taxable;
        totalCGST += cgst_amount;
        totalSGST += sgst_amount;
        totalIGST += igst_amount;
        totalGST += gst;
        grandTotal += lineTotal;

        // Restore stock with history
        const currentProduct = await Product.findById(product._id).session(session);
        const quantityAfter = round2((currentProduct?.quantity || 0) + qty);
        await Product.findByIdAndUpdate(product._id, {
          $inc: { quantity: qty },
        }, { session });
        await logStockMovements(shop._id, [{
          product: product._id,
          type: 'purchase_return',
          quantityChange: qty,
          quantityAfter,
          referenceId: originalPurchase.invoice_number,
          referenceType: 'purchase_return',
          note: '',
          performedBy: req.user?.id,
        }], { session });

        // Restore sub-inventory
        const meta = item.item_metadata || originalItem.item_metadata || {};
        const metaObj = meta instanceof Map ? Object.fromEntries(meta) : meta;
        const opts = { session };

        if (metaObj.batch_id) {
          await ProductBatch.findByIdAndUpdate(metaObj.batch_id, { $inc: { quantity: qty }, $set: { is_depleted: false } }, opts);
        }
        if (metaObj.variant_id) {
          await ProductVariant.findByIdAndUpdate(metaObj.variant_id, { $inc: { quantity: qty } }, opts);
        }
        if (Array.isArray(metaObj.serial_ids) && metaObj.serial_ids.length > 0) {
          await SerialInventory.updateMany(
            { _id: { $in: metaObj.serial_ids } },
            { $set: { status: 'in_stock' }, $unset: { purchase_invoice: '' } },
            opts
          );
        }

        resolvedItems.push({
          product: product._id,
          product_name: product.name,
          quantity: qty,
          price_per_unit: ppu,
          gst_rate,
          taxable_amount: taxable,
          cgst_amount,
          sgst_amount,
          igst_amount,
          total_gst: gst,
          gst_type,
          total_amount: lineTotal,
          item_metadata: metaObj,
        });
      }

      const creditNoteNumber = await generateCreditNoteNumber(shop._id, session);
      const refundAmount = round2(grandTotal);

      const [purchaseReturn] = await PurchaseReturn.create([{
        shop: shop._id,
        original_purchase: originalPurchase._id,
        original_invoice_number: originalPurchase.invoice_number,
        credit_note_number: creditNoteNumber,
        items: resolvedItems,
        taxable_amount: round2(totalTaxable),
        cgst_amount: round2(totalCGST),
        sgst_amount: round2(totalSGST),
        igst_amount: round2(totalIGST),
        total_gst: round2(totalGST),
        total_amount: round2(grandTotal),
        refund_mode,
        refund_amount: refundAmount,
        supplier: originalPurchase.supplier || null,
        supplier_name: originalPurchase.supplier_name || '',
        reason: reason || '',
        notes: notes || '',
        return_date: new Date(),
      }], { session });

      returnId = purchaseReturn._id;

      // Update supplier udhaar if original was a credit purchase
      if (originalPurchase.payment_type === 'credit' && originalPurchase.supplier) {
        const supplier = await Supplier.findById(originalPurchase.supplier).session(session);
        if (supplier) {
          supplier.totalPurchased = Math.max(0, round2((supplier.totalPurchased || 0) - refundAmount));
          supplier.totalUdhaar = Math.max(0, round2(supplier.totalPurchased - (supplier.totalPaid || 0)));
          await supplier.save({ session });

          await SupplierUdhaar.create([{
            shop: shop._id,
            supplier: originalPurchase.supplier,
            type: 'credit',
            amount: refundAmount,
            running_balance: supplier.totalUdhaar,
            payment_mode: refund_mode === 'adjust' ? 'adjust' : refund_mode,
            note: `Purchase Return ${creditNoteNumber} - ${resolvedItems.map(i => i.product_name).join(', ')}`,
            date: new Date(),
            reference_id: creditNoteNumber,
            reference_type: 'purchase_return',
          }], { session });
        }
      }
    });

    const hydrated = await PurchaseReturn.findById(returnId)
      .populate('supplier', 'name phone')
      .populate('original_purchase', 'invoice_number total_amount');

    await logAuditEvent({
      shopId: hydrated.shop,
      userId: req.user.id,
      actionType: 'create', entity: 'purchase_return',
      entityId: hydrated._id,
      referenceId: hydrated.credit_note_number,
      afterValue: hydrated,
    });

    res.status(201).json(hydrated);
  } catch (err) {
    if (err.code === 'SHOP_NOT_CONFIGURED') return res.status(400).json({ code: err.code, message: err.message });
    if (err.message.includes('not found') || err.message.includes('can only return') || err.message.includes('required')) {
      return res.status(400).json({ message: err.message });
    }
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ── GET RETURNS FOR A PURCHASE ─────────────────────────────────────────────────
const getReturnsForPurchase = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const returns = await PurchaseReturn.find({
      shop: shop._id, original_purchase: req.params.purchaseId, status: { $ne: 'cancelled' },
    }).sort({ createdAt: -1 });
    res.json(returns);
  } catch (err) {
    if (err.code === 'SHOP_NOT_CONFIGURED') return res.status(400).json({ code: err.code, message: err.message });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

module.exports = { getPurchaseReturns, createPurchaseReturn, getReturnsForPurchase };
