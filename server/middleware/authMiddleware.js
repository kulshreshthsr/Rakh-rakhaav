const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Shop = require('../models/shopModel');
const Role = require('../models/roleModel');
const { ALL_PERMISSIONS, SYSTEM_ROLES } = Role; // Role model exports these on itself

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select(
      'name username role isSubUser shopId isActive'
    );

    if (!user) return res.status(401).json({ message: 'User not found' });
    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been disabled. Contact the shop owner.' });
    }

    if (user.isSubUser && user.shopId) {
      // Sub-user: redirect req.user.id to the shop owner so all existing controllers
      // (Shop.findOne({ owner: req.user.id })) transparently find the correct shop.
      const shop = await Shop.findById(user.shopId).select('owner');
      if (!shop) return res.status(404).json({ message: 'Associated shop not found' });

      req.user = {
        id: shop.owner.toString(),       // owner's ID — used by all existing controllers
        subUserId: decoded.id,            // actual sub-user ID for profile/password/audit
        username: decoded.username,
        isSubUser: true,
        shopId: user.shopId.toString(),
        role: user.role,
      };
      // Pass the known shopId to avoid a redundant Shop.findOne inside resolvePermissions
      req.user.permissions = await resolvePermissions(user.role, shop.owner.toString(), user.shopId);
    } else {
      req.user = {
        id: decoded.id,
        subUserId: decoded.id,
        username: decoded.username,
        isSubUser: false,
        shopId: null,
        role: user.role || 'owner',
      };
      req.user.permissions = await resolvePermissions(user.role, decoded.id, null);
    }

    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

async function resolvePermissions(roleName, ownerId, knownShopId) {
  if (!roleName || roleName === 'owner') return ALL_PERMISSIONS;
  if (SYSTEM_ROLES[roleName]) return SYSTEM_ROLES[roleName].permissions;

  // Custom role stored in DB — look up by shopId
  try {
    let shopId = knownShopId;
    if (!shopId) {
      const shop = await Shop.findOne({ owner: ownerId }).select('_id');
      if (!shop) return [];
      shopId = shop._id;
    }
    const roleDoc = await Role.findOne({ shopId, name: roleName }).select('permissions');
    return roleDoc ? roleDoc.permissions : [];
  } catch {
    return [];
  }
}

module.exports = { protect };
