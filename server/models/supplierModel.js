const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  phone: { type: String },
  gstin: { type: String },
  address: { type: String },
  totalUdhaar: { type: Number, default: 0 }, // supplier ko dena hai
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);