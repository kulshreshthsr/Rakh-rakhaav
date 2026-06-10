const mongoose = require('mongoose');
const Warehouse     = require('../models/warehouseModel');
const StockTransfer = require('../models/stockTransferModel');
const Product       = require('../models/productModel');
const DocumentSequence = require('../models/documentSequenceModel');
const { getShopOrFail } = require('../utils/shopGuard');
const logger = require('../utils/logger');

const round2 = (v) => parseFloat(Number(v || 0).toFixed(2));

const getFinancialYear = (date = new Date()) => {
  const year  = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const generateTransferNumber = async (shopId) => {
  const fy  = getFinancialYear();
  const seq = await DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'stock_transfer', financial_year: fy },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `TRF/${fy}/${String(seq.last_number).padStart(4, '0')}`;
};

// ── CREATE WAREHOUSE ──────────────────────────────────────────────────────────

const createWarehouse = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { name, code, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Warehouse name is required' });

    const existing = await Warehouse.countDocuments({ shop: shop._id, is_active: true });
    const isFirst  = existing === 0;

    const warehouse = await Warehouse.create({
      shop:       shop._id,
      name:       name.trim(),
      code:       (code || '').trim().toUpperCase(),
      address:    address || '',
      is_default: isFirst,
    });

    return res.status(201).json(warehouse);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'A warehouse with that name already exists' });
    logger.error('[warehouseController:createWarehouse]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── LIST WAREHOUSES ───────────────────────────────────────────────────────────

const getWarehouses = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const warehouses = await Warehouse.find({ shop: shop._id, is_active: true })
      .sort({ is_default: -1, name: 1 })
      .lean();

    // Count products and sum qty per warehouse
    const warehouseIds = warehouses.map((w) => w._id);
    const stockAgg = await Product.aggregate([
      { $match: { shop: new mongoose.Types.ObjectId(shop._id), isActive: true, 'stock_locations.0': { $exists: true } } },
      { $unwind: '$stock_locations' },
      { $match: { 'stock_locations.warehouse': { $in: warehouseIds } } },
      { $group: {
        _id:              '$stock_locations.warehouse',
        product_count:    { $addToSet: '$_id' },
        total_units:      { $sum: '$stock_locations.quantity' },
      }},
    ]);
    const stockMap = {};
    for (const s of stockAgg) {
      stockMap[String(s._id)] = {
        product_count: s.product_count.length,
        total_units:   round2(s.total_units),
      };
    }

    return res.json(warehouses.map((w) => ({
      ...w,
      ...(stockMap[String(w._id)] || { product_count: 0, total_units: 0 }),
    })));
  } catch (err) {
    logger.error('[warehouseController:getWarehouses]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── UPDATE WAREHOUSE ──────────────────────────────────────────────────────────

const updateWarehouse = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const warehouse = await Warehouse.findOne({ _id: req.params.id, shop: shop._id });
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

    const { name, code, address, is_default } = req.body;
    if (name !== undefined)       warehouse.name    = name.trim();
    if (code !== undefined)       warehouse.code    = code.trim().toUpperCase();
    if (address !== undefined)    warehouse.address = address;

    if (is_default === true && !warehouse.is_default) {
      await Warehouse.updateMany({ shop: shop._id }, { $set: { is_default: false } });
      warehouse.is_default = true;
    }

    await warehouse.save();
    return res.json(warehouse);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'A warehouse with that name already exists' });
    logger.error('[warehouseController:updateWarehouse]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── DEACTIVATE ────────────────────────────────────────────────────────────────

const deactivateWarehouse = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const warehouse = await Warehouse.findOne({ _id: req.params.id, shop: shop._id });
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    if (warehouse.is_default) return res.status(400).json({ message: 'Cannot deactivate the default warehouse. Set another as default first.' });

    warehouse.is_active = false;
    await warehouse.save();
    return res.json({ message: 'Warehouse deactivated' });
  } catch (err) {
    logger.error('[warehouseController:deactivateWarehouse]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── GET STOCK FOR ONE WAREHOUSE ───────────────────────────────────────────────

const getWarehouseStock = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const warehouse = await Warehouse.findOne({ _id: req.params.id, shop: shop._id, is_active: true }).lean();
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

    const wId = new mongoose.Types.ObjectId(warehouse._id);
    const products = await Product.aggregate([
      { $match: { shop: new mongoose.Types.ObjectId(shop._id), isActive: true, 'stock_locations.warehouse': wId } },
      { $project: {
        name: 1, sku: 1, unit: 1, category: 1,
        location: {
          $arrayElemAt: [
            { $filter: { input: '$stock_locations', as: 'loc', cond: { $eq: ['$$loc.warehouse', wId] } } },
            0,
          ],
        },
      }},
      { $project: { name: 1, sku: 1, unit: 1, category: 1, quantity: '$location.quantity' } },
      { $sort: { name: 1 } },
    ]);

    return res.json({ warehouse, products });
  } catch (err) {
    logger.error('[warehouseController:getWarehouseStock]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CREATE TRANSFER ───────────────────────────────────────────────────────────

const createTransfer = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { from_warehouse, to_warehouse, items, notes } = req.body;

    if (!from_warehouse || !to_warehouse) return res.status(400).json({ message: 'from_warehouse and to_warehouse are required' });
    if (String(from_warehouse) === String(to_warehouse)) return res.status(400).json({ message: 'Source and destination cannot be the same' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const [fromW, toW] = await Promise.all([
      Warehouse.findOne({ _id: from_warehouse, shop: shop._id, is_active: true }).lean(),
      Warehouse.findOne({ _id: to_warehouse,   shop: shop._id, is_active: true }).lean(),
    ]);
    if (!fromW) return res.status(404).json({ message: 'Source warehouse not found' });
    if (!toW)   return res.status(404).json({ message: 'Destination warehouse not found' });

    const productIds = items.map((i) => i.product);
    const products   = await Product.find({ _id: { $in: productIds }, shop: shop._id }).lean();
    const productMap = {};
    for (const p of products) productMap[String(p._id)] = p;

    const resolvedItems = [];
    for (const item of items) {
      const product = productMap[String(item.product)];
      if (!product) return res.status(404).json({ message: `Product not found: ${item.product}` });

      const loc = (product.stock_locations || []).find((l) => String(l.warehouse) === String(from_warehouse));
      const available = loc ? loc.quantity : 0;
      if (available < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for "${product.name}": available ${available}, requested ${item.quantity}` });
      }

      resolvedItems.push({
        product:      product._id,
        product_name: product.name,
        quantity:     Number(item.quantity),
        unit:         product.unit || 'pcs',
        cost_price:   product.cost_price || 0,
      });
    }

    const transferNumber = await generateTransferNumber(shop._id);
    const transfer = await StockTransfer.create({
      shop: shop._id,
      transfer_number: transferNumber,
      from_warehouse, to_warehouse,
      items: resolvedItems,
      notes: notes || '',
      status: 'draft',
    });

    return res.status(201).json(transfer);
  } catch (err) {
    logger.error('[warehouseController:createTransfer]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── LIST TRANSFERS ────────────────────────────────────────────────────────────

const getTransfers = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const { status, warehouse, cursor, limit: limitParam } = req.query;

    const filter = { shop: shop._id };
    if (status) filter.status = status;
    if (warehouse) filter.$or = [{ from_warehouse: warehouse }, { to_warehouse: warehouse }];
    if (cursor) filter._id = { $lt: cursor };

    const pageSize = Math.min(Number(limitParam) || 50, 200);
    const transfers = await StockTransfer.find(filter)
      .populate('from_warehouse', 'name code')
      .populate('to_warehouse', 'name code')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = transfers.length > pageSize;
    const page = hasMore ? transfers.slice(0, pageSize) : transfers;
    return res.json({ transfers: page, hasMore, nextCursor: hasMore ? String(page[page.length - 1]._id) : null });
  } catch (err) {
    logger.error('[warehouseController:getTransfers]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ── CONFIRM TRANSFER ──────────────────────────────────────────────────────────

const confirmTransfer = async (req, res) => {
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const shop = await getShopOrFail(req.user.id);
      const transfer = await StockTransfer.findOne({ _id: req.params.id, shop: shop._id }).session(mongoSession);
      if (!transfer) throw Object.assign(new Error('Transfer not found'), { status: 404 });
      if (transfer.status !== 'draft') throw Object.assign(new Error(`Transfer is already ${transfer.status}`), { status: 400 });

      for (const item of transfer.items) {
        const product = await Product.findOne({ _id: item.product, shop: shop._id }).session(mongoSession);
        if (!product) throw Object.assign(new Error(`Product ${item.product} not found`), { status: 404 });

        const fromIdx = (product.stock_locations || []).findIndex((l) => String(l.warehouse) === String(transfer.from_warehouse));
        const toIdx   = (product.stock_locations || []).findIndex((l) => String(l.warehouse) === String(transfer.to_warehouse));

        const fromAvail = fromIdx >= 0 ? product.stock_locations[fromIdx].quantity : 0;
        if (fromAvail < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock for "${product.name}": available ${fromAvail}`), { status: 400 });
        }

        if (fromIdx >= 0) {
          product.stock_locations[fromIdx].quantity = round2(product.stock_locations[fromIdx].quantity - item.quantity);
        }

        if (toIdx >= 0) {
          product.stock_locations[toIdx].quantity = round2(product.stock_locations[toIdx].quantity + item.quantity);
        } else {
          const toWarehouse = await Warehouse.findById(transfer.to_warehouse).lean();
          product.stock_locations.push({
            warehouse:      transfer.to_warehouse,
            warehouse_name: toWarehouse ? toWarehouse.name : '',
            quantity:       item.quantity,
          });
        }

        product.markModified('stock_locations');
        await product.save({ session: mongoSession });
      }

      transfer.status       = 'confirmed';
      transfer.confirmed_at = new Date();
      transfer.confirmed_by = req.user.id;
      await transfer.save({ session: mongoSession });
    });

    const result = await StockTransfer.findById(req.params.id)
      .populate('from_warehouse', 'name code')
      .populate('to_warehouse', 'name code')
      .lean();
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('[warehouseController:confirmTransfer]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  } finally {
    mongoSession.endSession();
  }
};

// ── CANCEL TRANSFER ───────────────────────────────────────────────────────────

const cancelTransfer = async (req, res) => {
  try {
    const shop = await getShopOrFail(req.user.id);
    const transfer = await StockTransfer.findOne({ _id: req.params.id, shop: shop._id });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status === 'confirmed') return res.status(400).json({ message: 'Confirmed transfers cannot be cancelled' });

    transfer.status = 'cancelled';
    await transfer.save();
    return res.json({ message: 'Transfer cancelled' });
  } catch (err) {
    logger.error('[warehouseController:cancelTransfer]', err.message || err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  createWarehouse, getWarehouses, updateWarehouse, deactivateWarehouse,
  getWarehouseStock, createTransfer, getTransfers, confirmTransfer, cancelTransfer,
};
