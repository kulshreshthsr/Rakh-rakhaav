const mongoose = require('mongoose');

const bankEntrySchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  entry_type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'charge', 'interest', 'transfer_in', 'transfer_out'],
    required: true,
  },
  amount: { type: Number, required: true, min: 0 },
  reference_id: { type: String, default: '' },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

bankEntrySchema.index({ shop: 1, date: -1 });

module.exports = mongoose.model('BankEntry', bankEntrySchema);
