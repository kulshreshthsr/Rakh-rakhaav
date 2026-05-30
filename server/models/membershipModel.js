const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  shop:          { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  clientName:    { type: String, required: true },
  clientPhone:   { type: String, required: true },
  packageName:   { type: String, required: true },
  serviceId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  serviceName:   { type: String, required: true },
  totalSessions: { type: Number, required: true },
  usedSessions:  { type: Number, default: 0 },
  pricePaid:     { type: Number, required: true },
  purchasedAt:   { type: Date, default: Date.now },
  validUntil:    { type: Date },
  isActive:      { type: Boolean, default: true },
  usageLog: [{
    usedAt:    { type: Date, default: Date.now },
    saleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    notes:     { type: String },
    stylistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stylist' },
  }],
  purchaseSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
}, { timestamps: true });

membershipSchema.virtual('remainingSessions').get(function () {
  return this.totalSessions - this.usedSessions;
});

membershipSchema.set('toJSON', { virtuals: true });
module.exports = mongoose.model('Membership', membershipSchema);
