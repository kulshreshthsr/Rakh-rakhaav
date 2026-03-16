const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');

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
  return `BILL-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

const calculateGST = (taxable_amount, gst_rate, shopState, supplierState) => {
  const gst = (taxable_amount * gst_rate) / 100;
  const isIGST = supplierState && shopState && shopState !== supplierState;

  if (isIGST) {
    return { cgst_amount: 0, sgst_amount: 0, igst_amount: parseFloat(gst.toFixed(2)), total_gst: parseFloat(gst.toFixed(2)), gst_type: 'IGST' };
  } else {
    const half = parseFloat((gst / 2).toFixed(2));
    return { cgst_amount: half, sgst_amount: half, igst_amount: 0, total_gst: parseFloat(gst.toFixed(2)), gst_type: 'CGST_SGST' };
  }
};

const getPurchases = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const purchases = await Purchase.find({ shop: shop._id }).sort({ createdAt: -1 });
    const result = purchases.map(p => ({
      _id: p._id,
      product_name: p.product_name,
      hsn_code: p.hsn_code,
      quantity: p.quantity,
      price_per_unit: p.price_per_unit,
      gst_rate: p.gst_rate,
      gst_type: p.gst_type,
      taxable_amount: p.taxable_amount,
      cgst_amount: p.cgst_amount,
      sgst_amount: p.sgst_amount,
      igst_amount: p.igst_amount,
      total_gst: p.total_gst,
      total_amount: p.total_amount,
      supplier_name: p.supplier_name,
      supplier_gstin: p.supplier_gstin,
      supplier_address: p.supplier_address,
      invoice_number: p.invoice_number,
      notes: p.notes,
      purchased_at: p.createdAt,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createPurchase = async (req, res) => {
  const { product_id, quantity, price_per_unit, supplier_name, supplier_gstin, supplier_address, supplier_state, notes } = req.body;
  try {
    const shop = await getOrCreateShop(req.user.id);
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const taxable_amount = parseFloat((quantity * price_per_unit).toFixed(2));
    const gst_rate = product.gst_rate || 0;
    const gstCalc = calculateGST(taxable_amount, gst_rate, shop.state, supplier_state);
    const total_amount = parseFloat((taxable_amount + gstCalc.total_gst).toFixed(2));
    const invoice_number = await generateBillNumber(shop._id);

    const purchase = await Purchase.create({
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
      supplier_name,
      supplier_gstin,
      supplier_address,
      invoice_number,
      notes,
    });

    // Increase stock
    await Product.findByIdAndUpdate(product_id, { $inc: { quantity: quantity } });
    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    await Product.findByIdAndUpdate(purchase.product, { $inc: { quantity: -purchase.quantity } }); // restore stock
    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPurchases, createPurchase, deletePurchase };