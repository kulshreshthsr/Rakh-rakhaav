const mongoose = require('mongoose');
const PurchaseOrder = require('../models/purchaseOrderModel');
const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Supplier = require('../models/supplierModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { getShopOrFail } = require('../utils/shopGuard');
const { logStockMovements } = require('../utils/stockMovementLogger');
const logger = require('../utils/logger');

const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));
const parseDate = (value, fallback = new Date()) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

const generateSequenceNumber = async (shopId, docType, prefix, session = null, date = new Date()) => {
  const financialYear = getFinancialYear(date);
  let query = DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: docType, financial_year: financialYear },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) query = query.session(session);
  const sequence = await query;
  return `${prefix}/${financialYear}/${String(sequence.last_number).padStart(4, '0')}`;
};

const normalizeItems = (items = []) => items
  .map((item) => ({
    product: item.product || null,
    product_name: String(item.product_name || '').trim(),
    hsn_code: String(item.hsn_code || '').trim(),
    ordered_quantity: round2(item.ordered_quantity),
    received_quantity: round2(item.received_quantity || 0),
    unit: String(item.unit || '').trim(),
    agreed_price: round2(item.agreed_price),
    gst_rate: round2(item.gst_rate),
  }))
  .filter((item) => item.product || item.product_name);

const calculateTotals = (items = [], shopState = '', supplierState = '') => {
  const isInterState = Boolean(shopState && supplierState && String(shopState).trim().toLowerCase() !== String(supplierState).trim().toLowerCase());
  return items.reduce((accumulator, item) => {
    const taxable = round2(Number(item.ordered_quantity || 0) * Number(item.agreed_price || 0));
    const gst = round2((taxable * Number(item.gst_rate || 0)) / 100);
    const lineTotal = round2(taxable + gst);
    accumulator.total += lineTotal;
    accumulator.taxable += taxable;
    accumulator.gst += gst;
    accumulator.lines.push({
      ...item,
      taxable_amount: taxable,
      total_gst: gst,
      total_amount: lineTotal,
      gst_type: isInterState ? 'IGST' : 'CGST_SGST',
    });
    return accumulator;
  }, { taxable: 0, gst: 0, total: 0, lines: [] });
};

