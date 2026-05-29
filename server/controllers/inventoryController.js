/**
 * inventoryController.js
 *
 * Handles CRUD for all sub-inventory records:
 *   - ProductBatch   (pharmacy, bakery, grocery, cosmetics, sweet_shop)
 *   - ProductVariant (clothing, footwear, sports)
 *   - Recipe         (restaurant, bakery, sweet_shop)
 *   - SerialInventory(electronics, mobile_shop)
 *
 * These records are additive to the core product.quantity field.
 * The core sale/purchase flow (and invoice totals) are untouched.
 */

const mongoose = require('mongoose');
const Product        = require('../models/productModel');
const ProductBatch   = require('../models/productBatchModel');
const ProductVariant = require('../models/productVariantModel');
const Recipe         = require('../models/recipeModel');
const SerialInventory = require('../models/serialInventoryModel');
const Shop           = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) {
    const created = await Shop.create([{ name: 'My Shop', owner: userId }]);
    shop = created[0];
  }
  return shop;
};

const assertProduct = async (productId, shopId) => {
  const product = await Product.findOne({ _id: productId, shop: shopId });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  return product;
};

// ─────────────────────────────────────────────────────────────────────────────
// BATCH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

const getBatches = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    await assertProduct(req.params.productId, shop._id);
    const batches = await ProductBatch.find({ shop: shop._id, product: req.params.productId })
      .sort({ expiry_date: 1, createdAt: -1 });
    res.json(batches);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const addBatch = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let batch;
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const product = await assertProduct(req.params.productId, shop._id);
      const { batch_number, expiry_date, manufacture_date, quantity, mrp, cost_price, manufacturer, notes, purchase_invoice } = req.body;

      if (!batch_number) throw new Error('Batch number is required');
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be a positive number');

      const [created] = await ProductBatch.create([{
        shop: shop._id,
        product: product._id,
        batch_number: String(batch_number).trim(),
        expiry_date:  expiry_date  ? new Date(expiry_date)  : undefined,
        manufacture_date: manufacture_date ? new Date(manufacture_date) : undefined,
        quantity: qty,
        mrp:        mrp        != null ? Number(mrp)        : undefined,
        cost_price: cost_price != null ? Number(cost_price) : 0,
        manufacturer, notes, purchase_invoice,
      }], { session });

      // Keep product.quantity in sync
      await Product.findByIdAndUpdate(product._id, { $inc: { quantity: qty } }, { session });
      batch = created;
    });
    res.status(201).json(batch);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

const updateBatch = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const batch = await ProductBatch.findOne({ _id: req.params.batchId, shop: shop._id }).session(session);
      if (!batch) throw Object.assign(new Error('Batch not found'), { status: 404 });

      const { quantity, mrp, cost_price, expiry_date, manufacture_date, manufacturer, notes } = req.body;

      if (quantity != null) {
        const newQty = Number(quantity);
        if (!Number.isFinite(newQty) || newQty < 0) throw new Error('Invalid quantity');
        const delta = newQty - batch.quantity;
        batch.quantity = newQty;
        batch.is_depleted = newQty === 0;
        if (delta !== 0) {
          await Product.findByIdAndUpdate(batch.product, { $inc: { quantity: delta } }, { session });
        }
      }
      if (mrp != null)          batch.mrp          = Number(mrp);
      if (cost_price != null)   batch.cost_price   = Number(cost_price);
      if (expiry_date != null)  batch.expiry_date  = new Date(expiry_date);
      if (manufacture_date != null) batch.manufacture_date = new Date(manufacture_date);
      if (manufacturer != null) batch.manufacturer = manufacturer;
      if (notes != null)        batch.notes        = notes;

      await batch.save({ session });
      updated = batch;
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

