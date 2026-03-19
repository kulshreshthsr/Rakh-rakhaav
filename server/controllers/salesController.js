const Sale     = require('../models/salesModel');
const Product  = require('../models/productModel');
const Shop     = require('../models/shopModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Udhaar   = require('../models/udhaarModel');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const generateInvoiceNumber = async (shopId) => {
  const count = await Sale.countDocuments({ shop: shopId });
  const date  = new Date();
  const year  = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

const calculateGST = (taxable_amount, gst_rate, shopState, buyerState) => {
  const gst    = (taxable_amount * gst_rate) / 100;
  const isIGST = buyerState && shopState && shopState !== buyerState;
  if (isIGST) {
    return {
      cgst_amount: 0, sgst_amount: 0,
      igst_amount: parseFloat(gst.toFixed(2)),
      total_gst:   parseFloat(gst.toFixed(2)),
      gst_type:    'IGST',
    };
  } else {
    const half = parseFloat((gst / 2).toFixed(2));
    return {
      cgst_amount: half, sgst_amount: half, igst_amount: 0,
      total_gst:   parseFloat(gst.toFixed(2)),
      gst_type:    'CGST_SGST',
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL SALES
// ─────────────────────────────────────────────────────────────────────────────

const getSales = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { payment_type, from, to } = req.query;

    const filter = { shop: shop._id };
    if (payment_type) filter.payment_type = payment_type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(filter)
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });

    const summary = sales.reduce((acc, s) => {
      acc.totalRevenue += s.total_amount  || 0;
      acc.totalGST     += s.total_gst     || 0;
      acc.totalCOGS    += s.total_cost    || 0;
      acc.totalProfit  += s.gross_profit  || 0;
      return acc;
    }, { totalRevenue: 0, totalGST: 0, totalCOGS: 0, totalProfit: 0 });

    res.json({ sales, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SALE
// ─────────────────────────────────────────────────────────────────────────────

const createSale = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);

    const {
      items,
      product_id, quantity, price_per_unit,
      buyer_name, buyer_phone, buyer_gstin,
      buyer_address, buyer_state,
      payment_type = 'cash',
      notes,
    } = req.body;

    if (payment_type === 'credit' && !buyer_name) {
      return res.status(400).json({ message: 'Credit sale ke liye customer ka naam zaroori hai!' });
    }

    const rawItems = items && items.length > 0
      ? items
      : [{ product_id, quantity, price_per_unit }];

    let totalTaxable = 0, totalCGST = 0, totalSGST = 0;
    let totalIGST = 0, totalGST = 0, grandTotal = 0;
    let totalCost = 0;

    const invoice_type   = (buyer_gstin && buyer_gstin.trim() !== '') ? 'B2B' : 'B2C';
    const invoice_number = await generateInvoiceNumber(shop._id);
    const resolvedItems  = [];

    for (const item of rawItems) {
      const product = await Product.findById(item.product_id);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.product_id}` });
      }

      const qty      = Number(item.quantity);
      const ppu      = Number(item.price_per_unit);
      const cost     = product.cost_price || 0;
      const gst_rate = product.gst_rate   || 0;

      const taxable   = parseFloat((qty * ppu).toFixed(2));
      const gstCalc   = calculateGST(taxable, gst_rate, shop.state, buyer_state);
      const lineTotal = parseFloat((taxable + gstCalc.total_gst).toFixed(2));
      const lineCost  = parseFloat((cost * qty).toFixed(2));

      totalTaxable += taxable;
      totalCGST    += gstCalc.cgst_amount;
      totalSGST    += gstCalc.sgst_amount;
      totalIGST    += gstCalc.igst_amount;
      totalGST     += gstCalc.total_gst;
      grandTotal   += lineTotal;
      totalCost    += lineCost;

      resolvedItems.push({
        product:        product._id,
        product_name:   product.name,
        hsn_code:       product.hsn_code,
        quantity:       qty,
        price_per_unit: ppu,
        cost_price:     cost,
        gst_rate,
        taxable_amount: taxable,
        ...gstCalc,
        total_amount:   lineTotal,
      });

      await Product.findByIdAndUpdate(product._id, { $inc: { quantity: -qty } });
    }

    totalTaxable = parseFloat(totalTaxable.toFixed(2));
    totalGST     = parseFloat(totalGST.toFixed(2));
    grandTotal   = parseFloat(grandTotal.toFixed(2));
    totalCost    = parseFloat(totalCost.toFixed(2));

    const grossProfit = parseFloat((totalTaxable - totalCost).toFixed(2));
    const firstItem   = resolvedItems[0];

    const sale = await Sale.create({
      shop:     shop._id,
      items:    resolvedItems,

      product:        firstItem.product,
      product_name:   firstItem.product_name,
      hsn_code:       firstItem.hsn_code,
      quantity:       firstItem.quantity,
      price_per_unit: firstItem.price_per_unit,
      cost_price:     firstItem.cost_price,
      gst_rate:       firstItem.gst_rate,
      gst_type:       firstItem.gst_type,

      invoice_type,
      invoice_number,

      taxable_amount: totalTaxable,
      cgst_amount:    parseFloat(totalCGST.toFixed(2)),
      sgst_amount:    parseFloat(totalSGST.toFixed(2)),
      igst_amount:    parseFloat(totalIGST.toFixed(2)),
      total_gst:      totalGST,
      total_amount:   grandTotal,
      total_cost:     totalCost,
      gross_profit:   grossProfit,

      payment_type,
      buyer_name:    buyer_name || (invoice_type === 'B2C' ? 'Walk-in Customer' : ''),
      buyer_phone,
      buyer_gstin,
      buyer_address,
      notes,
    });

    if (payment_type === 'credit' && buyer_name) {
      let customer = await Customer.findOne({
        shop: shop._id,
        $or: [
          { name:  { $regex: new RegExp(`^${buyer_name}$`, 'i') } },
          ...(buyer_phone ? [{ phone: buyer_phone }] : []),
        ],
      });

      if (!customer) {
        customer = await Customer.create({
          shop: shop._id,
          name: buyer_name, phone: buyer_phone || '',
          gstin: buyer_gstin || '', address: buyer_address || '',
          totalSales: 0, totalPaid: 0, totalUdhaar: 0,
        });
      }

      customer.totalSales  = parseFloat((customer.totalSales + grandTotal).toFixed(2));
      customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
      await customer.save();
      await Sale.findByIdAndUpdate(sale._id, { customer: customer._id });

      await Udhaar.create({
        shop:            shop._id,
        customer:        customer._id,
        type:            'debit',
        amount:          grandTotal,
        running_balance: customer.totalUdhaar,
        note:            `Credit Sale — ${resolvedItems.map(i => i.product_name).join(', ')} (${invoice_number})`,
        date:            new Date(),
        reference_id:    invoice_number,
        reference_type:  'sale',
      });
    }

    res.status(201).json(sale);
  } catch (err) {
    console.error('createSale error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SALE
// ─────────────────────────────────────────────────────────────────────────────

const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
      }
    } else if (sale.product) {
      await Product.findByIdAndUpdate(sale.product, { $inc: { quantity: sale.quantity } });
    }

    if (sale.payment_type === 'credit') {
      const customerId = sale.customer;
      const customer   = customerId
        ? await Customer.findById(customerId)
        : await Customer.findOne({
            shop: sale.shop,
            name: { $regex: new RegExp(`^${sale.buyer_name}$`, 'i') },
          });

      if (customer) {
        customer.totalSales  = Math.max(0, customer.totalSales - sale.total_amount);
        customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
        await customer.save();
        await Udhaar.deleteMany({ reference_id: sale.invoice_number, reference_type: 'sale' });
      }
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted and stock reversed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFIT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const getProfitSummary = async (req, res) => {
  try {
    const shop         = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;
    const filter       = { shop: shop._id };

    if (month && year) {
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

    const netGSTPayable = parseFloat((s.totalGSTCollected - p.totalITC).toFixed(2));

    res.json({
      totalRevenue:   parseFloat(s.totalRevenue.toFixed(2)),
      totalTaxable:   parseFloat(s.totalTaxable.toFixed(2)),
      salesCount:     s.salesCount,
      totalCOGS:      parseFloat(s.totalCOGS.toFixed(2)),
      grossProfit:    parseFloat(s.totalGrossProfit.toFixed(2)),
      netProfit:      parseFloat(s.totalGrossProfit.toFixed(2)),
      gstCollected:   parseFloat(s.totalGSTCollected.toFixed(2)),
      gstITC:         parseFloat(p.totalITC.toFixed(2)),
      netGSTPayable,
      totalSpent:     parseFloat(p.totalSpent.toFixed(2)),
      purchasesCount: p.purchasesCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GST SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const getGSTSummary = async (req, res) => {
  try {
    const shop           = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);

    const sales     = await Sale.find({ shop: shop._id, createdAt: { $gte: startDate, $lte: endDate } });
    const purchases = await Purchase.find({ shop: shop._id, createdAt: { $gte: startDate, $lte: endDate } });

    const b2b = sales.filter(s => s.invoice_type === 'B2B');
    const b2c = sales.filter(s => s.invoice_type === 'B2C');

    const summary = {
      month:     parseInt(month),
      year:      parseInt(year),
      sales: {
        total:          sales.length,
        taxable_amount: parseFloat(sales.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        total_gst:      parseFloat(sales.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
        cgst:           parseFloat(sales.reduce((s, x) => s + (x.cgst_amount    || 0), 0).toFixed(2)),
        sgst:           parseFloat(sales.reduce((s, x) => s + (x.sgst_amount    || 0), 0).toFixed(2)),
        igst:           parseFloat(sales.reduce((s, x) => s + (x.igst_amount    || 0), 0).toFixed(2)),
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
        cgst:           parseFloat(purchases.reduce((s, x) => s + (x.cgst_amount    || 0), 0).toFixed(2)),
        sgst:           parseFloat(purchases.reduce((s, x) => s + (x.sgst_amount    || 0), 0).toFixed(2)),
        igst:           parseFloat(purchases.reduce((s, x) => s + (x.igst_amount    || 0), 0).toFixed(2)),
      },
      gstr1: {
        b2b_invoices: b2b.map(s => ({
          invoice_number: s.invoice_number,
          date:           s.createdAt,
          buyer_name:     s.buyer_name,
          buyer_gstin:    s.buyer_gstin,
          taxable_amount: s.taxable_amount,
          gst_rate:       s.gst_rate,
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
      gstr3b: {
        outward_taxable: parseFloat(sales.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        output_gst:      parseFloat(sales.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
        input_gst:       parseFloat(purchases.reduce((s, x) => s + (x.total_gst  || 0), 0).toFixed(2)),
        net_payable:     parseFloat((
          sales.reduce((s, x) => s + (x.total_gst     || 0), 0) -
          purchases.reduce((s, x) => s + (x.total_gst || 0), 0)
        ).toFixed(2)),
      },
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getSales,
  createSale,
  deleteSale,
  getGSTSummary,
  getProfitSummary,
};