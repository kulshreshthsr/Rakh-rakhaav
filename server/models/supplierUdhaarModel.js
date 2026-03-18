const mongoose = require('mongoose');

const supplierUdhaarSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },

  type: {
    type: String,
    enum: ['debit', 'credit'],
    required: true,
    // debit  = humne credit pe purchase kiya (hum unhe denge)
    // credit = humne unhe payment kar diya (balance kam hua)
  },

  amount: { type: Number, required: true },
  running_balance: { type: Number, default: 0 }, // ← NEW: balance after this entry (for ledger statement)
  note: { type: String },
  date: { type: Date, default: Date.now },
  reference_id: { type: String },   // invoice_number
  reference_type: { type: String }, // 'purchase' | 'manual'
}, { timestamps: true });

module.exports = mongoose.model('SupplierUdhaar', supplierUdhaarSchema);