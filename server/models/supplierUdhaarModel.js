const mongoose = require('mongoose');

const supplierUdhaarSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },

  type: {
    type: String,
    enum: ['debit', 'credit'],
    required: true,
  },

  amount: { type: Number, required: true },
  running_balance: { type: Number, default: 0 },
  payment_mode: {
    type: String,
    enum: ['cash', 'bank', 'upi', ''],
    default: '',
  },
  note: { type: String },
  date: { type: Date, default: Date.now },
  reference_id: { type: String },
  reference_type: { type: String },
  due_date: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SupplierUdhaar', supplierUdhaarSchema);
