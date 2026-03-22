const mongoose = require('mongoose');

const documentSequenceSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  doc_type: { type: String, enum: ['sale', 'purchase'], required: true },
  financial_year: { type: String, required: true },
  last_number: { type: Number, default: 0 },
}, { timestamps: true });

documentSequenceSchema.index(
  { shop: 1, doc_type: 1, financial_year: 1 },
  { unique: true }
);

module.exports = mongoose.model('DocumentSequence', documentSequenceSchema);