const deleteBatch = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const batch = await ProductBatch.findOne({ _id: req.params.batchId, shop: shop._id }).session(session);
      if (!batch) throw Object.assign(new Error('Batch not found'), { status: 404 });

      if (batch.quantity > 0) {
        await Product.findByIdAndUpdate(batch.product, { $inc: { quantity: -batch.quantity } }, { session });
      }
      await ProductBatch.findByIdAndDelete(batch._id, { session });
    });
    res.json({ message: 'Batch deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// Expiring batches across the whole shop (for dashboard alerts)
const getExpiringBatches = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const days = Number(req.query.days) || 30;
    const cutoff = new Date(Date.now() + days * 86400000);
    const batches = await ProductBatch.find({
      shop: shop._id,
      is_depleted: false,
      quantity: { $gt: 0 },
      expiry_date: { $lte: cutoff },
    })
      .populate('product', 'name unit')
      .sort({ expiry_date: 1 })
      .limit(50);
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

const getVariants = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    await assertProduct(req.params.productId, shop._id);
    const variants = await ProductVariant.find({ shop: shop._id, product: req.params.productId, isActive: true })
      .sort({ size: 1, color: 1 });
    res.json(variants);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// Bulk upsert: pass an array of { size, color, attributes, quantity, price, cost_price, sku, barcode }
const saveVariants = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let variants;
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const product = await assertProduct(req.params.productId, shop._id);
      const incoming = Array.isArray(req.body) ? req.body : [req.body];

      // Soft-delete existing variants then re-create (simplest merge strategy)
      const existing = await ProductVariant.find({ shop: shop._id, product: product._id, isActive: true }).session(session);
      const existingMap = new Map(existing.map(v => [v._id.toString(), v]));

      let totalQtyDelta = 0;
      const upserted = [];

      for (const v of incoming) {
        const qty = Number(v.quantity) || 0;
        const id  = v._id;

        if (id && existingMap.has(id)) {
          const existing_v = existingMap.get(id);
          totalQtyDelta += qty - existing_v.quantity;
          existing_v.size       = v.size  || existing_v.size;
          existing_v.color      = v.color || existing_v.color;
          existing_v.quantity   = qty;
          existing_v.price      = v.price      != null ? Number(v.price)      : existing_v.price;
          existing_v.cost_price = v.cost_price != null ? Number(v.cost_price) : existing_v.cost_price;
          existing_v.sku        = v.sku  || existing_v.sku;
          existing_v.barcode    = v.barcode || existing_v.barcode;
          if (v.attributes) existing_v.attributes = v.attributes;
          await existing_v.save({ session });
          upserted.push(existing_v);
          existingMap.delete(id);
        } else {
          const [created] = await ProductVariant.create([{
            shop: shop._id, product: product._id,
            size: v.size, color: v.color,
            attributes: v.attributes || {},
            quantity: qty,
            price:      v.price      != null ? Number(v.price)      : undefined,
            cost_price: v.cost_price != null ? Number(v.cost_price) : undefined,
            sku: v.sku, barcode: v.barcode,
          }], { session });
          totalQtyDelta += qty;
          upserted.push(created);
        }
      }

      // Soft-delete variants that were removed from the payload
      for (const [, removed] of existingMap) {
        totalQtyDelta -= removed.quantity;
        removed.isActive = false;
        removed.quantity = 0;
        await removed.save({ session });
      }

      if (totalQtyDelta !== 0) {
        await Product.findByIdAndUpdate(product._id, { $inc: { quantity: totalQtyDelta } }, { session });
      }

      variants = upserted;
    });
    res.json(variants);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

const updateVariantQty = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let variant;
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const v = await ProductVariant.findOne({ _id: req.params.variantId, shop: shop._id }).session(session);
      if (!v) throw Object.assign(new Error('Variant not found'), { status: 404 });

      const newQty = Number(req.body.quantity);
      if (!Number.isFinite(newQty) || newQty < 0) throw new Error('Invalid quantity');
      const delta = newQty - v.quantity;
      v.quantity = newQty;
      if (req.body.price      != null) v.price      = Number(req.body.price);
      if (req.body.cost_price != null) v.cost_price = Number(req.body.cost_price);
      await v.save({ session });
      if (delta !== 0) {
        await Product.findByIdAndUpdate(v.product, { $inc: { quantity: delta } }, { session });
      }
      variant = v;
    });
    res.json(variant);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RECIPE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

