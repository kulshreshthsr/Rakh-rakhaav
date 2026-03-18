const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Supplier = require('../models/supplierModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const Shop = require('../models/shopModel');

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

// Get all suppliers
router.get('/', protect, async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const suppliers = await Supplier.find({ shop: shop._id }).sort({ createdAt: -1 });
    res.json(suppliers);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get supplier udhaar
router.get('/:id/udhaar', protect, async (req, res) => {
  try {
    const entries = await SupplierUdhaar.find({ supplier: req.params.id }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Settle supplier udhaar (payment kiya)
router.post('/:id/settle', protect, async (req, res) => {
  try {
    const { amount, note } = req.body;
    const shop = await getOrCreateShop(req.user.id);
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    await SupplierUdhaar.create({
      shop: shop._id,
      supplier: supplier._id,
      type: 'credit',
      amount,
      note: note || 'Payment made',
      date: new Date(),
      reference_type: 'manual',
    });

    await Supplier.findByIdAndUpdate(supplier._id, { $inc: { totalUdhaar: -amount } });
    res.json({ message: 'Payment recorded' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;