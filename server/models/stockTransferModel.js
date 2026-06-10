const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema({
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, default: '' },
  quantity:     { type: Number, required: true, min: 0.001 },
  unit:         { type: String, default: 'pcs' },
  cost_price:   { type: Number, default: 0 },
}, { _id: false });

const stockTransferSchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  transfer_number: { type: String, required: true },
  from_warehouse:  { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  to_warehouse:    { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  status:          { type: String, enum: ['draft', 'confirmed', 'cancelled'], default: 'draft' },
  items:           [transferItemSchema],
  notes:           { type: String, default: '' },
  confirmed_at:    { type: Date, default: null },
  confirmed_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

stockTransferSchema.index({ shop: 1, createdAt: -1 });
stockTransferSchema.index({ shop: 1, status: 1 });
stockTransferSchema.index({ shop: 1, from_warehouse: 1 });
stockTransferSchema.index({ shop: 1, to_warehouse: 1 });
stockTransferSchema.index({ shop: 1, transfer_number: 1 }, { unique: true });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
