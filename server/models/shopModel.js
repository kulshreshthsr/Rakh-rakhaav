const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String }, // important for CGST/SGST vs IGST
  pincode: { type: String },
  gstin: { type: String }, // shop ka GSTIN (optional)
  phone: { type: String },
  email: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);