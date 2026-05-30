const mongoose = require('mongoose');

const warrantyClaimSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },

  // Original sale reference
  originalSaleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  originalInvoiceNo: { type: String },
  purchaseDate:      { type: Date },

  // Product
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productName:  { type: String, required: true },
  serialNumber: { type: String },
  imeiNumber:   { type: String },
  brandName:    { type: String },
  modelNumber:  { type: String },

  // Claim details
  claimDate:        { type: Date, default: Date.now, required: true },
  issueDescription: { type: String, required: true },
  claimType: {
    type: String,
    enum: ['repair', 'replacement', 'refund'],
    required: true,
  },
  claimStatus: {
    type: String,
    enum: ['received', 'sent_to_brand', 'under_repair', 'ready', 'delivered', 'rejected'],
    default: 'received',
  },

  // Customer
  customerName:  { type: String, required: true },
  customerPhone: { type: String },

  // Resolution
  brandTicketNo:   { type: String },
  resolvedAt:      { type: Date },
  resolution:      { type: String },
  replacedSerial:  { type: String },

  // Tracking
  receivedBy: { type: String },
  notes:      { type: String },
}, { timestamps: true });

warrantyClaimSchema.index({ shop: 1, claimDate: -1 });
warrantyClaimSchema.index({ shop: 1, serialNumber: 1 });
warrantyClaimSchema.index({ shop: 1, claimStatus: 1 });

module.exports = mongoose.model('WarrantyClaim', warrantyClaimSchema);
