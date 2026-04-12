const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  payment_mode: {
    type: String,
    enum: ['cash', 'bank', 'upi'],
    default: null,
  },
  reference_id: { type: String, default: '' },
  note: { type: String },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
