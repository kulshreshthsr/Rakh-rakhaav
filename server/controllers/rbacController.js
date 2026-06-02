const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const crypto = require('crypto');
const User = require('../models/userModel');
const Shop = require('../models/shopModel');
const Role = require('../models/roleModel');
const { ALL_PERMISSIONS, SYSTEM_ROLES } = Role;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getOwnerShop = async (ownerId) => {
  const shop = await Shop.findOne({ owner: ownerId });
  if (!shop) throw new Error('Shop not found');
  return shop;
};

const generateTempPassword = () => {
  return crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 char hex
};

const serializeMember = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  role: user.role,
  isActive: user.isActive,
  isSubUser: user.isSubUser,
  createdAt: user.createdAt,
});

// ─── Permissions ──────────────────────────────────────────────────────────────

const getPermissions = (req, res) => {
  const grouped = {
    Dashboard:   ['VIEW_DASHBOARD'],
    Inventory:   ['MANAGE_INVENTORY'],
    Sales:       ['CREATE_INVOICE', 'VIEW_SALES', 'MANAGE_SALES'],
    Purchases:   ['CREATE_PURCHASE', 'VIEW_PURCHASES', 'MANAGE_PURCHASES'],
    Expenses:    ['VIEW_EXPENSES', 'MANAGE_EXPENSES'],
    Income:      ['VIEW_INCOME', 'MANAGE_INCOME'],
    Bank:        ['VIEW_BANK', 'MANAGE_BANK'],
    Reports:     ['VIEW_REPORTS'],
    GST:         ['VIEW_GST'],
    Udhaar:      ['VIEW_UDHAAR', 'MANAGE_UDHAAR'],
    Customers:   ['MANAGE_CUSTOMERS'],
    Suppliers:   ['MANAGE_SUPPLIERS'],
    'User Mgmt': ['MANAGE_USERS', 'MANAGE_ROLES'],
  };
  res.json({ permissions: ALL_PERMISSIONS, grouped });
};

// ─── Roles ────────────────────────────────────────────────────────────────────

