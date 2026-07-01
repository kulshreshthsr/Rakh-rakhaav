'use strict';

const Product = require('../models/productModel');
const Warehouse = require('../models/warehouseModel');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Resolve which warehouse a stock movement should apply to.
 *
 * - An explicit warehouseId wins if the caller provides one (e.g. the
 *   frontend lets a multi-location shop pick a godown on the sale/purchase
 *   form, matching Vyapar/myBillBook's per-transaction godown selection).
 * - Otherwise falls back to the shop's default warehouse.
 * - If the shop has never created a warehouse at all (the common case —
 *   single-location hardware/electronics shops, which is most of this
 *   product's target market), lazily auto-provisions a "Main Store"
 *   warehouse marked is_default. This means single-location shops never
 *   have to think about warehouses at all — stock still always lives
 *   somewhere, so stock_locations and the flat `quantity` mirror can never
 *   drift apart, regardless of whether the shop opts into multi-location
 *   features.
 */
async function resolveWarehouseId(shopId, explicitWarehouseId, session) {
  if (explicitWarehouseId) return explicitWarehouseId;

  let query = Warehouse.findOne({ shop: shopId, is_default: true, is_active: true });
  if (session) query = query.session(session);
  const existing = await query;
  if (existing) return existing._id;

  const [created] = await Warehouse.create(
    [{ shop: shopId, name: 'Main Store', is_default: true, is_active: true }],
    { session }
  );
  return created._id;
}

/**
 * Apply a stock delta to a product at a specific (or default) warehouse,
 * keeping product.quantity as an always-correct derived mirror of
 * sum(stock_locations[].quantity).
 *
 * This is the SINGLE place stock should ever be mutated from. Previously,
 * sales/purchases/returns wrote directly to product.quantity via
 * `$inc: { quantity: n }`, completely bypassing stock_locations — meaning
 * the moment a shop created a warehouse and did one transfer, the two
 * fields permanently diverged and product.total_quantity (which prefers
 * stock_locations once populated) silently stopped reflecting real sales
 * activity. See README for the full writeup of that bug.
 *
 * Every controller that changes stock (sales, purchases, returns, manual
 * adjustments) should route through this function instead of touching
 * product.quantity or product.stock_locations directly.
 *
 * @param {string} shopId
 * @param {string} productId
 * @param {number} delta - positive to add stock, negative to remove
 * @param {object} [opts]
 * @param {string} [opts.warehouseId] - explicit location; defaults to the shop's default warehouse
 * @param {object} [opts.session] - mongoose session, required inside a transaction
 * @param {boolean} [opts.allowNegative=false] - if false, throws rather than letting a location go below 0
 * @returns {Promise<{ quantityAfter: number, warehouseId: string, product: object }>}
 */
async function adjustStock(shopId, productId, delta, opts = {}) {
  const { warehouseId: explicitWarehouseId, session, allowNegative = false } = opts;
  const resolvedWarehouseId = await resolveWarehouseId(shopId, explicitWarehouseId, session);

  let productQuery = Product.findOne({ _id: productId, shop: shopId });
  if (session) productQuery = productQuery.session(session);
  const product = await productQuery;
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });

  if (!Array.isArray(product.stock_locations)) product.stock_locations = [];
  let loc = product.stock_locations.find((l) => String(l.warehouse) === String(resolvedWarehouseId));

  if (!loc) {
    let warehouseQuery = Warehouse.findById(resolvedWarehouseId);
    if (session) warehouseQuery = warehouseQuery.session(session);
    const warehouse = await warehouseQuery;
    loc = { warehouse: resolvedWarehouseId, warehouse_name: warehouse ? warehouse.name : '', quantity: 0 };
    product.stock_locations.push(loc);
  }

  const newLocQty = round2((loc.quantity || 0) + delta);
  if (!allowNegative && newLocQty < 0) {
    throw Object.assign(
      new Error(
        `Insufficient stock for "${product.name}"${loc.warehouse_name ? ` at ${loc.warehouse_name}` : ''}: have ${loc.quantity || 0}, need ${Math.abs(delta)}`
      ),
      { status: 400 }
    );
  }
  loc.quantity = newLocQty;

  // Keep the flat `quantity` field as an always-correct mirror. It still
  // exists for cheap reads (indexes, the is_low_stock/is_out_of_stock
  // virtuals, older report queries) but must never be written anywhere
  // else independently of this function.
  product.quantity = round2(
    product.stock_locations.reduce((s, l) => s + (l.quantity || 0), 0)
  );
  product.markModified('stock_locations');
  await product.save({ session });

  return { quantityAfter: product.quantity, warehouseId: resolvedWarehouseId, product };
}

module.exports = { adjustStock, resolveWarehouseId };