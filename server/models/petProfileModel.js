const mongoose = require('mongoose');

const vaccinationSchema = new mongoose.Schema({
  vaccineName: { type: String },
  givenDate:   { type: Date },
  nextDueDate: { type: Date },
  vetName:     { type: String },
  notes:       { type: String },
});

const petProfileSchema = new mongoose.Schema({
  shop:         { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },

  ownerName:    { type: String, required: true },
  ownerPhone:   { type: String, required: true, index: true },
  ownerAddress: { type: String },

  petName:      { type: String, required: true },
  species:      { type: String, enum: ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Hamster', 'Reptile', 'Other'], required: true },
  breed:        { type: String },
  gender:       { type: String, enum: ['Male', 'Female', 'Unknown'] },
  dateOfBirth:  { type: Date },
  color:        { type: String },
  weight:       { type: Number },
  microchipNo:  { type: String },

  vaccinations: [vaccinationSchema],
  allergies:    [{ type: String }],
  medicalNotes: { type: String },
  vetName:      { type: String },
  vetPhone:     { type: String },

  lastGroomedAt:       { type: Date },
  groomingFrequency:   { type: String },

  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

petProfileSchema.index({ shop: 1, ownerPhone: 1 });

module.exports = mongoose.model('PetProfile', petProfileSchema);