const getRoles = async (req, res) => {
  try {
    const shop = await getOwnerShop(req.user.id);

    // Merge system roles with any custom DB roles
    const systemList = Object.entries(SYSTEM_ROLES).map(([name, meta]) => ({
      _id: `system:${name}`,
      name,
      label: meta.label,
      color: meta.color,
      permissions: meta.permissions,
      isSystem: true,
      memberCount: 0,
    }));

    const customRoles = await Role.find({ shopId: shop._id }).sort({ createdAt: 1 });

    // Count members per role
    const members = await User.find({ shopId: shop._id, isSubUser: true }).select('role');
    const countMap = {};
    for (const m of members) countMap[m.role] = (countMap[m.role] || 0) + 1;

    for (const r of systemList) r.memberCount = countMap[r.name] || 0;
    systemList[0].memberCount = 1; // owner always counts as 1 (the shop owner themselves)

    const customList = customRoles.map((r) => ({
      _id: r._id,
      name: r.name,
      label: r.label,
      color: r.color,
      permissions: r.permissions,
      isSystem: r.isSystem,
      memberCount: countMap[r.name] || 0,
    }));

    res.json({ roles: [...systemList, ...customList] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const createRole = async (req, res) => {
  const { name, label, permissions = [], color = 'green' } = req.body;
  if (!name || !label) return res.status(400).json({ message: 'name and label are required' });
  if (SYSTEM_ROLES[name.toLowerCase()]) {
    return res.status(400).json({ message: 'Cannot create a role with a reserved system name' });
  }

  try {
    const shop = await getOwnerShop(req.user.id);
    const validPerms = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    const role = await Role.create({
      name: name.toLowerCase().trim(),
      label: label.trim(),
      shopId: shop._id,
      permissions: validPerms,
      color,
    });
    res.status(201).json({ role });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'A role with this name already exists' });
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateRole = async (req, res) => {
  const { id } = req.params;
  const { label, permissions, color } = req.body;

  if (id.startsWith('system:')) {
    return res.status(400).json({ message: 'System roles cannot be modified' });
  }

  try {
    const shop = await getOwnerShop(req.user.id);
    const role = await Role.findOne({ _id: id, shopId: shop._id });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem) return res.status(400).json({ message: 'System roles cannot be modified' });

    role.label = label ?? role.label;
    if (permissions !== undefined) {
      role.permissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    }
    if (color) role.color = color;
    await role.save();

    res.json({ role });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const deleteRole = async (req, res) => {
  const { id } = req.params;

  if (id.startsWith('system:')) {
    return res.status(400).json({ message: 'System roles cannot be deleted' });
  }

  try {
    const shop = await getOwnerShop(req.user.id);
    const role = await Role.findOne({ _id: id, shopId: shop._id });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem) return res.status(400).json({ message: 'System roles cannot be deleted' });

    // Safety: ensure no active members use this role
    const memberCount = await User.countDocuments({ shopId: shop._id, role: role.name, isActive: true });
    if (memberCount > 0) {
      return res.status(400).json({
        message: `Cannot delete role '${role.label}' — ${memberCount} active member(s) are assigned to it. Reassign them first.`,
      });
    }

    await role.deleteOne();
    res.json({ message: 'Role deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─── Team Members ─────────────────────────────────────────────────────────────

const getTeamMembers = async (req, res) => {
  try {
    const shop = await getOwnerShop(req.user.id);
    const members = await User.find({ shopId: shop._id, isSubUser: true })
      .select('name username role isActive createdAt createdBy')
      .sort({ createdAt: -1 });

    res.json({ members: members.map(serializeMember) });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const isValidRole = async (roleName, shopId) => {
  if (SYSTEM_ROLES[roleName]) return true;
  const custom = await Role.findOne({ shopId, name: roleName });
  return !!custom;
};

const createTeamMember = async (req, res) => {
  const { name, username, password, role = 'cashier' } = req.body;
  if (!name || !username) return res.status(400).json({ message: 'name and username are required' });

  try {
    const shop = await getOwnerShop(req.user.id);

    if (!(await isValidRole(role, shop._id))) {
      return res.status(400).json({ message: `Role '${role}' does not exist.` });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Username already taken. Please choose another.' });

    const tempPassword = password || generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    const member = await User.create({
      name,
      username: username.toLowerCase().trim(),
      password: hashed,
      role,
      isSubUser: true,
      shopId: shop._id,
      isActive: true,
      createdBy: req.user.subUserId || req.user.id,
      isPro: false,
      paymentStatus: null,
      subscriptionType: null,
    });

    res.status(201).json({
      member: serializeMember(member),
      tempPassword,
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Username already taken. Please choose another.' });
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateTeamMember = async (req, res) => {
  const { id } = req.params;
  const { name, role, isActive } = req.body;

  try {
    const shop = await getOwnerShop(req.user.id);
    const member = await User.findOne({ _id: id, shopId: shop._id, isSubUser: true });
    if (!member) return res.status(404).json({ message: 'Team member not found' });

    if (name !== undefined) member.name = name;
    if (role !== undefined) {
      if (!(await isValidRole(role, shop._id))) {
        return res.status(400).json({ message: `Role '${role}' does not exist.` });
      }
      member.role = role;
    }
    if (isActive !== undefined) member.isActive = isActive;
    await member.save();

    res.json({ member: serializeMember(member) });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const resetMemberPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const shop = await getOwnerShop(req.user.id);
    const member = await User.findOne({ _id: id, shopId: shop._id, isSubUser: true });
    if (!member) return res.status(404).json({ message: 'Team member not found' });

    const tempPassword = newPassword || generateTempPassword();
    member.password = await bcrypt.hash(tempPassword, 10);
    await member.save();

    res.json({ message: 'Password reset successful', tempPassword });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const deleteTeamMember = async (req, res) => {
  const { id } = req.params;

  try {
    const shop = await getOwnerShop(req.user.id);
    const member = await User.findOne({ _id: id, shopId: shop._id, isSubUser: true });
    if (!member) return res.status(404).json({ message: 'Team member not found' });

    await member.deleteOne();
    res.json({ message: 'Team member removed' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  getPermissions,
  getRoles, createRole, updateRole, deleteRole,
  getTeamMembers, createTeamMember, updateTeamMember, resetMemberPassword, deleteTeamMember,
};
