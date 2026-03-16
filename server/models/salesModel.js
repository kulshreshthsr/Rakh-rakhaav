const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true }, // base price
  gst_rate: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },

  // Auto calculated
  taxable_amount: { type: Number }, // price_per_unit * quantity
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  total_amount: { type: Number, required: true }, // taxable + GST

  // Buyer details (optional)
  buyer_name: { type: String },
  buyer_gstin: { type: String },
  buyer_address: { type: String },

  invoice_number: { type: String, unique: true },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);