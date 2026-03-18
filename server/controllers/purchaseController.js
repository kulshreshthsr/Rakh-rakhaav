const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Shop = require('../models/shopModel');
const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');

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
    return {
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: parseFloat(gst.toFixed(2)),
      total_gst: parseFloat(gst.toFixed(2)),
      gst_type: 'IGST'
    };
  } else {
    const half = parseFloat((gst / 2).toFixed(2));
    return {
      cgst_amount: half,
      sgst_amount: half,
      igst_amount: 0,
      total_gst: parseFloat(gst.toFixed(2)),
      gst_type: 'CGST_SGST'
    };
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
      invoice_type: p.invoice_type,
      payment_type: p.payment_type,
      taxable_amount: p.taxable_amount,
      cgst_amount: p.cgst_amount,
      sgst_amount: p.sgst_amount,
      igst_amount: p.igst_amount,
      total_gst: p.total_gst,
      total_amount: p.total_amount,
      supplier_name: p.supplier_name,
      supplier_phone: p.supplier_phone,
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
  const {
    product_id, quantity, price_per_unit,
    supplier_name, supplier_phone, supplier_gstin,
    supplier_address, supplier_state,
    notes, payment_type = 'cash'
  } = req.body;

  try {
    const shop = await getOrCreateShop(req.user.id);
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // ✅ Credit purchase requires supplier name
    if (payment_type === 'credit' && !supplier_name) {
      return res.status(400).json({ message: 'Credit purchase ke liye supplier ka naam zaroori hai!' });
    }

    // ✅ B2B if GSTIN, B2C otherwise
    const invoice_type = (supplier_gstin && supplier_gstin.trim() !== '') ? 'B2B' : 'B2C';

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
      supplier_name: supplier_name || '',
      supplier_phone,
      supplier_gstin,
      supplier_address,
      invoice_number,
      invoice_type,
      payment_type,
      notes,
    });

    // ✅ Stock increase
    await Product.findByIdAndUpdate(product_id, { $inc: { quantity: parseInt(quantity) } });

    // ✅ Credit purchase — auto create/update supplier + udhaar entry
    if (payment_type === 'credit' && supplier_name) {
      let supplier = await Supplier.findOne({
        shop: shop._id,
        $or: [
          { name: { $regex: new RegExp(`^${supplier_name}$`, 'i') } },
          ...(supplier_phone ? [{ phone: supplier_phone }] : [])
        ]
      });

      if (!supplier) {
        supplier = await Supplier.create({
          shop: shop._id,
          name: supplier_name,
          phone: supplier_phone || '',
          gstin: supplier_gstin || '',
          address: supplier_address || '',
          totalUdhaar: 0,
        });
      }

      await SupplierUdhaar.create({
        shop: shop._id,
        supplier: supplier._id,
        type: 'debit',
        amount: total_amount,
        note: `Credit Purchase — ${product.name} (${invoice_number})`,
        date: new Date(),
        reference_id: invoice_number,
        reference_type: 'purchase',
      });

      await Supplier.findByIdAndUpdate(supplier._id, {
        $inc: { totalUdhaar: total_amount }
      });
    }

    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    // ✅ Stock reverse
    await Product.findByIdAndUpdate(purchase.product, { $inc: { quantity: -purchase.quantity } });

    // ✅ Credit purchase reverse
    if (purchase.payment_type === 'credit' && purchase.supplier_name) {
      const supplier = await Supplier.findOne({
        shop: purchase.shop,
        name: { $regex: new RegExp(`^${purchase.supplier_name}$`, 'i') }
      });
      if (supplier) {
        await Supplier.findByIdAndUpdate(supplier._id, { $inc: { totalUdhaar: -purchase.total_amount } });
        await SupplierUdhaar.deleteOne({ reference_id: purchase.invoice_number, reference_type: 'purchase' });
      }
    }

    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPurchases, createPurchase, deletePurchase };