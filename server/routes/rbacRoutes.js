const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePermission, requireOwner } = require('../middleware/permissionMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getPermissions,
  getRoles, createRole, updateRole, deleteRole,
  getTeamMembers, createTeamMember, updateTeamMember, resetMemberPassword, deleteTeamMember,
} = require('../controllers/rbacController');

// Permission catalog (read-only, open to any authenticated user)
router.get('/permissions', protect, getPermissions);

// Roles — only users with MANAGE_ROLES (or owner) can write
router.get('/roles', protect, requirePermission('MANAGE_ROLES'), getRoles);
router.post('/roles', protect, checkSubscriptionStatus, requirePermission('MANAGE_ROLES'), createRole);
router.put('/roles/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_ROLES'), updateRole);
router.delete('/roles/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_ROLES'), deleteRole);

// Team members — only users with MANAGE_USERS (or owner) can write
router.get('/team', protect, requirePermission('MANAGE_USERS'), getTeamMembers);
router.post('/team', protect, checkSubscriptionStatus, requirePermission('MANAGE_USERS'), createTeamMember);
router.put('/team/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_USERS'), updateTeamMember);
router.post('/team/:id/reset-password', protect, checkSubscriptionStatus, requirePermission('MANAGE_USERS'), resetMemberPassword);
router.delete('/team/:id', protect, checkSubscriptionStatus, requirePermission('MANAGE_USERS'), deleteTeamMember);

module.exports = router;
