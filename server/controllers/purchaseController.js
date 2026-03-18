const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');
const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const generateBillNumber = async (shopId) => {
  const count = await Purchase.countDocuments({ shop: shopId });
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `PUR-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

const calculateGST = (taxable_amount, gst_rate, shopState, supplierState) => {
  const gst = (taxable_amount * gst_rate) / 100;
  const isIGST = supplierState && shopState && shopState !== supplierState;
  if (isIGST) {
    return {
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: parseFloat(gst.toFixed(2)),
      total_gst: parseFloat(gst.toFixed(2)),
      gst_type: 'IGST',
    };
  } else {
    const half = parseFloat((gst / 2).toFixed(2));
    return {
      cgst_amount: half,
      sgst_amount: half,
      igst_amount: 0,
      total_gst: parseFloat(gst.toFixed(2)),
      gst_type: 'CGST_SGST',
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PURCHASES
// ─────────────────────────────────────────────────────────────────────────────

const getPurchases = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { supplierId, payment_status, from, to } = req.query;

    const filter = { shop: shop._id };
    if (supplierId) filter.supplier = supplierId;
    if (payment_status) filter.payment_status = payment_status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const purchases = await Purchase.find(filter)
      .populate('supplier', 'name phone gstin')
      .sort({ createdAt: -1 });

    // Compute summary totals
    const summary = purchases.reduce(
      (acc, p) => {
        acc.totalPurchaseValue += p.total_amount || 0;
        acc.totalITC += p.total_gst || 0;
        acc.totalPaid += p.amount_paid || 0;
        acc.totalDue += p.balance_due || 0;
        return acc;
      },
      { totalPurchaseValue: 0, totalITC: 0, totalPaid: 0, totalDue: 0 }
    );

    res.json({ purchases, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PURCHASE  (supports single-product AND multi-item)
// ─────────────────────────────────────────────────────────────────────────────

const createPurchase = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);

    const {
      // Multi-item bill
      items,                    // [{ product_id, quantity, price_per_unit }]

      // Legacy single-product (still supported)
      product_id, quantity, price_per_unit,

      // Supplier
      supplier_name, supplier_phone, supplier_gstin,
      supplier_address, supplier_state,

      // Payment
      payment_type = 'cash',
      amount_paid = 0,          // ← NEW: partial payment support

      notes,
    } = req.body;

    // ── Validate ────────────────────────────────────────────────
    if (payment_type === 'credit' && !supplier_name) {
      return res.status(400).json({ message: 'Credit purchase ke liye supplier ka naam zaroori hai!' });
    }

    // ── Normalise to items array ────────────────────────────────
    // If old single-product format is sent, wrap it in items array
    const rawItems = items && items.length > 0
      ? items
      : [{ product_id, quantity, price_per_unit }];

    // ── Build resolved items + calculate totals ─────────────────
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let grandTotal = 0;

    const invoice_type = (supplier_gstin && supplier_gstin.trim() !== '') ? 'B2B' : 'B2C';
    const invoice_number = await generateBillNumber(shop._id);

    const resolvedItems = [];

    for (const item of rawItems) {
      const product = await Product.findById(item.product_id);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.product_id}` });
      }

      const qty = Number(item.quantity);
      const ppu = Number(item.price_per_unit);
      const gst_rate = product.gst_rate || 0;
      const taxable = parseFloat((qty * ppu).toFixed(2));
      const gstCalc = calculateGST(taxable, gst_rate, shop.state, supplier_state);
      const lineTotal = parseFloat((taxable + gstCalc.total_gst).toFixed(2));

      totalTaxable += taxable;
      totalCGST += gstCalc.cgst_amount;
      totalSGST += gstCalc.sgst_amount;
      totalIGST += gstCalc.igst_amount;
      totalGST += gstCalc.total_gst;
      grandTotal += lineTotal;

      resolvedItems.push({
        product: product._id,
        product_name: product.name,
        hsn_code: product.hsn_code,
        quantity: qty,
        price_per_unit: ppu,
        gst_rate,
        taxable_amount: taxable,
        ...gstCalc,
        total_amount: lineTotal,
      });

      // ✅ Increase stock for each product
      await Product.findByIdAndUpdate(product._id, {
        $inc: { quantity: qty },
        // Update last purchase cost so profit calc is accurate
        $set: { cost_price: ppu },
      });
    }

    // Round bill totals
    totalTaxable = parseFloat(totalTaxable.toFixed(2));
    totalGST = parseFloat(totalGST.toFixed(2));
    grandTotal = parseFloat(grandTotal.toFixed(2));
    const paid = parseFloat(Number(amount_paid).toFixed(2));

    // ── Create purchase doc ─────────────────────────────────────
    // Keep top-level fields populated for single-item backward compat
    const firstItem = resolvedItems[0];
    const purchase = await Purchase.create({
      shop: shop._id,
      items: resolvedItems,

      // Legacy top-level fields (single product)
      product: firstItem.product,
      product_name: firstItem.product_name,
      hsn_code: firstItem.hsn_code,
      quantity: firstItem.quantity,
      price_per_unit: firstItem.price_per_unit,
      gst_rate: firstItem.gst_rate,
      gst_type: firstItem.gst_type,

      invoice_type,
      invoice_number,

      taxable_amount: totalTaxable,
      cgst_amount: parseFloat(totalCGST.toFixed(2)),
      sgst_amount: parseFloat(totalSGST.toFixed(2)),
      igst_amount: parseFloat(totalIGST.toFixed(2)),
      total_gst: totalGST,
      total_amount: grandTotal,

      payment_type,
      amount_paid: paid,
      // balance_due & payment_status set by pre-save hook

      supplier_name: supplier_name || '',
      supplier_phone: supplier_phone || '',
      supplier_gstin: supplier_gstin || '',
      supplier_address: supplier_address || '',
      supplier_state: supplier_state || '',

      notes,
    });

    // ── Supplier ledger update (credit purchases) ───────────────
    const balanceDue = grandTotal - paid;

    if (payment_type === 'credit' && supplier_name) {
      // Find or create supplier
      let supplier = await Supplier.findOne({
        shop: shop._id,
        $or: [
          { name: { $regex: new RegExp(`^${supplier_name}$`, 'i') } },
          ...(supplier_phone ? [{ phone: supplier_phone }] : []),
        ],
      });

      if (!supplier) {
        supplier = await Supplier.create({
          shop: shop._id,
          name: supplier_name,
          phone: supplier_phone || '',
          gstin: supplier_gstin || '',
          address: supplier_address || '',
          state: supplier_state || '',
          totalPurchased: 0,
          totalPaid: 0,
          totalUdhaar: 0,
        });
      }

      // Update supplier totals
      supplier.totalPurchased = parseFloat((supplier.totalPurchased + grandTotal).toFixed(2));
      supplier.totalPaid = parseFloat((supplier.totalPaid + paid).toFixed(2));
      supplier.totalUdhaar = parseFloat((supplier.totalPurchased - supplier.totalPaid).toFixed(2));
      await supplier.save();

      // Link supplier ObjectId to purchase
      await Purchase.findByIdAndUpdate(purchase._id, { supplier: supplier._id });

      // ✅ Ledger entry: debit (we owe supplier)
      await SupplierUdhaar.create({
        shop: shop._id,
        supplier: supplier._id,
        type: 'debit',
        amount: grandTotal,
        running_balance: supplier.totalUdhaar,  // ← running balance after this entry
        note: `Credit Purchase — ${resolvedItems.map(i => i.product_name).join(', ')} (${invoice_number})`,
        date: new Date(),
        reference_id: invoice_number,
        reference_type: 'purchase',
      });

      // ✅ If partial payment was made upfront, log that too
      if (paid > 0) {
        const balanceAfterPayment = supplier.totalUdhaar;
        await SupplierUdhaar.create({
          shop: shop._id,
          supplier: supplier._id,
          type: 'credit',
          amount: paid,
          running_balance: balanceAfterPayment,
          note: `Advance payment at time of purchase (${invoice_number})`,
          date: new Date(),
          reference_id: invoice_number,
          reference_type: 'purchase',
        });
      }
    }

    res.status(201).json(purchase);
  } catch (err) {
    console.error('createPurchase error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PURCHASE  (reverses stock + supplier ledger)
// ─────────────────────────────────────────────────────────────────────────────

const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    // ✅ Reverse stock for all items
    if (purchase.items && purchase.items.length > 0) {
      for (const item of purchase.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
      }
    } else if (purchase.product) {
      // Legacy single-product
      await Product.findByIdAndUpdate(purchase.product, { $inc: { quantity: -purchase.quantity } });
    }

    // ✅ Reverse supplier ledger (properly)
    if (purchase.payment_type === 'credit' && purchase.supplier) {
      const supplier = await Supplier.findById(purchase.supplier);
      if (supplier) {
        supplier.totalPurchased = Math.max(0, supplier.totalPurchased - purchase.total_amount);
        supplier.totalPaid = Math.max(0, supplier.totalPaid - purchase.amount_paid);
        supplier.totalUdhaar = parseFloat((supplier.totalPurchased - supplier.totalPaid).toFixed(2));
        await supplier.save();

        // Remove ledger entries for this purchase
        await SupplierUdhaar.deleteMany({ reference_id: purchase.invoice_number });
      }
    } else if (purchase.payment_type === 'credit' && purchase.supplier_name) {
      // Fallback if supplier ObjectId not linked (old records)
      const supplier = await Supplier.findOne({
        shop: purchase.shop,
        name: { $regex: new RegExp(`^${purchase.supplier_name}$`, 'i') },
      });
      if (supplier) {
        supplier.totalPurchased = Math.max(0, supplier.totalPurchased - purchase.total_amount);
        supplier.totalPaid = Math.max(0, supplier.totalPaid - purchase.amount_paid);
        supplier.totalUdhaar = parseFloat((supplier.totalPurchased - supplier.totalPaid).toFixed(2));
        await supplier.save();
        await SupplierUdhaar.deleteMany({ reference_id: purchase.invoice_number });
      }
    }

    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted and stock reversed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ITC SUMMARY  (used by GST page)
// Returns total input tax credit for a given month/year
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

    // Round all
    Object.keys(summary).forEach((k) => {
      if (k !== 'count') summary[k] = parseFloat(summary[k].toFixed(2));
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPurchases, createPurchase, deletePurchase, getITCSummary };