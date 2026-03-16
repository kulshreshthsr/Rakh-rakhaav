const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String },
  hsn_code: { type: String },
  quantity: { type: Number, required: true },
  price_per_unit: { type: Number, required: true }, // base price
  gst_rate: { type: Number, default: 0 },
  gst_type: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },

  // Auto calculated
  taxable_amount: { type: Number },
  cgst_amount: { type: Number, default: 0 },
  sgst_amount: { type: Number, default: 0 },
  igst_amount: { type: Number, default: 0 },
  total_gst: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },

  // Supplier details (optional)
  supplier_name: { type: String },
  supplier_gstin: { type: String },
  supplier_address: { type: String },

  invoice_number: { type: String },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);