const mongoose = require('mongoose');

// Maps a dish/menu-item to its raw-material ingredients (restaurant, bakery, sweet shop)
// On sale of `dish`, `quantity_sold * ingredient.qty` is deducted from each ingredient product
const recipeIngredientSchema = new mongoose.Schema({
  ingredient:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  ingredient_name: { type: String },   // snapshot — avoids populate on every sale
  quantity:        { type: Number, required: true, min: 0 },
  unit:            { type: String, default: 'pcs' },
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  shop:             { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  dish:             { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  dish_name:        { type: String },
  serving_quantity: { type: Number, default: 1 },  // how many portions this recipe makes
  ingredients:      [recipeIngredientSchema],
  notes:            { type: String },
  isActive:         { type: Boolean, default: true },
}, { timestamps: true });

recipeSchema.index({ shop: 1, dish: 1 }, { unique: true });

module.exports = mongoose.model('Recipe', recipeSchema);
