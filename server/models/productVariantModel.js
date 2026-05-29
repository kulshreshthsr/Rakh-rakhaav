const mongoose = require('mongoose');

// Per-variant stock for clothing, footwear, sports, etc.
// product.quantity always = SUM(active variant quantities) for that product
const productVariantSchema = new mongoose.Schema({
  shop:       { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sku:        { type: String, trim: true },
  size:       { type: String, trim: true },
  color:      { type: String, trim: true },
  // Generic extra dimensions (e.g. { material: 'cotton', gender: 'men' })
  attributes: { type: Map, of: String, default: {} },
  quantity:   { type: Number, default: 0, min: 0 },
  price:      { type: Number },       // optional price override
  cost_price: { type: Number },
  barcode:    { type: String, trim: true },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

productVariantSchema.virtual('display_name').get(function () {
  const parts = [];
  if (this.size)  parts.push(this.size);
  if (this.color) parts.push(this.color);
  for (const [, v] of (this.attributes || [])) if (v) parts.push(v);
  return parts.join(' / ') || 'Default';
});

productVariantSchema.index({ shop: 1, product: 1 });
productVariantSchema.index({ shop: 1, sku: 1 }, { sparse: true });
productVariantSchema.index({ shop: 1, barcode: 1 }, { sparse: true });

productVariantSchema.set('toJSON', { virtuals: true });
productVariantSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ProductVariant', productVariantSchema);
