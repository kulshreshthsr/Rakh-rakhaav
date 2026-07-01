const { ALL_PERMISSIONS } = require('../models/roleModel');
// SECURITY: this file used to define its OWN copy of requirePermission with
// a different bypass check (`role === 'owner'`) than authMiddleware.js's
// version (`!isSubUser`). Both happened to agree today because User.role
// defaults to 'owner', but two independent implementations of the same
// access-control check are a drift risk — a future fix to one (e.g. the
// tokenVersion/session-invalidation logic already in authMiddleware) could
// silently not apply to the other. Consolidated to a single source of truth.
const { requirePermission } = require('./authMiddleware');

/**
 * Blocks sub-users from calling owner-only operations (e.g. shop settings).
 */
const requireOwner = (req, res, next) => {
  if (req.user?.role === 'owner' && !req.user?.isSubUser) return next();
  return res.status(403).json({
    message: 'Only the shop owner can perform this action.',
    code: 'OWNER_ONLY',
  });
};

module.exports = { requirePermission, requireOwner, ALL_PERMISSIONS };