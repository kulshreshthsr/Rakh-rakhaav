const mongoose = require('mongoose');

const supplierUdhaarSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  type: { type: String, enum: ['debit', 'credit'], required: true },
  // debit = humne purchase kiya credit pe (hum unhe denge)
  // credit = humne unhe payment kar diya
  amount: { type: Number, required: true },
  note: { type: String },
  date: { type: Date, default: Date.now },
  reference_id: { type: String },
  reference_type: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('SupplierUdhaar', supplierUdhaarSchema);