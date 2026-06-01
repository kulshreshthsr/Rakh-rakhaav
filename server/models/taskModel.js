const mongoose = require('mongoose');

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const taskSchema = new mongoose.Schema({
  shopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  title:       { type: String, required: true },
  description: { type: String },
  // Role the task is assigned to (mirrors SYSTEM_ROLES keys)
  assignedTo:  { type: String, default: 'manager' },
  status:      { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  priorityOrder: { type: Number, default: 2 },  // numeric for sort
  dueAt:       { type: Date },
  relatedEntity: {
    type: { type: String },
    id:   { type: String },
    name: { type: String },
  },
  completedAt: { type: Date },
  completedBy: { type: String },  // username
  // Prevent duplicate tasks for the same ongoing condition
  dedupeKey:   { type: String },
}, { timestamps: true });

taskSchema.pre('save', function () {
  this.priorityOrder = PRIORITY_ORDER[this.priority] ?? 2;
});

taskSchema.index({ shopId: 1, status: 1, priorityOrder: 1, createdAt: -1 });
taskSchema.index({ shopId: 1, assignedTo: 1, status: 1 });
taskSchema.index({ shopId: 1, dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Task', taskSchema);
