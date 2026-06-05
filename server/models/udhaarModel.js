const mongoose = require('mongoose');

const udhaarSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  type: {
    type: String,
    enum: ['debit', 'credit'],
    required: true,
    // Legacy values 'diya'/'liya' are mapped in controller before create
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

udhaarSchema.index({ shop: 1, customer: 1, date: -1 });
udhaarSchema.index({ shop: 1, reference_id: 1 });

module.exports = mongoose.model('Udhaar', udhaarSchema);
