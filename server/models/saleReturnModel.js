const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  product_name: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  cost_price: { type: Number, default: 0 },
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

const saleReturnSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  original_sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  original_invoice_number: { type: String, required: true },
  return_number: { type: String, required: true },

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
    enum: ['cash', 'upi', 'bank', 'credit_note'],
    default: 'cash',
  },
  refund_amount: { type: Number, default: 0 },

  // Customer
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  buyer_name: { type: String },

  reason: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'processed', 'cancelled'], default: 'processed' },

}, { timestamps: true });

saleReturnSchema.index({ shop: 1, createdAt: -1 });
saleReturnSchema.index({ shop: 1, original_sale: 1 });
saleReturnSchema.index({ shop: 1, original_invoice_number: 1 });
saleReturnSchema.index({ shop: 1, return_number: 1 }, { unique: true });

module.exports = mongoose.model('SaleReturn', saleReturnSchema);
