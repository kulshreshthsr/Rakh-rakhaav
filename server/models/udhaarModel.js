const mongoose = require('mongoose');

const udhaarSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  type: {
    type: String,
    enum: ['debit', 'credit'],  // debit = customer ne udhaar liya, credit = customer ne payment di
    required: true,
    // Legacy values 'diya'/'liya' auto-mapped in controller
  },

  amount: { type: Number, required: true },
  running_balance: { type: Number, default: 0 }, // ← balance after this entry (for ledger statement)
  note: { type: String },
  date: { type: Date, default: Date.now },
  reference_id: { type: String },   // invoice number
  reference_type: { type: String }, // 'sale' | 'manual'
}, { timestamps: true });

module.exports = mongoose.model('Udhaar', udhaarSchema);