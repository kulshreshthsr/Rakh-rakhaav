const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  price: { type: Number, required: true },
  mrp: { type: Number, default: 0 },
  dealer_price: { type: Number, default: 0 },
  project_price: { type: Number, default: 0 },
  cost_price:          { type: Number, default: 0 },
  weighted_avg_cost:   { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'pcs' },
  barcode: { type: String, trim: true, default: '' },
  sku: { type: String, trim: true, default: '' },
  hsn_code: { type: String },
  gst_rate: { type: Number, default: 0, enum: [0, 5, 12, 18, 28] },
  pack_size: { type: Number, default: 1 },
  pack_unit: { type: String, default: '' },
  loose_unit: { type: String, default: '' },
  sold_in_loose: { type: Boolean, default: false },
  loose_price: { type: Number, default: 0 },
  // Electronics: individual unit is serialized (IMEI/serial tracked per piece)
  has_serials: { type: Boolean, default: false },
  batch_tracking_enabled: { type: Boolean, default: false },

  stock_locations: [{
    warehouse:      { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    warehouse_name: { type: String, default: '' },
    quantity:       { type: Number, default: 0 },
    _id: false,
  }],

  low_stock_threshold: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },

  category: { type: String, default: '' },
  sub_category: { type: String, default: '' },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

productSchema.virtual('total_quantity').get(function () {
  if (this.stock_locations && this.stock_locations.length > 0) {
    return this.stock_locations.reduce((s, l) => s + (l.quantity || 0), 0);
  }
  return this.quantity;
});

productSchema.virtual('margin').get(function () {
  if (!this.cost_price || this.cost_price === 0) return null;
  return parseFloat((((this.price - this.cost_price) / this.cost_price) * 100).toFixed(1));
});

productSchema.virtual('is_low_stock').get(function () {
  return this.quantity > 0 && this.quantity <= this.low_stock_threshold;
});

productSchema.virtual('is_out_of_stock').get(function () {
  return this.quantity <= 0;
});

productSchema.index({ shop: 1 });
productSchema.index({ shop: 1, isActive: 1 });
productSchema.index({ shop: 1, quantity: 1 });
productSchema.index({ shop: 1, barcode: 1 }, { sparse: true });
productSchema.index({ shop: 1, sku: 1 }, { sparse: true });
productSchema.index({ shop: 1, category: 1 });
// Hardware: size/spec-aware search (e.g. "1 inch", "4mm", "90m coil")
productSchema.index({ name: 'text', 'metadata.size_spec': 'text' }, { weights: { name: 10, 'metadata.size_spec': 5 }, name: 'product_text_search', sparse: true });

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
