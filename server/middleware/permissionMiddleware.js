const { ALL_PERMISSIONS } = require('../models/roleModel');

/**
 * Middleware factory: blocks the request if the authenticated user does not
 * hold the given permission.  Works transparently for owners (full access),
 * system roles, and custom DB-backed roles.
 *
 * Usage:  router.post('/', protect, requirePermission('CREATE_INVOICE'), handler)
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Owners always have full access
  if (req.user.role === 'owner') return next();

  const perms = req.user.permissions || [];
  if (perms.includes(permission)) return next();

  return res.status(403).json({
    message: `Access denied. '${permission}' permission required.`,
    code: 'PERMISSION_DENIED',
  });
};

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
