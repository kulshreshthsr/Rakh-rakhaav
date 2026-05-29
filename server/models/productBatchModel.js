const mongoose = require('mongoose');

// Tracks individual purchase batches for batch-mode businesses (pharmacy, bakery, grocery, etc.)
// product.quantity always = SUM(active batch quantities) for a given product
const productBatchSchema = new mongoose.Schema({
  shop:             { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product:          { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  batch_number:     { type: String, required: true, trim: true },
  expiry_date:      { type: Date },
  manufacture_date: { type: Date },
  quantity:         { type: Number, required: true, default: 0, min: 0 },
  mrp:              { type: Number },
  cost_price:       { type: Number, default: 0 },
  manufacturer:     { type: String, trim: true },
  notes:            { type: String },
  purchase_invoice: { type: String },
  is_depleted:      { type: Boolean, default: false },
}, { timestamps: true });

productBatchSchema.virtual('is_expired').get(function () {
  return this.expiry_date ? new Date() > this.expiry_date : false;
});

productBatchSchema.virtual('days_to_expiry').get(function () {
  if (!this.expiry_date) return null;
  return Math.ceil((this.expiry_date - new Date()) / 86400000);
});

productBatchSchema.virtual('is_near_expiry').get(function () {
  const d = this.days_to_expiry;
  return d !== null && d >= 0 && d <= 30;
});

productBatchSchema.index({ shop: 1, product: 1 });
productBatchSchema.index({ shop: 1, expiry_date: 1 });
productBatchSchema.index({ shop: 1, product: 1, is_depleted: 1, expiry_date: 1 });

productBatchSchema.set('toJSON', { virtuals: true });
productBatchSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ProductBatch', productBatchSchema);
