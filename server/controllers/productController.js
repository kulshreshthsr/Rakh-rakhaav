const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const StockMovement = require('../models/stockMovementModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');
const { logStockMovements } = require('../utils/stockMovementLogger');

const normalizeBarcode = (value = '') => String(value).replace(/\s+/g, '').trim();
const parseNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return Boolean(value);
};

const buildPriceWarnings = (productLike) => {
  const tiers = [
    ['mrp', parseNumber(productLike.mrp)],
    ['price', parseNumber(productLike.price)],
    ['dealer_price', parseNumber(productLike.dealer_price)],
    ['project_price', parseNumber(productLike.project_price)],
  ];
  const warnings = [];

  for (let index = 0; index < tiers.length - 1; index += 1) {
    const [currentKey, currentValue] = tiers[index];
    const [nextKey, nextValue] = tiers[index + 1];
    if (currentValue > 0 && nextValue > 0 && currentValue < nextValue) {
      warnings.push(`${currentKey} should be greater than or equal to ${nextKey}`);
    }
  }

  return warnings;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { search, limit: limitParam, cursor, category, sub_category } = req.query;

    const filter = { shop: shop._id, isActive: { $ne: false } };
    if (category)     filter.category     = category;
    if (sub_category) filter.sub_category = sub_category;
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
    logger.error('[productController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRODUCT
// ─────────────────────────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  const {
    name, description, price, mrp, dealer_price, project_price, cost_price, quantity, unit, hsn_code, gst_rate,
    low_stock_threshold, barcode, category = '', sub_category = '', sku, pack_size, pack_unit, loose_unit,
    sold_in_loose, loose_price, batch_tracking_enabled,
  } = req.body;
  try {
    if (!name) return res.status(400).json({ message: 'Product name is required' });

    const shop = await getShopOrFail(req.user.id);
    const qty = Number(quantity) || 0;
    const normalizedBarcode = normalizeBarcode(barcode);
    const warnings = buildPriceWarnings({ mrp, price, dealer_price, project_price });

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

    const product = await Product.create({
      shop: shop._id,
      name: name.trim(),
      description,
      price: Number(price),
      mrp: parseNumber(mrp),
      dealer_price: parseNumber(dealer_price),
      project_price: parseNumber(project_price),
      cost_price: Number(cost_price) || 0,
      quantity: qty,
      unit: unit || 'pcs',
      barcode: normalizedBarcode,
      sku: String(sku || '').trim(),
      hsn_code: hsn_code || '',
      gst_rate: Number(gst_rate) || 0,
      low_stock_threshold: Number(low_stock_threshold) || 5,
      category:     category || '',
      sub_category: sub_category || '',
      pack_size: parseNumber(pack_size, 1) || 1,
      pack_unit: String(pack_unit || '').trim(),
      loose_unit: String(loose_unit || '').trim(),
      sold_in_loose: parseBoolean(sold_in_loose),
      loose_price: parseNumber(loose_price),
      batch_tracking_enabled: parseBoolean(batch_tracking_enabled),
      metadata: req.body.metadata || {},
    });

    if (qty > 0) {
      await logStockMovements(shop._id, [{
        product: product._id,
        type: 'manual_add',
        quantityChange: qty,
        quantityAfter: qty,
        referenceId: '',
        referenceType: 'opening_stock',
        note: 'Opening stock',
        performedBy: req.user?.id,
      }]);
    }

    res.status(201).json({
      ...product.toJSON(),
      margin: product.cost_price > 0
        ? parseFloat((((product.price - product.cost_price) / product.cost_price) * 100).toFixed(1))
        : null,
      warnings,
    });
  } catch (err) {
    logger.error('[productController]', err.message || err);
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
    if (!product) return res.status(404).json({ message: 'Product नहीं मिला' });

    const {
      name, description, price, mrp, dealer_price, project_price, cost_price, unit, hsn_code, gst_rate,
      low_stock_threshold, barcode, category, sub_category, sku, pack_size, pack_unit, loose_unit,
      sold_in_loose, loose_price, batch_tracking_enabled,
    } = req.body;
    const normalizedBarcode = normalizeBarcode(barcode);
    const warnings = buildPriceWarnings({
      mrp: mrp !== undefined ? mrp : product.mrp,
      price: price !== undefined ? price : product.price,
      dealer_price: dealer_price !== undefined ? dealer_price : product.dealer_price,
      project_price: project_price !== undefined ? project_price : product.project_price,
    });

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

    // Note: quantity is NOT updated here — use /adjust-stock for that
    product.name = name?.trim() || product.name;
    product.description = description ?? product.description;
    product.price = price !== undefined ? Number(price) : product.price;
    if (mrp !== undefined) product.mrp = parseNumber(mrp);
    if (dealer_price !== undefined) product.dealer_price = parseNumber(dealer_price);
    if (project_price !== undefined) product.project_price = parseNumber(project_price);
    product.cost_price = cost_price !== undefined ? Number(cost_price) : product.cost_price;
    product.unit = unit || product.unit;
    product.barcode = barcode !== undefined ? normalizedBarcode : product.barcode;
    product.hsn_code = hsn_code ?? product.hsn_code;
    product.gst_rate = gst_rate !== undefined ? Number(gst_rate) : product.gst_rate;
    product.low_stock_threshold = low_stock_threshold !== undefined ? Number(low_stock_threshold) : product.low_stock_threshold;
    if (category     !== undefined) product.category     = category;
    if (sub_category !== undefined) product.sub_category = sub_category;
    if (sku !== undefined) product.sku = String(sku || '').trim();
    if (pack_size !== undefined) product.pack_size = parseNumber(pack_size, 1) || 1;
    if (pack_unit !== undefined) product.pack_unit = String(pack_unit || '').trim();
    if (loose_unit !== undefined) product.loose_unit = String(loose_unit || '').trim();
    if (sold_in_loose !== undefined) product.sold_in_loose = parseBoolean(sold_in_loose, product.sold_in_loose);
    if (loose_price !== undefined) product.loose_price = parseNumber(loose_price);
    if (batch_tracking_enabled !== undefined) product.batch_tracking_enabled = parseBoolean(batch_tracking_enabled, product.batch_tracking_enabled);
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
      warnings,
    });
  } catch (err) {
    logger.error('[productController]', err.message || err);
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
    if (!product) return res.status(404).json({ message: 'Product नहीं मिला' });

    // Soft delete — preserve sales/purchase history
    product.isActive = false;
    await product.save();

    res.json({ message: 'Product deleted' });
  } catch (err) {
    logger.error('[productController]', err.message || err);
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
    if (!product) return res.status(404).json({ message: 'Product नहीं मिला' });

    const qty = Number(quantity);
    const change = type === 'manual_remove' ? -qty : qty;
    const newQty = product.quantity + change;

    if (newQty < 0) {
      return res.status(400).json({ message: 'Stock cannot go below 0' });
    }

    product.quantity = newQty;
    await product.save();

    await logStockMovements(shop._id, [{
      product:        product._id,
      type:           type || 'adjustment',
      quantityChange: change,
      quantityAfter:  newQty,
      referenceId:    '',
      referenceType:  'manual',
      note:           note || (type === 'manual_add' ? 'Manual stock added' : type === 'manual_remove' ? 'Manual stock removed' : 'Stock adjustment'),
      performedBy:    req.user?.id,
    }]);

    res.json({
      message: 'Stock updated',
      quantity: product.quantity,
      is_low_stock: product.quantity <= product.low_stock_threshold,
    });
  } catch (err) {
    logger.error('[productController]', err.message || err);
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
      .select('name quantity unit');
    if (!product) return res.status(404).json({ message: 'Product नहीं मिला' });

    const { before, limit: limitParam } = req.query;
    const filter = { product: product._id, shop: shop._id };
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      filter.date = { $lt: beforeDate };
    }
    const pageSize = Math.min(Number(limitParam) || 100, 500);
    const movements = await StockMovement.find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(pageSize + 1)
      .lean();
    const hasMore = movements.length > pageSize;
    const history = hasMore ? movements.slice(0, pageSize) : movements;

    res.json({
      product: { name: product.name, quantity: product.quantity, unit: product.unit },
      history,
      hasMore,
      next_before: hasMore && history.length ? history[history.length - 1].date : null,
    });
  } catch (err) {
    logger.error('[productController]', err.message || err);
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
    const byProduct = await Product.findOne({ shop: shop._id, barcode, isActive: { $ne: false } });
    if (byProduct) {
      return res.json({ product: byProduct.toJSON(), variant: null, matchType: 'product' });
    }

    // 2. Variant-level barcode
    const variant = await ProductVariant.findOne({ shop: shop._id, barcode, isActive: true });
    if (!variant) return res.status(404).json({ message: 'Barcode not found' });

    const product = await Product.findOne({ _id: variant.product, shop: shop._id, isActive: { $ne: false } });
    if (!product) return res.status(404).json({ message: 'Product नहीं मिला' });

    return res.json({ product: product.toJSON(), variant: variant.toJSON(), matchType: 'variant' });
  } catch (err) {
    logger.error('[productController]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// Column name aliases for flexible header matching
const COL = (row, ...keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
};

function normalizeRow(raw) {
  return {
    name:                String(COL(raw, 'name', 'Name', 'ITEM NAME', 'PRODUCT NAME', 'Item Name') || '').trim(),
    description:         String(COL(raw, 'description', 'Description', 'DESC') || '').trim(),
    price:               Number(COL(raw, 'price', 'Price', 'Selling Price', 'RATE', 'MRP', 'Rate') || 0),
    mrp:                 Number(COL(raw, 'mrp', 'MRP', 'Maximum Retail Price') || 0),
    dealer_price:        Number(COL(raw, 'dealer_price', 'Dealer Price', 'DEALER PRICE') || 0),
    project_price:       Number(COL(raw, 'project_price', 'Project Price', 'PROJECT PRICE') || 0),
    cost_price:          Number(COL(raw, 'cost_price', 'Cost Price', 'COST', 'Purchase Price') || 0),
    quantity:            Number(COL(raw, 'quantity', 'Quantity', 'QTY', 'Stock') || 0),
    unit:                String(COL(raw, 'unit', 'Unit', 'UNIT') || 'pcs').trim(),
    barcode:             normalizeBarcode(String(COL(raw, 'barcode', 'Barcode', 'BARCODE') || '')),
    hsn_code:            String(COL(raw, 'hsn_code', 'hsn', 'HSN', 'HSN Code', 'HSN CODE') || '').trim(),
    gst_rate:            Number(COL(raw, 'gst_rate', 'gst', 'GST', 'GST %', 'GST%', 'Tax Rate') || 0),
    low_stock_threshold: Number(COL(raw, 'low_stock_threshold', 'Min Stock', 'MIN STOCK', 'Reorder Level') || 5),
    category:            String(COL(raw, 'category', 'Category', 'CATEGORY') || '').trim(),
    brand:               String(COL(raw, 'brand', 'Brand', 'BRAND') || '').trim(),
  };
}

function parseFileToRows(file) {
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = require('xlsx');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }
  // CSV fallback
  const text = file.buffer.toString('utf-8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
}

const bulkImportProducts = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const isPreview = req.query.preview === 'true';

    let rawRows;

    // Multipart file upload (multer puts file in req.file)
    if (req.file) {
      rawRows = parseFileToRows(req.file);
    } else {
      // JSON fallback (legacy)
      rawRows = req.body.products;
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        return res.status(400).json({ message: 'File or products array is required' });
      }
    }

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ message: 'File is empty or has no valid rows' });
    }
    if (rawRows.length > 1000) {
      return res.status(400).json({ message: 'Maximum 1000 products per import' });
    }

    const rows = rawRows.map(normalizeRow).filter(r => r.name);

    if (isPreview) {
      return res.json({ preview: rows.slice(0, 5), total: rows.length });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        if (row.barcode) {
          const exists = await Product.findOne({ shop: shop._id, barcode: row.barcode, isActive: { $ne: false } });
          if (exists) { results.skipped++; continue; }
        }
        await Product.create({ shop: shop._id, ...row });
        results.created++;
      } catch (rowErr) {
        results.errors.push({ row: row.name, error: rowErr.message });
      }
    }

    res.status(201).json(results);
  } catch (err) {
    logger.error('[bulkImportProducts]', err.message || err);
    res.status(500).json({ message: 'Import failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REORDER SUGGESTIONS  GET /api/products/reorder-suggestions
// ─────────────────────────────────────────────────────────────────────────────
const getReorderSuggestions = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const products = await Product.find({
      shop: shop._id,
      isActive: { $ne: false },
      $expr: { $lte: ['$quantity', '$low_stock_threshold'] },
    })
      .select('name quantity low_stock_threshold unit category sub_category')
      .sort({ quantity: 1 })
      .limit(50);
    res.json(products);
  } catch (err) {
    logger.error('[getReorderSuggestions]', err.message || err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct, adjustStock, getStockHistory, getByBarcode, bulkImportProducts, getReorderSuggestions };
