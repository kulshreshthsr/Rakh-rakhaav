const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  gst_rate: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
  total_amount: { type: Number, default: 0 },
  item_metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
});

const purchaseReturnSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  original_purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
  original_invoice_number: { type: String, required: true },
  credit_note_number: { type: String, required: true },

  items: [returnItemSchema],

  // Totals
  taxable_amount: { type: Number, default: 0 },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },

  // Refund
  refund_mode: {
    type: String,
    enum: ['cash', 'bank', 'upi', 'adjust'],
    default: 'adjust',
  },
  refund_amount: { type: Number, default: 0 },

  // Supplier
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  supplier_name: { type: String },

  reason: { type: String },
  return_date: { type: Date, default: Date.now },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'processed', 'cancelled'], default: 'processed' },

}, { timestamps: true });

purchaseReturnSchema.index({ shop: 1, createdAt: -1 });
purchaseReturnSchema.index({ shop: 1, original_purchase: 1 });
purchaseReturnSchema.index({ shop: 1, original_invoice_number: 1 });
purchaseReturnSchema.index({ shop: 1, credit_note_number: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
