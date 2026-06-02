const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  shop:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',    required: true },

  type: {
    type: String,
    enum: ['purchase', 'sale', 'sale_return', 'purchase_return', 'manual_add', 'manual_remove', 'adjustment'],
    required: true,
  },
  quantity_change: { type: Number, required: true },
  quantity_after:  { type: Number, required: true },
  reference_id:    { type: String },
  reference_type:  { type: String },
  note:            { type: String },
  performed_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date:            { type: Date, default: Date.now },
}, { timestamps: true });

stockMovementSchema.index({ product: 1, date: -1 });
stockMovementSchema.index({ shop: 1, date: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
