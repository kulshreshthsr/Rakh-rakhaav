const Product = require('../models/productModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const products = await Product.find({ shop: shop._id, isActive: { $ne: false } })
      .select('-stock_history') // don't send history in list — heavy
      .sort({ name: 1 });

    // Add computed fields for frontend
    const result = products.map(p => ({
      ...p.toJSON(),
      margin: p.cost_price > 0
        ? parseFloat((((p.price - p.cost_price) / p.cost_price) * 100).toFixed(1))
        : null,
      is_low_stock: p.quantity <= p.low_stock_threshold,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRODUCT
// ─────────────────────────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  const { name, description, price, cost_price, quantity, unit, hsn_code, gst_rate, low_stock_threshold } = req.body;
  try {
    if (!name) return res.status(400).json({ message: 'Product name is required' });

    const shop = await getOrCreateShop(req.user.id);
    const qty = Number(quantity) || 0;

    const product = await Product.create({
      shop: shop._id,
      name: name.trim(),
      description,
      price: Number(price),
      cost_price: Number(cost_price) || 0,
      quantity: qty,
      unit: unit || 'pcs',
      hsn_code: hsn_code || '',
      gst_rate: Number(gst_rate) || 0,
      low_stock_threshold: Number(low_stock_threshold) || 5,
      // Log initial stock
      stock_history: qty > 0 ? [{
        type: 'manual_add',
        quantity_change: qty,
        quantity_after: qty,
        note: 'Opening stock',
        date: new Date(),
      }] : [],
    });

    res.status(201).json({
      ...product.toJSON(),
      margin: product.cost_price > 0
        ? parseFloat((((product.price - product.cost_price) / product.cost_price) * 100).toFixed(1))
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PRODUCT  (✅ shop ownership check added)
// ─────────────────────────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);

    // ✅ Security fix: verify product belongs to this shop
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { name, description, price, cost_price, unit, hsn_code, gst_rate, low_stock_threshold } = req.body;

    // Note: quantity is NOT updated here — use /adjust-stock for that
    product.name = name?.trim() || product.name;
    product.description = description ?? product.description;
    product.price = price !== undefined ? Number(price) : product.price;
    product.cost_price = cost_price !== undefined ? Number(cost_price) : product.cost_price;
    product.unit = unit || product.unit;
    product.hsn_code = hsn_code ?? product.hsn_code;
    product.gst_rate = gst_rate !== undefined ? Number(gst_rate) : product.gst_rate;
    product.low_stock_threshold = low_stock_threshold !== undefined ? Number(low_stock_threshold) : product.low_stock_threshold;

    await product.save();

    res.json({
      ...product.toJSON(),
      margin: product.cost_price > 0
        ? parseFloat((((product.price - product.cost_price) / product.cost_price) * 100).toFixed(1))
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PRODUCT  (✅ soft delete + ownership check)
// ─────────────────────────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);

    // ✅ Security fix: verify product belongs to this shop
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Soft delete — preserve sales/purchase history
    product.isActive = false;
    await product.save();

    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADJUST STOCK  (manual stock correction — logs history)
// ─────────────────────────────────────────────────────────────────────────────
const adjustStock = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { type, quantity, note } = req.body;
    // type: 'manual_add' | 'manual_remove' | 'adjustment'
    // quantity: always positive number

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantity must be positive' });
    }

    const product = await Product.findOne({ _id: req.params.id, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const qty = Number(quantity);
    const change = type === 'manual_remove' ? -qty : qty;
    const newQty = product.quantity + change;

    if (newQty < 0) {
      return res.status(400).json({ message: 'Stock cannot go below 0' });
    }

    product.quantity = newQty;
    product.stock_history.push({
      type: type || 'adjustment',
      quantity_change: change,
      quantity_after: newQty,
      note: note || (type === 'manual_add' ? 'Manual stock added' : type === 'manual_remove' ? 'Manual stock removed' : 'Stock adjustment'),
      date: new Date(),
    });

    await product.save();
    res.json({
      message: 'Stock updated',
      quantity: product.quantity,
      is_low_stock: product.quantity <= product.low_stock_threshold,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET STOCK HISTORY  (for a single product)
// ─────────────────────────────────────────────────────────────────────────────
const getStockHistory = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id })
      .select('name stock_history quantity unit');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json({
      product: { name: product.name, quantity: product.quantity, unit: product.unit },
      history: product.stock_history.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct, adjustStock, getStockHistory };