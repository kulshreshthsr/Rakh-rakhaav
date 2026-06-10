const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  shop:       { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name:       { type: String, required: true, trim: true },
  code:       { type: String, default: '', trim: true },
  address:    { type: String, default: '' },
  is_default: { type: Boolean, default: false },
  is_active:  { type: Boolean, default: true },
}, { timestamps: true });

warehouseSchema.index({ shop: 1, is_active: 1 });
warehouseSchema.index({ shop: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);
