const mongoose = require('mongoose');

const narcoticsEntrySchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  saleId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  invoiceNumber:   { type: String, required: true },
  dispensedAt:     { type: Date, default: Date.now, required: true },

  // Drug info
  productId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  drugName:        { type: String, required: true },
  schedule:        { type: String, enum: ['Schedule X', 'Schedule H1'], required: true },
  batchNumber:     { type: String },
  quantityDispensed: { type: Number, required: true },
  unit:            { type: String, default: 'units' },

  // Prescription — required for Schedule X; logged best-effort for H1
  prescriptionNumber: { type: String },
  prescribingDoctor:  { type: String },
  doctorRegNo:        { type: String },
  prescriptionDate:   { type: Date },

  // Patient info
  patientName:     { type: String, required: true },
  patientAge:      { type: Number },
  patientAddress:  { type: String },
  patientPhone:    { type: String },

  // Dispensing
  dispensedBy:     { type: String },
  remarks:         { type: String },

  // Immutability — entries can be voided but NEVER deleted
  isVoided:        { type: Boolean, default: false },
  voidReason:      { type: String },
  voidedAt:        { type: Date },
  voidedBy:        { type: String },
}, { timestamps: true });

narcoticsEntrySchema.index({ shop: 1, dispensedAt: -1 });
narcoticsEntrySchema.index({ shop: 1, invoiceNumber: 1 });
narcoticsEntrySchema.index({ shop: 1, prescriptionNumber: 1 });

// Enforce immutability — entries are voided, never deleted
narcoticsEntrySchema.pre('deleteOne', { document: true, query: false }, function() {
  throw new Error('Narcotics register entries cannot be deleted. Use void instead.');
});
narcoticsEntrySchema.pre('deleteMany', function() {
  throw new Error('Narcotics register entries cannot be deleted. Use void instead.');
});

module.exports = mongoose.model('NarcoticsRegister', narcoticsEntrySchema);
