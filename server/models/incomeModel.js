const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  source: { type: String, required: true },
  category: { type: String, default: 'other_income' },
  amount: { type: Number, required: true, min: 0 },
  payment_mode: {
    type: String,
    enum: ['cash', 'bank', 'upi'],
    required: true,
  },
  reference_id: { type: String, default: '' },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

incomeSchema.index({ shop: 1, date: -1 });

module.exports = mongoose.model('Income', incomeSchema);
