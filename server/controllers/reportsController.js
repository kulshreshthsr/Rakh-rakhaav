/**
 * Reports Controller
 * GET /api/reports/stock-valuation
 * GET /api/reports/stock-aging
 */

const Product = require('../models/productModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const round2 = (v) => parseFloat(Number(v || 0).toFixed(2));

// ── STOCK VALUATION ───────────────────────────────────────────────────────────
// Returns every active product with WAC-based stock value.

const getStockValuation = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { category } = req.query;

    const filter = { shop: shop._id, isActive: true, quantity: { $gt: 0 } };
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .select('name sku unit category quantity cost_price weighted_avg_cost price')
      .sort({ category: 1, name: 1 })
      .lean();

    let total_inventory_value = 0;
    let low_stock_count = 0;

    const rows = products.map((p) => {
      const wac = p.weighted_avg_cost > 0 ? p.weighted_avg_cost : p.cost_price || 0;
      const stock_value = round2(p.quantity * wac);
      total_inventory_value += stock_value;
      if (p.quantity <= (p.low_stock_threshold || 5)) low_stock_count++;
      return {
        _id:               p._id,
        name:              p.name,
        sku:               p.sku || '',
        unit:              p.unit || 'pcs',
        category:          p.category || '',
        quantity:          p.quantity,
        cost_price:        p.cost_price || 0,
        weighted_avg_cost: wac,
        stock_value,
        selling_price:     p.price || 0,
        potential_revenue: round2(p.quantity * (p.price || 0)),
      };
    });

    return res.json({
      products: rows,
      summary: {
        total_inventory_value: round2(total_inventory_value),
        total_skus:    rows.length,
        low_stock_count,
        generated_at:  new Date(),
      },
    });
  } catch (err) {
    logger.error('[reportsController:getStockValuation]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── STOCK AGING ───────────────────────────────────────────────────────────────
// Buckets every product by days since last sale.

const AGING_BUCKETS = [
  { id: 'fresh',  label: 'Fresh (0-30d)',   minDays: 0,   maxDays: 30  },
  { id: 'slow',   label: 'Slow (31-60d)',   minDays: 31,  maxDays: 60  },
  { id: 'aging',  label: 'Aging (61-90d)',  minDays: 61,  maxDays: 90  },
  { id: 'dead',   label: 'Dead (90d+)',     minDays: 91,  maxDays: Infinity },
];

function getBucket(lastSaleDate) {
  if (!lastSaleDate) return 'dead';
  const days = Math.floor((Date.now() - new Date(lastSaleDate)) / 86400000);
  if (days <= 30)  return 'fresh';
  if (days <= 60)  return 'slow';
  if (days <= 90)  return 'aging';
  return 'dead';
}

const getStockAging = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { warehouse, category, bucket } = req.query;

    const filter = { shop: shop._id, isActive: true, quantity: { $gt: 0 } };
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .select('name sku unit category quantity cost_price weighted_avg_cost price metadata low_stock_threshold')
      .lean();

    const now = Date.now();
    const rows = products.map((p) => {
      const lastSaleDate = p.metadata?.last_sale_date || null;
      const days_since_last_sale = lastSaleDate
        ? Math.floor((now - new Date(lastSaleDate)) / 86400000)
        : null;
      const aging_bucket = getBucket(lastSaleDate);
      const wac = p.weighted_avg_cost > 0 ? p.weighted_avg_cost : (p.cost_price || 0);
      return {
        _id:                p._id,
        name:               p.name,
        sku:                p.sku || '',
        unit:               p.unit || 'pcs',
        category:           p.category || '',
        quantity:           p.quantity,
        stock_value:        round2(p.quantity * wac),
        weighted_avg_cost:  wac,
        last_sale_date:     lastSaleDate,
        days_since_last_sale,
        aging_bucket,
      };
    }).filter((r) => !bucket || r.aging_bucket === bucket);

    // Sort: dead first, then by days desc
    rows.sort((a, b) => {
      const order = { dead: 0, aging: 1, slow: 2, fresh: 3 };
      if (order[a.aging_bucket] !== order[b.aging_bucket])
        return order[a.aging_bucket] - order[b.aging_bucket];
      return (b.days_since_last_sale || 999) - (a.days_since_last_sale || 999);
    });

    // Bucket summary
    const summary = {};
    for (const b of AGING_BUCKETS) {
      const inBucket = rows.filter(r => r.aging_bucket === b.id);
      summary[b.id] = {
        label:       b.label,
        count:       inBucket.length,
        total_value: round2(inBucket.reduce((s, r) => s + r.stock_value, 0)),
      };
    }

    return res.json({
      products: rows,
      summary,
      generated_at: new Date(),
    });
  } catch (err) {
    logger.error('[reportsController:getStockAging]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── STOCK VALUATION CSV EXPORT ────────────────────────────────────────────────
const exportStockValuationCsv = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { category } = req.query;

    const filter = { shop: shop._id, isActive: true, quantity: { $gt: 0 } };
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .select('name sku unit category quantity cost_price weighted_avg_cost price')
      .sort({ category: 1, name: 1 })
      .lean();

    const header = ['Name', 'SKU', 'Category', 'Unit', 'Qty', 'WAC (Cost)', 'Stock Value', 'Selling Price', 'Potential Revenue'];
    const rows = products.map((p) => {
      const wac        = p.weighted_avg_cost > 0 ? p.weighted_avg_cost : (p.cost_price || 0);
      const stockValue = round2(p.quantity * wac);
      const potRevenue = round2(p.quantity * (p.price || 0));
      return [p.name, p.sku || '', p.category || '', p.unit || 'pcs', p.quantity, wac, stockValue, p.price || 0, potRevenue];
    });

    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');
    const filename = `Stock_Valuation_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('﻿' + csv); // BOM for Excel UTF-8 detection
  } catch (err) {
    logger.error('[reportsController:exportStockValuationCsv]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { getStockValuation, getStockAging, exportStockValuationCsv };
