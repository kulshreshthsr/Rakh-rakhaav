const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  shopId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  type:     { type: String, required: true },  // 'low_stock', 'expiry_warning', 'expired', 'workflow_delay', 'out_of_stock'
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  title:    { type: String, required: true },
  message:  { type: String, required: true },
  isRead:   { type: Boolean, default: false, index: true },
  // Which roles can see this notification (empty array = all roles)
  forRoles: { type: [String], default: [] },
  relatedEntity: {
    type: { type: String },  // 'product', 'sale', 'purchase', 'customer'
    id:   { type: String },
    name: { type: String },
  },
  // Unique key to prevent duplicate alerts for the same ongoing condition
  dedupeKey: { type: String },
  // TTL: auto-expire after 7 days
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

notificationSchema.index({ shopId: 1, createdAt: -1 });
notificationSchema.index({ shopId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ shopId: 1, dedupeKey: 1 }, { unique: true, sparse: true });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });  // MongoDB TTL

module.exports = mongoose.model('Notification', notificationSchema);
