const mongoose = require('mongoose');

// Each stock change is logged here
const stockHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['purchase', 'sale', 'sale_return', 'purchase_return', 'manual_add', 'manual_remove', 'adjustment'],
    required: true,
  },
  quantity_change: { type: Number, required: true }, // +ve = added, -ve = removed
  quantity_after: { type: Number, required: true },  // stock after this change
  note: { type: String },
  reference_id: { type: String },   // invoice number
  date: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  price: { type: Number, required: true },       // selling price (excl. GST)
  cost_price: { type: Number, default: 0 },      // purchase/cost price
  quantity: { type: Number, default: 0 },        // current stock
  unit: { type: String, default: 'pcs' },
  barcode: { type: String, trim: true, default: '' },
  hsn_code: { type: String },
  gst_rate: { type: Number, default: 0, enum: [0, 5, 12, 18, 28] },

  // ── Inventory management ──────────────────────────────────────
  low_stock_threshold: { type: Number, default: 5 }, // alert when stock <= this
  isActive: { type: Boolean, default: true },         // soft delete

  // ── Industry-specific attributes (pharmacy: manufacturer/schedule, clothing: brand, etc.)
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

  // ── Stock history log ─────────────────────────────────────────
  // TODO: run scripts/migrateStockHistory.js when ready to migrate — StockMovementModel is prepared.
  stock_history: [stockHistorySchema],
}, { timestamps: true });

// Virtual: profit margin %
productSchema.virtual('margin').get(function () {
  if (!this.cost_price || this.cost_price === 0) return null;
  return parseFloat((((this.price - this.cost_price) / this.cost_price) * 100).toFixed(1));
});

// Virtual: is low stock (only when quantity > 0 to avoid double-flagging out-of-stock)
productSchema.virtual('is_low_stock').get(function () {
  return this.quantity > 0 && this.quantity <= this.low_stock_threshold;
});

// Virtual: is out of stock
productSchema.virtual('is_out_of_stock').get(function () {
  return this.quantity <= 0;
});

productSchema.index({ shop: 1 });
productSchema.index({ shop: 1, isActive: 1 });
productSchema.index({ shop: 1, quantity: 1 });
productSchema.index({ shop: 1, barcode: 1 }, { sparse: true });

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
