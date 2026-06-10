const mongoose = require('mongoose');
const SaleReturn = require('../models/saleReturnModel');
const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Customer = require('../models/customerModel');
const Udhaar = require('../models/udhaarModel');
const DocumentSequence = require('../models/documentSequenceModel');
const ProductBatch = require('../models/productBatchModel');
const ProductVariant = require('../models/productVariantModel');
const SerialInventory = require('../models/serialInventoryModel');
const { logAuditEvent } = require('../utils/auditTrail');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');
const { logStockMovements } = require('../utils/stockMovementLogger');

const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

const generateReturnNumber = async (shopId, session = null) => {
  const financialYear = getFinancialYear();
  let query = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'sale_return', financial_year: financialYear },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) query = query.session(session);
  const sequence = await query;
  return `RET/${financialYear}/${String(sequence.last_number).padStart(4, '0')}`;
};

// ── GET ALL RETURNS ────────────────────────────────────────────────────────────
const getSaleReturns = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { from, to, saleId, limit: limitParam, cursor } = req.query;

    const filter = { shop: shop._id };
    if (saleId) filter.original_sale = saleId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 100, 500);
    const returns = await SaleReturn.find(filter)
      .populate('customer', 'name phone')
      .populate('original_sale', 'invoice_number total_amount')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1);

    const hasMore = returns.length > pageSize;
    const page = hasMore ? returns.slice(0, pageSize) : returns;
    res.json({ returns: page, hasMore, nextCursor: hasMore ? String(page[page.length - 1]._id) : null });
  } catch (err) {
    logger.error('[saleReturnController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CREATE RETURN ──────────────────────────────────────────────────────────────
const createSaleReturn = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let returnId;
    let auditShopId;

    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      auditShopId = shop._id;

      const { sale_id, items, refund_mode = 'cash', reason, notes } = req.body;

      if (!sale_id || !Array.isArray(items) || items.length === 0) {
        throw new Error('sale_id and at least one item are required');
      }

      const originalSale = await Sale.findOne({ _id: sale_id, shop: shop._id }).session(session);
      if (!originalSale) throw new Error('Original sale not found');

      // Validate return quantities do not exceed original sale quantities
      const originalQtyMap = new Map();
      const allItems = originalSale.items?.length > 0
        ? originalSale.items
        : [{ product: originalSale.product, quantity: originalSale.quantity, price_per_unit: originalSale.price_per_unit, cost_price: originalSale.cost_price, gst_rate: originalSale.gst_rate, taxable_amount: originalSale.taxable_amount, cgst_amount: originalSale.cgst_amount, sgst_amount: originalSale.sgst_amount, igst_amount: originalSale.igst_amount, total_gst: originalSale.total_gst, total_amount: originalSale.total_amount, item_metadata: {} }];

      for (const item of allItems) {
        const pid = String(item.product);
        originalQtyMap.set(pid, (originalQtyMap.get(pid) || 0) + Number(item.quantity || 0));
      }

      // Check if previous returns already consumed some quantity
      const existingReturns = await SaleReturn.find({
        shop: shop._id, original_sale: sale_id, status: { $ne: 'cancelled' },
      }).session(session);
      const alreadyReturnedMap = new Map();
      for (const ret of existingReturns) {
        for (const item of ret.items) {
          const pid = String(item.product);
          alreadyReturnedMap.set(pid, (alreadyReturnedMap.get(pid) || 0) + Number(item.quantity || 0));
        }
      }

      // Compute the pre-discount taxable total of the entire original invoice.
      // This is needed to prorate the bill-level discount across returned items.
      const originalPreDiscountTotal = round2(
        allItems.reduce((sum, i) => sum + round2(Number(i.quantity || 0) * Number(i.price_per_unit || 0)), 0)
      );
      const originalDiscountAmount = round2(Number(originalSale.discount_amount) || 0);

      let totalTaxable = 0, totalGST = 0, grandTotal = 0;
      let totalCGST = 0, totalSGST = 0, totalIGST = 0;
      const resolvedItems = [];

      for (const item of items) {
        const productId = item.product_id || item.product;
        let productQuery = Product.findById(productId);
        if (session) productQuery = productQuery.session(session);
        const product = await productQuery;
        if (!product) throw new Error(`Product not found: ${productId}`);

        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);

        const originalQty = originalQtyMap.get(String(product._id)) || 0;
        const alreadyReturned = alreadyReturnedMap.get(String(product._id)) || 0;
        const maxReturnable = originalQty - alreadyReturned;
        if (qty > maxReturnable) {
          throw new Error(`${product.name}: can only return ${maxReturnable} (${alreadyReturned} already returned of ${originalQty})`);
        }

        // Find matching item from original sale for price/gst data
        const originalItem = allItems.find(i => String(i.product) === String(product._id)) || {};
        const ppu = Number(item.price_per_unit || originalItem.price_per_unit || product.price);
        const gst_rate = Number(item.gst_rate ?? originalItem.gst_rate ?? product.gst_rate ?? 0);
        const linePreDiscount = round2(qty * ppu);
        // Prorate the bill-level discount to this line proportionally by its share of the
        // pre-discount total. Falls back to zero if originalPreDiscountTotal is 0.
        const lineDiscountShare = originalPreDiscountTotal > 0
          ? round2((linePreDiscount / originalPreDiscountTotal) * originalDiscountAmount)
          : 0;
        const taxable = round2(linePreDiscount - lineDiscountShare);
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
          type: 'sale_return',
          quantityChange: qty,
          quantityAfter,
          referenceId: originalSale.invoice_number,
          referenceType: 'sale_return',
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
            { $set: { status: 'in_stock' }, $unset: { sale_invoice: '', sale_date: '' } },
            opts
          );
        }

        resolvedItems.push({
          product: product._id,
          product_name: product.name,
          quantity: qty,
          price_per_unit: ppu,
          cost_price: Number(originalItem.cost_price || product.cost_price || 0),
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

      const returnNumber = await generateReturnNumber(shop._id, session);
      const refundAmount = round2(grandTotal);

      const [saleReturn] = await SaleReturn.create([{
        shop: shop._id,
        original_sale: originalSale._id,
        original_invoice_number: originalSale.invoice_number,
        return_number: returnNumber,
        items: resolvedItems,
        taxable_amount: round2(totalTaxable),
        cgst_amount: round2(totalCGST),
        sgst_amount: round2(totalSGST),
        igst_amount: round2(totalIGST),
        total_gst: round2(totalGST),
        total_amount: round2(grandTotal),
        refund_mode,
        refund_amount: refundAmount,
        customer: originalSale.customer,
        buyer_name: originalSale.buyer_name,
        reason: reason || '',
        notes: notes || '',
      }], { session });

      returnId = saleReturn._id;

      // Update customer udhaar if it was a credit sale
      if (originalSale.payment_type === 'credit' && originalSale.customer) {
        const customer = await Customer.findById(originalSale.customer).session(session);
        if (customer) {
          // Credit note: reduce what customer owes
          customer.totalSales = Math.max(0, round2((customer.totalSales || 0) - refundAmount));
          customer.totalUdhaar = Math.max(0, round2(customer.totalSales - (customer.totalPaid || 0)));
          await customer.save({ session });

          await Udhaar.create([{
            shop: shop._id,
            customer: originalSale.customer,
            type: 'credit',
            amount: refundAmount,
            running_balance: customer.totalUdhaar,
            payment_mode: refund_mode === 'credit_note' ? 'credit_note' : refund_mode,
            note: `Sale Return ${returnNumber} - ${resolvedItems.map(i => i.product_name).join(', ')}`,
            date: new Date(),
            reference_id: returnNumber,
            reference_type: 'sale_return',
          }], { session });
        }
      }
    });

    const hydrated = await SaleReturn.findById(returnId)
      .populate('customer', 'name phone')
      .populate('original_sale', 'invoice_number total_amount');

    await logAuditEvent({
      shopId: hydrated.shop,
      userId: req.user.id,
      actionType: 'create', entity: 'sale_return',
      entityId: hydrated._id,
      referenceId: hydrated.return_number,
      afterValue: hydrated,
    });

    res.status(201).json(hydrated);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('can only return')) {
      return res.status(400).json({ message: err.message });
    }
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  } finally {
    await session.endSession();
  }
};

// ── GET RETURNS FOR A SALE ─────────────────────────────────────────────────────
const getReturnsForSale = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const returns = await SaleReturn.find({
      shop: shop._id, original_sale: req.params.saleId, status: { $ne: 'cancelled' },
    }).sort({ createdAt: -1 });
    res.json(returns);
  } catch (err) {
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({ message: 'कुछ गलत हुआ। दोबारा try करें।', code: 'INTERNAL_ERROR', ...(isDev && { debug: err.message }) });
  }
};

module.exports = { getSaleReturns, createSaleReturn, getReturnsForSale };
