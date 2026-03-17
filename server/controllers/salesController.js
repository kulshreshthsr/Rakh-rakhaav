const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Udhaar = require('../models/udhaarModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const generateInvoiceNumber = async (shopId) => {
  const count = await Sale.countDocuments({ shop: shopId });
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

const calculateGST = (taxable_amount, gst_rate, gst_type, shopState, buyerState) => {
  const gst = (taxable_amount * gst_rate) / 100;
  const isIGST = gst_type === 'IGST' || (buyerState && shopState && shopState !== buyerState);
  if (isIGST) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: parseFloat(gst.toFixed(2)), total_gst: parseFloat(gst.toFixed(2)), gst_type: 'IGST' };
  } else {
    const half = parseFloat((gst / 2).toFixed(2));
    return { cgst_amount: half, sgst_amount: half, igst_amount: 0, total_gst: parseFloat(gst.toFixed(2)), gst_type: 'CGST_SGST' };
  }
};

const getSales = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const sales = await Sale.find({ shop: shop._id }).sort({ createdAt: -1 });
    const result = sales.map(s => ({
      _id: s._id,
      product_name: s.product_name,
      hsn_code: s.hsn_code,
      quantity: s.quantity,
      price_per_unit: s.price_per_unit,
      gst_rate: s.gst_rate,
      gst_type: s.gst_type,
      taxable_amount: s.taxable_amount,
      cgst_amount: s.cgst_amount,
      sgst_amount: s.sgst_amount,
      igst_amount: s.igst_amount,
      total_gst: s.total_gst,
      total_amount: s.total_amount,
      buyer_name: s.buyer_name,
      buyer_gstin: s.buyer_gstin,
      buyer_address: s.buyer_address,
      invoice_number: s.invoice_number,
      invoice_type: s.invoice_type,
      payment_type: s.payment_type,
      notes: s.notes,
      sold_at: s.createdAt,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSale = async (req, res) => {
  const {
    product_id, quantity, price_per_unit,
    buyer_name, buyer_gstin, buyer_address, buyer_state, buyer_phone,
    notes, payment_type = 'cash'
  } = req.body;

  try {
    const shop = await getOrCreateShop(req.user.id);
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Credit sale requires buyer name
    if (payment_type === 'credit' && !buyer_name) {
      return res.status(400).json({ message: 'Credit sale ke liye customer ka naam zaroori hai!' });
    }

    const taxable_amount = parseFloat((quantity * price_per_unit).toFixed(2));
    const gst_rate = product.gst_rate || 0;
    const gstCalc = calculateGST(taxable_amount, gst_rate, 'AUTO', shop.state, buyer_state);
    const total_amount = parseFloat((taxable_amount + gstCalc.total_gst).toFixed(2));
    const invoice_number = await generateInvoiceNumber(shop._id);
    const invoice_type = buyer_gstin ? 'B2B' : 'B2C';

    const sale = await Sale.create({
      shop: shop._id,
      product: product_id,
      product_name: product.name,
      hsn_code: product.hsn_code,
      quantity,
      price_per_unit,
      gst_rate,
      taxable_amount,
      ...gstCalc,
      total_amount,
      buyer_name,
      buyer_gstin,
      buyer_address,
      invoice_number,
      invoice_type,
      payment_type,
      notes,
    });

    // ✅ Stock reduce
    await Product.findByIdAndUpdate(product_id, { $inc: { quantity: -quantity } });

    // ✅ Credit sale — auto create customer + udhaar entry
    if (payment_type === 'credit' && buyer_name) {
      // Check if customer already exists
      let customer = await Customer.findOne({
        shop: shop._id,
        $or: [
          { name: { $regex: new RegExp(`^${buyer_name}$`, 'i') } },
          ...(buyer_phone ? [{ phone: buyer_phone }] : [])
        ]
      });

      // Create new customer if not exists
      if (!customer) {
        customer = await Customer.create({
          shop: shop._id,
          name: buyer_name,
          phone: buyer_phone || '',
          totalUdhaar: 0,
        });
      }

      // Create udhaar debit entry
      await Udhaar.create({
        shop: shop._id,
        customer: customer._id,
        type: 'debit',
        amount: total_amount,
        note: `Credit Sale - ${product.name} (${invoice_number})`,
        date: new Date(),
        reference_id: invoice_number,
        reference_type: 'sale',
      });

      // Update customer balance
      await Customer.findByIdAndUpdate(customer._id, {
        $inc: { totalUdhaar: total_amount }
      });
    }

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    // Restore stock
    await Product.findByIdAndUpdate(sale.product, { $inc: { quantity: sale.quantity } });

    // If credit sale, reverse udhaar entry
    if (sale.payment_type === 'credit' && sale.buyer_name) {
      const shop = await getOrCreateShop(sale.shop);
      const customer = await Customer.findOne({
        shop: sale.shop,
        name: { $regex: new RegExp(`^${sale.buyer_name}$`, 'i') }
      });
      if (customer) {
        await Customer.findByIdAndUpdate(customer._id, {
          $inc: { totalUdhaar: -sale.total_amount }
        });
        await Udhaar.deleteOne({
          reference_id: sale.invoice_number,
          reference_type: 'sale',
        });
      }
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getGSTSummary = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const sales = await Sale.find({
      shop: shop._id,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const purchases = await Purchase.find({
      shop: shop._id,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const b2b = sales.filter(s => s.invoice_type === 'B2B');
    const b2c = sales.filter(s => s.invoice_type !== 'B2B');

    const summary = {
      month: parseInt(month),
      year: parseInt(year),
      sales: {
        total: sales.length,
        taxable_amount: sales.reduce((s, x) => s + (x.taxable_amount || 0), 0),
        total_gst: sales.reduce((s, x) => s + (x.total_gst || 0), 0),
        cgst: sales.reduce((s, x) => s + (x.cgst_amount || 0), 0),
        sgst: sales.reduce((s, x) => s + (x.sgst_amount || 0), 0),
        igst: sales.reduce((s, x) => s + (x.igst_amount || 0), 0),
        total_amount: sales.reduce((s, x) => s + (x.total_amount || 0), 0),
        b2b_count: b2b.length,
        b2c_count: b2c.length,
        b2b_taxable: b2b.reduce((s, x) => s + (x.taxable_amount || 0), 0),
        b2c_taxable: b2c.reduce((s, x) => s + (x.taxable_amount || 0), 0),
      },
      purchases: {
        total: purchases.length,
        taxable_amount: purchases.reduce((s, x) => s + (x.taxable_amount || 0), 0),
        total_gst: purchases.reduce((s, x) => s + (x.total_gst || 0), 0),
        cgst: purchases.reduce((s, x) => s + (x.cgst_amount || 0), 0),
        sgst: purchases.reduce((s, x) => s + (x.sgst_amount || 0), 0),
        igst: purchases.reduce((s, x) => s + (x.igst_amount || 0), 0),
      },
      gstr1: {
        b2b_invoices: b2b.map(s => ({
          invoice_number: s.invoice_number,
          date: s.createdAt,
          buyer_name: s.buyer_name,
          buyer_gstin: s.buyer_gstin,
          taxable_amount: s.taxable_amount,
          gst_rate: s.gst_rate,
          cgst: s.cgst_amount,
          sgst: s.sgst_amount,
          igst: s.igst_amount,
          total: s.total_amount,
          gst_type: s.gst_type,
        })),
        b2c_summary: {
          taxable_amount: b2c.reduce((s, x) => s + (x.taxable_amount || 0), 0),
          total_gst: b2c.reduce((s, x) => s + (x.total_gst || 0), 0),
          total_amount: b2c.reduce((s, x) => s + (x.total_amount || 0), 0),
        }
      },
      gstr3b: {
        outward_taxable: sales.reduce((s, x) => s + (x.taxable_amount || 0), 0),
        output_gst: sales.reduce((s, x) => s + (x.total_gst || 0), 0),
        input_gst: purchases.reduce((s, x) => s + (x.total_gst || 0), 0),
        net_payable: sales.reduce((s, x) => s + (x.total_gst || 0), 0) - purchases.reduce((s, x) => s + (x.total_gst || 0), 0),
      }
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSales, createSale, deleteSale, getGSTSummary };