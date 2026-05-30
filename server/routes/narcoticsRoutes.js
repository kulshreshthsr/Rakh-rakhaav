const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const NarcoticsRegister = require('../models/narcoticsRegisterModel');
const Shop = require('../models/shopModel');

const getShop = (userId) => Shop.findOne({ owner: userId }).select('_id businessType').lean();

// GET /api/narcotics — paginated list with filters
router.get('/', protect, async (req, res) => {
  try {
    const shop = await getShop(req.user.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const { page = 1, limit = 50, from, to, search, schedule } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const match = { shop: shop._id };
    if (from || to) {
      match.dispensedAt = {};
      if (from) match.dispensedAt.$gte = new Date(from);
      if (to)   match.dispensedAt.$lte = new Date(new Date(to).setHours(23, 59, 59));
    }
    if (schedule) match.schedule = schedule;
    if (search) {
      match.$or = [
        { drugName:           { $regex: search, $options: 'i' } },
        { patientName:        { $regex: search, $options: 'i' } },
        { prescriptionNumber: { $regex: search, $options: 'i' } },
        { invoiceNumber:      { $regex: search, $options: 'i' } },
      ];
    }

    const [entries, total] = await Promise.all([
      NarcoticsRegister.find(match).sort({ dispensedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      NarcoticsRegister.countDocuments(match),
    ]);

    res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/narcotics/summary — monthly totals for inspector report
router.get('/summary', protect, async (req, res) => {
  try {
    const shop = await getShop(req.user.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const { month, year } = req.query;
    const startDate = new Date(
      Number(year  || new Date().getFullYear()),
      Number(month || new Date().getMonth() + 1) - 1,
      1
    );
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

    const summary = await NarcoticsRegister.aggregate([
      { $match: { shop: shop._id, dispensedAt: { $gte: startDate, $lte: endDate }, isVoided: false } },
      { $group: {
        _id: { drugName: '$drugName', schedule: '$schedule' },
        totalQty: { $sum: '$quantityDispensed' },
        dispensingCount: { $sum: 1 },
      }},
      { $sort: { '_id.schedule': 1, '_id.drugName': 1 } },
    ]);

    res.json({
      summary,
      month: startDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/narcotics/:id/void — void an entry (never delete)
router.patch('/:id/void', protect, async (req, res) => {
  try {
    const shop = await getShop(req.user.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: 'Void reason is required' });

    const entry = await NarcoticsRegister.findOne({ _id: req.params.id, shop: shop._id });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (entry.isVoided) return res.status(400).json({ message: 'Entry is already voided' });

    entry.isVoided  = true;
    entry.voidReason = reason.trim();
    entry.voidedAt  = new Date();
    entry.voidedBy  = req.user?.username || '';
    await entry.save();

    res.json({ message: 'Entry voided', entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
