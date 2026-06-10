const mongoose = require('mongoose');

// Per-unit serial / IMEI tracking for electronics, mobile shop, etc.
// product.quantity = count(status === 'in_stock') for that product
const serialInventorySchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product:         { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  serial_number:   { type: String, required: true, trim: true },
  imei_number:     { type: String, trim: true },    // legacy alias for imei_1
  imei2_number:    { type: String, trim: true },    // legacy alias for imei_2
  imei_1:          { type: String, trim: true, default: '' },
  imei_2:          { type: String, trim: true, default: '' },
  status:          { type: String, enum: ['in_stock', 'sold', 'returned', 'damaged'], default: 'in_stock' },
  purchase_invoice: { type: String },
  sale_invoice:    { type: String },
  sale_date:       { type: Date },
  warranty_expiry: { type: Date },
  color:           { type: String },
  storage:         { type: String },
  ram:             { type: String },
  notes:           { type: String },
}, { timestamps: true });

serialInventorySchema.index({ shop: 1, product: 1, status: 1 });
serialInventorySchema.index({ shop: 1, serial_number: 1 });
serialInventorySchema.index({ shop: 1, imei_number: 1 }, { sparse: true });
serialInventorySchema.index({ shop: 1, imei_1: 1 }, { sparse: true });
serialInventorySchema.index({ shop: 1, imei_2: 1 }, { sparse: true });

module.exports = mongoose.model('SerialInventory', serialInventorySchema);
