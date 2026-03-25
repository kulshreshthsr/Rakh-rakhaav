const mongoose = require('mongoose');

// Each stock change is logged here
const stockHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['purchase', 'sale', 'manual_add', 'manual_remove', 'adjustment'],
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

  // ── Stock history log ─────────────────────────────────────────
  stock_history: [stockHistorySchema],
}, { timestamps: true });

// Virtual: profit margin %
productSchema.virtual('margin').get(function () {
  if (!this.cost_price || this.cost_price === 0) return null;
  return parseFloat((((this.price - this.cost_price) / this.cost_price) * 100).toFixed(1));
});

// Virtual: is low stock
productSchema.virtual('is_low_stock').get(function () {
  return this.quantity <= this.low_stock_threshold;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
