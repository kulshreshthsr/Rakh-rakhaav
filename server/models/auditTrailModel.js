const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action_type: { type: String, enum: ['create', 'update', 'delete'], required: true },
  entity: { type: String, required: true },
  entity_id: { type: String, required: true },
  reference_id: { type: String, default: '' },
  before_value: { type: mongoose.Schema.Types.Mixed, default: null },
  after_value: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

auditTrailSchema.index({ shop: 1, timestamp: -1 });
auditTrailSchema.index({ shop: 1, entity: 1, entity_id: 1, timestamp: -1 });

module.exports = mongoose.model('AuditTrail', auditTrailSchema);
