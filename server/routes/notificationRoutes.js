const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Notification = require('../models/notificationModel');
const Shop         = require('../models/shopModel');

async function getShopId(userId) {
  const shop = await Shop.findOne({ owner: userId }).select('_id').lean();
  return shop?._id || null;
}

// GET /api/notifications?unread=true&limit=50&skip=0
router.get('/', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    if (!shopId) return res.json({ notifications: [], unreadCount: 0 });

    const { unread, limit = 50, skip = 0 } = req.query;
    const filter = { shopId };
    if (unread === 'true') filter.isRead = false;

    // Role filter: sub-users only see their role's notifications (or all-roles ones)
    if (req.user.isSubUser && req.user.role) {
      filter.$or = [
        { forRoles: { $size: 0 } },
        { forRoles: req.user.role },
      ];
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments({ shopId, isRead: false }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    if (shopId) await Notification.updateMany({ shopId, isRead: false }, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    if (shopId) {
      await Notification.findOneAndUpdate(
        { _id: req.params.id, shopId },
        { $set: { isRead: true } }
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    if (shopId) await Notification.findOneAndDelete({ _id: req.params.id, shopId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;
