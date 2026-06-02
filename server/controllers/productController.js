const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const normalizeBarcode = (value = '') => String(value).replace(/\s+/g, '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { search, limit: limitParam, cursor } = req.query;

    const filter = { shop: shop._id, isActive: { $ne: false } };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { barcode: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (cursor) filter._id = { $gt: cursor };

    const pageSize = Math.min(Number(limitParam) || 500, 1000);
    const products = await Product.find(filter)
      .select('-stock_history')
      .sort({ name: 1 })
      .limit(pageSize + 1);

    const hasMore = products.length > pageSize;
    const page = hasMore ? products.slice(0, pageSize) : products;
    const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

    const result = page.map(p => ({
      ...p.toJSON(),
      margin: p.cost_price > 0
        ? parseFloat((((p.price - p.cost_price) / p.cost_price) * 100).toFixed(1))
        : null,
    }));

    res.json(result);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRODUCT
// ─────────────────────────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  const { name, description, price, cost_price, quantity, unit, hsn_code, gst_rate, low_stock_threshold, barcode } = req.body;
  try {
    if (!name) return res.status(400).json({ message: 'Product name is required' });

    const shop = await getShopOrFail(req.user.id);
    const qty = Number(quantity) || 0;
    const normalizedBarcode = normalizeBarcode(barcode);

    if (normalizedBarcode) {
      const existingBarcodeProduct = await Product.findOne({
        shop: shop._id,
        barcode: normalizedBarcode,
        isActive: { $ne: false },
      });
      if (existingBarcodeProduct) {
        return res.status(400).json({ message: 'This barcode is already used by another product' });
      }
    }

    // MRP validation for pharmacy (DPCO)
    if (shop.businessType === 'pharmacy' && req.body.metadata) {
      const mrp = req.body.metadata.mrp;
      if (mrp !== undefined && mrp !== null && mrp !== '') {
        const sellingPrice = Number(price);
        if (sellingPrice > Number(mrp)) {
          return res.status(400).json({
            message: `Selling price (₹${sellingPrice}) cannot exceed MRP (₹${mrp}). DPCO violation.`,
          });
        }
      }
    }

    const product = await Product.create({
      shop: shop._id,
      name: name.trim(),
      description,
      price: Number(price),
      cost_price: Number(cost_price) || 0,
      quantity: qty,
      unit: unit || 'pcs',
      barcode: normalizedBarcode,
      hsn_code: hsn_code || '',
      gst_rate: Number(gst_rate) || 0,
      low_stock_threshold: Number(low_stock_threshold) || 5,
      metadata: req.body.metadata || {},
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
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PRODUCT  (✅ shop ownership check added)
// ─────────────────────────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);

    // ✅ Security fix: verify product belongs to this shop
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { name, description, price, cost_price, unit, hsn_code, gst_rate, low_stock_threshold, barcode } = req.body;
    const normalizedBarcode = normalizeBarcode(barcode);

    if (normalizedBarcode) {
      const existingBarcodeProduct = await Product.findOne({
        shop: shop._id,
        barcode: normalizedBarcode,
        isActive: { $ne: false },
        _id: { $ne: product._id },
      });
      if (existingBarcodeProduct) {
        return res.status(400).json({ message: 'This barcode is already used by another product' });
      }
    }

    // MRP validation for pharmacy (DPCO)
    if (shop.businessType === 'pharmacy' && req.body.metadata) {
      const mrp = req.body.metadata.mrp;
      if (mrp !== undefined && mrp !== null && mrp !== '') {
        const sellingPrice = price !== undefined ? Number(price) : product.price;
        if (sellingPrice > Number(mrp)) {
          return res.status(400).json({
            message: `Selling price (₹${sellingPrice}) cannot exceed MRP (₹${mrp}). DPCO violation.`,
          });
        }
      }
    }

    // Note: quantity is NOT updated here — use /adjust-stock for that
    product.name = name?.trim() || product.name;
    product.description = description ?? product.description;
    product.price = price !== undefined ? Number(price) : product.price;
    product.cost_price = cost_price !== undefined ? Number(cost_price) : product.cost_price;
    product.unit = unit || product.unit;
    product.barcode = barcode !== undefined ? normalizedBarcode : product.barcode;
    product.hsn_code = hsn_code ?? product.hsn_code;
    product.gst_rate = gst_rate !== undefined ? Number(gst_rate) : product.gst_rate;
    product.low_stock_threshold = low_stock_threshold !== undefined ? Number(low_stock_threshold) : product.low_stock_threshold;
    if (req.body.metadata !== undefined) {
      product.metadata = req.body.metadata;
      product.markModified('metadata');
    }

    await product.save();

    res.json({
      ...product.toJSON(),
      margin: product.cost_price > 0
        ? parseFloat((((product.price - product.cost_price) / product.cost_price) * 100).toFixed(1))
        : null,
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PRODUCT  (✅ soft delete + ownership check)
// ─────────────────────────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);

    // ✅ Security fix: verify product belongs to this shop
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Soft delete — preserve sales/purchase history
    product.isActive = false;
    await product.save();

    res.json({ message: 'Product deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADJUST STOCK  (manual stock correction — logs history)
// ─────────────────────────────────────────────────────────────────────────────
const adjustStock = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { type, quantity, note } = req.body;
    // type: 'manual_add' | 'manual_remove' | 'adjustment'
    // quantity: always positive number

    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
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
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET STOCK HISTORY  (for a single product)
// ─────────────────────────────────────────────────────────────────────────────
const getStockHistory = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id })
      .select('name stock_history quantity unit');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json({
      product: { name: product.name, quantity: product.quantity, unit: product.unit },
      history: product.stock_history.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE AVAILABILITY (Restaurant — daily sold-out flag)
// ─────────────────────────────────────────────────────────────────────────────
const toggleAvailability = async (req, res) => {
  try {
    const { available, unavailable_reason } = req.body;
    const shop = await getShopOrFail(req.user.id);
    const product = await Product.findOne({ _id: req.params.id, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.metadata.set('is_available_today', available ? 'true' : 'false');
    product.metadata.set('unavailable_reason', unavailable_reason || '');
    product.metadata.set('availability_set_at', new Date().toISOString());
    await product.save();
    res.json({ message: 'Availability updated', available });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PRODUCT BY BARCODE (product-level or variant-level)
// ─────────────────────────────────────────────────────────────────────────────
const getByBarcode = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const barcode = normalizeBarcode(req.params.barcode);
    if (!barcode) return res.status(400).json({ message: 'Barcode required' });

    // 1. Product-level barcode (existing behavior)
    const byProduct = await Product.findOne({ shop: shop._id, barcode, isActive: { $ne: false } }).select('-stock_history');
    if (byProduct) {
      return res.json({ product: byProduct.toJSON(), variant: null, matchType: 'product' });
    }

    // 2. Variant-level barcode
    const variant = await ProductVariant.findOne({ shop: shop._id, barcode, isActive: true });
    if (!variant) return res.status(404).json({ message: 'Barcode not found' });

    const product = await Product.findOne({ _id: variant.product, shop: shop._id, isActive: { $ne: false } }).select('-stock_history');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    return res.json({ product: product.toJSON(), variant: variant.toJSON(), matchType: 'variant' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct, adjustStock, getStockHistory, toggleAvailability, getByBarcode };
