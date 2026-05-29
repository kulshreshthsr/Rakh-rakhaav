const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Task = require('../models/taskModel');
const Shop = require('../models/shopModel');

async function getShopId(userId) {
  const shop = await Shop.findOne({ owner: userId }).select('_id').lean();
  return shop?._id || null;
}

// GET /api/tasks?status=pending&assignedTo=manager&limit=50&skip=0
router.get('/', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    if (!shopId) return res.json({ tasks: [], pendingCount: 0 });

    const { status, assignedTo, limit = 50, skip = 0 } = req.query;
    const filter = { shopId };
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Role filter: non-manager sub-users only see their assigned tasks
    if (req.user.isSubUser && req.user.role && !['owner', 'manager'].includes(req.user.role)) {
      filter.assignedTo = req.user.role;
    }

    const [tasks, pendingCount] = await Promise.all([
      Task.find(filter)
        .sort({ priorityOrder: 1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Task.countDocuments({ shopId, status: { $in: ['pending', 'in_progress'] } }),
    ]);

    res.json({ tasks, pendingCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks — create a manual task
router.post('/', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    if (!shopId) return res.status(400).json({ message: 'Shop not found' });
    const task = await Task.create({ shopId, ...req.body });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/tasks/:id — update status or fields
router.patch('/:id', protect, async (req, res) => {
  try {
    const shopId = await getShopId(req.user.id);
    const { status, ...rest } = req.body;
    const update = { ...rest };
    if (status) {
      update.status = status;
      if (status === 'completed') {
        update.completedAt = new Date();
        update.completedBy = req.user.username;
      }
    }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, shopId },
      { $set: update },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
