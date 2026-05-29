const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  shopId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:   { type: String },
  action:     { type: String, required: true },  // 'INVOICE_CREATED', 'WORKFLOW_ADVANCED', 'STOCK_UPDATED', etc.
  entity:     { type: String },                  // 'sale', 'product', 'task', 'purchase'
  entityId:   { type: String },
  entityName: { type: String },
  details:    { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

auditLogSchema.index({ shopId: 1, createdAt: -1 });
auditLogSchema.index({ shopId: 1, entity: 1, createdAt: -1 });
// Auto-expire after 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