const createPO = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { supplier, supplier_name, status = 'draft', items = [], expected_delivery_date, delivery_site, notes, po_date } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const normalizedItems = normalizeItems(items);
    if (normalizedItems.length === 0) {
      return res.status(400).json({ message: 'At least one valid item is required' });
    }
    if (normalizedItems.some((item) => !item.product)) {
      return res.status(400).json({ message: 'Each PO item must be linked to a product' });
    }

    let supplierDoc = null;
    if (supplier) {
      supplierDoc = await Supplier.findOne({ _id: supplier, shop: shop._id });
      if (!supplierDoc) return res.status(404).json({ message: 'Supplier not found' });
    }

    const poDate = parseDate(po_date);
    const poNumber = await generateSequenceNumber(shop._id, 'purchase_order', 'PO', null, poDate);
    const totals = calculateTotals(normalizedItems, shop.state || '', supplierDoc?.state || '');

    const [purchaseOrder] = await PurchaseOrder.create([{
      shop: shop._id,
      po_number: poNumber,
      supplier: supplierDoc?._id || null,
      supplier_name: supplierDoc?.name || supplier_name || '',
      status: status === 'sent' ? 'sent' : 'draft',
      items: totals.lines,
      expected_delivery_date: expected_delivery_date || null,
      delivery_site: delivery_site || '',
      notes: notes || '',
      po_date: poDate,
      total_amount: round2(totals.total),
    }]);

    return res.status(201).json(purchaseOrder);
  } catch (err) {
    logger.error('[purchaseOrderController:createPO]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

const getPOs = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { status, supplier, from, to, cursor, limit: limitParam } = req.query;

    const filter = { shop: shop._id };
    if (status) filter.status = status;
    if (supplier) filter.supplier = supplier;
    if (from || to) {
      filter.po_date = {};
      if (from) filter.po_date.$gte = new Date(from);
      if (to) filter.po_date.$lte = new Date(to);
    }
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 50, 200);
    const docs = await PurchaseOrder.find(filter)
      .populate('supplier', 'name phone gstin state')
      .sort({ po_date: -1, _id: -1 })
      .limit(pageSize + 1)
      .lean({ virtuals: true });

    const hasMore = docs.length > pageSize;
    const page = hasMore ? docs.slice(0, pageSize) : docs;
    const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

    return res.json({ purchaseOrders: page, hasMore, nextCursor });
  } catch (err) {
    logger.error('[purchaseOrderController:getPOs]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

const getPO = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, shop: shop._id })
      .populate('supplier', 'name phone gstin state address')
      .populate('items.product', 'name price cost_price gst_rate unit barcode sku')
      .lean({ virtuals: true });
    if (!purchaseOrder) return res.status(404).json({ message: 'Purchase order not found' });
    return res.json(purchaseOrder);
  } catch (err) {
    logger.error('[purchaseOrderController:getPO]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

const updatePO = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, shop: shop._id });
    if (!purchaseOrder) return res.status(404).json({ message: 'Purchase order not found' });
    if (purchaseOrder.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft purchase orders can be edited' });
    }

    const { supplier, supplier_name, status, items, expected_delivery_date, delivery_site, notes, po_date } = req.body;
    if (supplier !== undefined) {
      if (supplier) {
        const supplierDoc = await Supplier.findOne({ _id: supplier, shop: shop._id });
        if (!supplierDoc) return res.status(404).json({ message: 'Supplier not found' });
        purchaseOrder.supplier = supplierDoc._id;
        purchaseOrder.supplier_name = supplierDoc.name;
      } else {
        purchaseOrder.supplier = null;
        purchaseOrder.supplier_name = supplier_name || '';
      }
    }
    if (supplier_name !== undefined) purchaseOrder.supplier_name = supplier_name;
    if (status && ['draft', 'sent'].includes(status)) purchaseOrder.status = status;
    if (items !== undefined) {
      const normalizedItems = normalizeItems(items);
      if (normalizedItems.some((item) => !item.product)) {
        return res.status(400).json({ message: 'Each PO item must be linked to a product' });
      }
      purchaseOrder.items = normalizedItems;
    }
    if (expected_delivery_date !== undefined) purchaseOrder.expected_delivery_date = expected_delivery_date || null;
    if (delivery_site !== undefined) purchaseOrder.delivery_site = delivery_site || '';
    if (notes !== undefined) purchaseOrder.notes = notes || '';
    if (po_date !== undefined) purchaseOrder.po_date = parseDate(po_date, purchaseOrder.po_date);

    const totals = calculateTotals(purchaseOrder.items, shop.state || '', purchaseOrder.supplier ? (await Supplier.findById(purchaseOrder.supplier).select('state'))?.state || '' : '');
    purchaseOrder.total_amount = round2(totals.total);
    purchaseOrder.items = totals.lines;
    await purchaseOrder.save();
    return res.json(purchaseOrder);
  } catch (err) {
    logger.error('[purchaseOrderController:updatePO]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

const cancelPO = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, shop: shop._id });
    if (!purchaseOrder) return res.status(404).json({ message: 'Purchase order not found' });
    if (purchaseOrder.status === 'received') {
      return res.status(400).json({ message: 'Received purchase orders cannot be cancelled' });
    }
    purchaseOrder.status = 'cancelled';
    await purchaseOrder.save();
    return res.json({ message: 'Purchase order cancelled', purchaseOrder });
  } catch (err) {
    logger.error('[purchaseOrderController:cancelPO]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

const buildPurchaseFromReceipt = async ({ shop, purchaseOrder, receiptItems, grnNumber, session, userId }) => {
  const supplierDoc = purchaseOrder.supplier
    ? await Supplier.findOne({ _id: purchaseOrder.supplier, shop: shop._id }).session(session)
    : null;
  const purchaseInvoiceNumber = await generateSequenceNumber(shop._id, 'purchase', 'PUR', session, new Date());
  const isInterState = Boolean(
    String(shop.state || '').trim().toLowerCase()
    && String(supplierDoc?.state || '').trim().toLowerCase()
    && String(shop.state || '').trim().toLowerCase() !== String(supplierDoc?.state || '').trim().toLowerCase()
  );
  const items = [];
  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalGST = 0;
  let totalAmount = 0;

  for (const receiptItem of receiptItems) {
    const orderedItem = purchaseOrder.items.find((item) => String(item.product) === String(receiptItem.productId));
    if (!orderedItem) continue;
    const quantity = round2(receiptItem.receivedQuantity);
    if (quantity <= 0) continue;
    const taxable = round2(quantity * Number(orderedItem.agreed_price || 0));
    const gst = round2((taxable * Number(orderedItem.gst_rate || 0)) / 100);
    const lineTotal = round2(taxable + gst);
    const cgstAmount = isInterState ? 0 : round2(gst / 2);
    const sgstAmount = isInterState ? 0 : round2(gst - cgstAmount);
    const igstAmount = isInterState ? gst : 0;
    totalTaxable = round2(totalTaxable + taxable);
    totalCGST = round2(totalCGST + cgstAmount);
    totalSGST = round2(totalSGST + sgstAmount);
    totalIGST = round2(totalIGST + igstAmount);
    totalGST = round2(totalGST + gst);
    totalAmount = round2(totalAmount + lineTotal);

    items.push({
      product: receiptItem.productId,
      product_name: receiptItem.productName,
      hsn_code: orderedItem.hsn_code || '',
      quantity,
      price_per_unit: Number(orderedItem.agreed_price || 0),
      gst_rate: Number(orderedItem.gst_rate || 0),
      taxable_amount: taxable,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_gst: gst,
      total_amount: lineTotal,
      gst_type: isInterState ? 'IGST' : 'CGST_SGST',
      item_metadata: {},
    });
  }

  const [purchase] = await Purchase.create([{
    shop: shop._id,
    items,
    product: items[0]?.product || null,
    product_name: items[0]?.product_name || '',
    hsn_code: items[0]?.hsn_code || '',
    quantity: items[0]?.quantity || 0,
    price_per_unit: items[0]?.price_per_unit || 0,
    gst_rate: items[0]?.gst_rate || 0,
    total_taxable_amount: totalTaxable,
    taxable_amount: totalTaxable,
    total_gst: totalGST,
    cgst_amount: totalCGST,
    sgst_amount: totalSGST,
    igst_amount: totalIGST,
    total_amount: totalAmount,
    payment_type: 'credit',
    amount_paid: 0,
    payment_status: 'unpaid',
    supplier: supplierDoc?._id || null,
    supplier_name: supplierDoc?.name || purchaseOrder.supplier_name || '',
    invoice_number: purchaseInvoiceNumber,
    invoice_type: 'B2B',
    notes: `Auto-created from ${purchaseOrder.po_number}`,
    receipt_status: 'received',
    grn_number: grnNumber,
    purchase_order: purchaseOrder._id,
    purchase_order_number: purchaseOrder.po_number,
  }], { session });

  return purchase;
};

const receivePO = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let response = null;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, shop: shop._id }).session(session);
      if (!purchaseOrder) throw new Error('Purchase order not found');
      if (purchaseOrder.status === 'cancelled') throw new Error('Cancelled purchase order cannot be received');

      const receiptItems = Array.isArray(req.body.items) ? req.body.items : [];
      if (receiptItems.length === 0) throw new Error('At least one received item is required');

      const supplierDoc = purchaseOrder.supplier
        ? await Supplier.findOne({ _id: purchaseOrder.supplier, shop: shop._id }).session(session)
        : null;
      const grnNumber = await generateSequenceNumber(shop._id, 'purchase_order_grn', 'GRN', session, new Date());

      const movementDocs = [];
      const purchaseItems = [];
      let totalValue = 0;

      for (const receiptItem of receiptItems) {
        const productId = receiptItem.product || receiptItem.product_id;
        const receivedQuantity = round2(receiptItem.received_quantity ?? receiptItem.quantity ?? 0);
        if (!productId || receivedQuantity <= 0) continue;

        const currentProduct = await Product.findOne({ _id: productId, shop: shop._id }).session(session);
        if (!currentProduct) throw new Error('Product not found while receiving PO');

        const line = purchaseOrder.items.find((item) => String(item.product) === String(productId));
        if (!line) throw new Error(`Item not found in purchase order: ${currentProduct.name}`);

        const alreadyReceived = round2(line.received_quantity || 0);
        const remaining = round2(line.ordered_quantity - alreadyReceived);
        const accepted = Math.min(receivedQuantity, remaining);
        if (accepted <= 0) continue;

        line.received_quantity = round2(alreadyReceived + accepted);
        const quantityAfter = round2((currentProduct.quantity || 0) + accepted);
        currentProduct.quantity = quantityAfter;
        await currentProduct.save({ session });

        movementDocs.push({
          product: currentProduct._id,
          type: 'purchase',
          quantityChange: accepted,
          quantityAfter,
          referenceId: purchaseOrder.po_number,
          referenceType: 'purchase_order_receive',
          note: `PO receive: ${purchaseOrder.po_number}`,
          performedBy: req.user?.id,
        });

        purchaseItems.push({
          productId: currentProduct._id,
          productName: currentProduct.name,
          receivedQuantity: accepted,
        });

        totalValue = round2(totalValue + (accepted * Number(line.agreed_price || 0)));
      }

      if (!movementDocs.length) throw new Error('No valid quantities were received');

      await logStockMovements(shop._id, movementDocs, { session });
      await purchaseOrder.save({ session });

      const allFullyReceived = purchaseOrder.items.every((item) => round2(item.received_quantity) >= round2(item.ordered_quantity));
      purchaseOrder.status = allFullyReceived ? 'received' : 'partially_received';

      const purchase = await buildPurchaseFromReceipt({
        shop,
        purchaseOrder,
        receiptItems: purchaseItems,
        grnNumber,
        session,
        userId: req.user.id,
      });

      purchaseOrder.grn_number = grnNumber;
      purchaseOrder.purchase_id = purchase._id;
      await purchaseOrder.save({ session });

      response = {
        grn_number: grnNumber,
        purchaseOrder,
        purchase,
      };
    });

    return res.status(201).json(response);
  } catch (err) {
    logger.error('[purchaseOrderController:receivePO]', err.message || err);
    return res.status(400).json({ message: err.message || 'Something went wrong' });
  } finally {
    session.endSession();
  }
};

const convertToPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let response = null;
    await session.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, shop: shop._id }).session(session);
      if (!purchaseOrder) throw new Error('Purchase order not found');

      const fullyReceived = purchaseOrder.items.every((item) => round2(item.received_quantity) >= round2(item.ordered_quantity));
      if (!fullyReceived) throw new Error('Purchase order must be fully received before conversion');

      if (purchaseOrder.purchase_id) {
        const existingPurchase = await Purchase.findOne({ _id: purchaseOrder.purchase_id, shop: shop._id }).session(session);
        response = { purchaseOrder, purchase: existingPurchase };
        return;
      }

      const grnNumber = purchaseOrder.grn_number || await generateSequenceNumber(shop._id, 'purchase_order_grn', 'GRN', session, new Date());
      const receiptItems = purchaseOrder.items.map((item) => ({
        productId: item.product,
        productName: item.product_name,
        receivedQuantity: item.received_quantity,
      }));

      const purchase = await buildPurchaseFromReceipt({
        shop,
        purchaseOrder,
        receiptItems,
        grnNumber,
        session,
        userId: req.user.id,
      });

      purchaseOrder.purchase_id = purchase._id;
      purchaseOrder.grn_number = grnNumber;
      purchaseOrder.status = 'received';
      await purchaseOrder.save({ session });
      response = { purchaseOrder, purchase };
    });

    return res.json(response);
  } catch (err) {
    logger.error('[purchaseOrderController:convertToPurchase]', err.message || err);
    return res.status(400).json({ message: err.message || 'Something went wrong' });
  } finally {
    session.endSession();
  }
};

module.exports = {
  createPO,
  getPOs,
  getPO,
  updatePO,
  cancelPO,
  receivePO,
  convertToPurchase,
};
