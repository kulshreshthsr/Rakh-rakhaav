const mongoose = require('mongoose');

const udhaarSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  type: { type: String, enum: ['diya', 'liya', 'debit', 'credit'], required: true },
  amount: { type: Number, required: true },
  note: { type: String },
  date: { type: Date, default: Date.now },
  reference_id: { type: String }, // invoice number
  reference_type: { type: String }, // 'sale' or 'manual'
}, { timestamps: true });

module.exports = mongoose.model('Udhaar', udhaarSchema);