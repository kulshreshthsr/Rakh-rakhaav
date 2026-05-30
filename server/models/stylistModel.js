const mongoose = require('mongoose');

const stylistSchema = new mongoose.Schema({
  shop:         { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name:         { type: String, required: true },
  phone:        { type: String },
  speciality:   [{ type: String }],
  for_gender:   { type: String, enum: ['All', 'Female', 'Male'], default: 'All' },
  working_days: [{ type: String }],
  start_time:   { type: String, default: '09:00' },
  end_time:     { type: String, default: '20:00' },
  slot_duration:{ type: Number, default: 30 },
  isActive:     { type: Boolean, default: true },
  color:        { type: String, default: '#6366f1' },
}, { timestamps: true });

module.exports = mongoose.model('Stylist', stylistSchema);