const getRecipe = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    await assertProduct(req.params.productId, shop._id);
    const recipe = await Recipe.findOne({ shop: shop._id, dish: req.params.productId })
      .populate('ingredients.ingredient', 'name unit quantity');
    res.json(recipe || null);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const saveRecipe = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const product = await assertProduct(req.params.productId, shop._id);
    const { serving_quantity, ingredients, notes } = req.body;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ message: 'At least one ingredient is required' });
    }

    const resolved = ingredients.map(i => ({
      ingredient:      i.ingredient_id || i.ingredient,
      ingredient_name: i.ingredient_name || '',
      quantity:        Number(i.quantity),
      unit:            i.unit || 'pcs',
    })).filter(i => i.ingredient && i.quantity > 0);

    const recipe = await Recipe.findOneAndUpdate(
      { shop: shop._id, dish: product._id },
      { $set: { dish_name: product.name, serving_quantity: Number(serving_quantity) || 1, ingredients: resolved, notes, isActive: true } },
      { upsert: true, new: true }
    );
    res.json(recipe);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    await Recipe.findOneAndDelete({ shop: shop._id, dish: req.params.productId });
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SERIAL INVENTORY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

const getSerials = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    await assertProduct(req.params.productId, shop._id);
    const { status } = req.query;
    const filter = { shop: shop._id, product: req.params.productId };
    if (status) filter.status = status;
    const serials = await SerialInventory.find(filter).sort({ createdAt: -1 });
    res.json(serials);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// Bulk add serial numbers
const addSerials = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const product = await assertProduct(req.params.productId, shop._id);
      const serials = Array.isArray(req.body) ? req.body : [req.body];

      const docs = serials.map(s => ({
        shop: shop._id, product: product._id,
        serial_number:   String(s.serial_number || '').trim(),
        imei_number:     s.imei_number  ? String(s.imei_number).trim()  : undefined,
        imei2_number:    s.imei2_number ? String(s.imei2_number).trim() : undefined,
        status:          'in_stock',
        purchase_invoice: s.purchase_invoice,
        warranty_expiry: s.warranty_expiry ? new Date(s.warranty_expiry) : undefined,
        color:   s.color,
        storage: s.storage,
        ram:     s.ram,
        notes:   s.notes,
      })).filter(s => s.serial_number);

      if (!docs.length) throw new Error('At least one valid serial number is required');

      created = await SerialInventory.create(docs, { session });
      await Product.findByIdAndUpdate(product._id, { $inc: { quantity: docs.length } }, { session });
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

const updateSerial = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const serial = await SerialInventory.findOneAndUpdate(
      { _id: req.params.serialId, shop: shop._id },
      { $set: req.body },
      { new: true }
    );
    if (!serial) return res.status(404).json({ message: 'Serial not found' });
    res.json(serial);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSerial = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const shop = await getOrCreateShop(req.user.id);
      const serial = await SerialInventory.findOne({ _id: req.params.serialId, shop: shop._id }).session(session);
      if (!serial) throw Object.assign(new Error('Serial not found'), { status: 404 });
      if (serial.status === 'in_stock') {
        await Product.findByIdAndUpdate(serial.product, { $inc: { quantity: -1 } }, { session });
      }
      await SerialInventory.findByIdAndDelete(serial._id, { session });
    });
    res.json({ message: 'Serial deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY SUMMARY  (used by dashboard or product card)
// ─────────────────────────────────────────────────────────────────────────────

const getProductInventorySummary = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const productId = req.params.productId;
    await assertProduct(productId, shop._id);

    const [batches, variants, recipe, serials] = await Promise.all([
      ProductBatch.find({ shop: shop._id, product: productId, is_depleted: false }),
      ProductVariant.find({ shop: shop._id, product: productId, isActive: true }),
      Recipe.findOne({ shop: shop._id, dish: productId, isActive: true }),
      SerialInventory.countDocuments({ shop: shop._id, product: productId, status: 'in_stock' }),
    ]);

    res.json({
      has_batches:  batches.length > 0,
      batch_count:  batches.length,
      expiring_soon: batches.filter(b => b.is_near_expiry).length,
      expired:       batches.filter(b => b.is_expired).length,
      has_variants:  variants.length > 0,
      variant_count: variants.length,
      has_recipe:    !!recipe,
      serial_in_stock: serials,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  // Batch
  getBatches, addBatch, updateBatch, deleteBatch, getExpiringBatches,
  // Variant
  getVariants, saveVariants, updateVariantQty,
  // Recipe
  getRecipe, saveRecipe, deleteRecipe,
  // Serial
  getSerials, addSerials, updateSerial, deleteSerial,
  // Summary
  getProductInventorySummary,
};
