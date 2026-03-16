const Sale = require('../models/salesModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

// Auto generate invoice number
const generateInvoiceNumber = async (shopId) => {
  const count = await Sale.countDocuments({ shop: shopId });
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

// GST calculation helper
const calculateGST = (taxable_amount, gst_rate, gst_type, shopState, buyerState) => {
  const gst = (taxable_amount * gst_rate) / 100;

  // Auto detect IGST vs CGST/SGST based on states
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
      notes: s.notes,
      sold_at: s.createdAt,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSale = async (req, res) => {
  const { product_id, quantity, price_per_unit, buyer_name, buyer_gstin, buyer_address, buyer_state, notes } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const taxable_amount = parseFloat((quantity * price_per_unit).toFixed(2));
    const gst_rate = product.gst_rate || 0;
    const gstCalc = calculateGST(taxable_amount, gst_rate, 'AUTO', shop.state, buyer_state);
    const total_amount = parseFloat((taxable_amount + gstCalc.total_gst).toFixed(2));
    const invoice_number = await generateInvoiceNumber(shop._id);

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
      notes,
    });

    // Reduce stock
    await Product.findByIdAndUpdate(product_id, { $inc: { quantity: -quantity } });
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    await Product.findByIdAndUpdate(sale.product, { $inc: { quantity: sale.quantity } }); // restore stock
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSales, createSale, deleteSale };