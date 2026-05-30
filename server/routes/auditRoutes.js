const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const AuditLog = require('../models/auditLogModel');
const Shop     = require('../models/shopModel');

// GET /api/audit?entity=sale&limit=50&skip=0
router.get('/', protect, async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id }).select('_id').lean();
    if (!shop) return res.json([]);

    const { entity, limit = 50, skip = 0 } = req.query;
    const filter = { shopId: shop._id };
    if (entity) filter.entity = entity;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;
