const Shop = require('../models/shopModel');
const User = require('../models/userModel');
const Sale = require('../models/salesModel');
const Purchase = require('../models/purchaseModel');
const Product = require('../models/productModel');
const Customer = require('../models/customerModel');
const Supplier = require('../models/supplierModel');
const Udhaar = require('../models/udhaarModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const Expense = require('../models/expenseModel');
const SubscriptionPayment = require('../models/subscriptionPaymentModel');
const DocumentSequence = require('../models/documentSequenceModel');
const {
  ensureTrialDates,
  getAdminSubscriptionStatus,
  mapPlanToSubscriptionType,
  syncSubscriptionState,
} = require('../services/subscriptionService');
const { calculateDaysRemaining } = require('../utils/subscriptionUtils');

const formatPlanLabel = (type) => {
  if (type === 'monthly') return 'Monthly';
  if (type === '6months') return '6 Months';
  if (type === 'yearly') return 'Yearly';
  return 'Trial';
};

const buildAddress = (shop) => {
  return [
    shop.address,
    shop.city,
    shop.state,
    shop.pincode,
  ].filter(Boolean).join(', ');
};

const serializeAdminShop = async (shopDoc) => {
  const owner = shopDoc.owner;
  ensureTrialDates(owner);
  if (syncSubscriptionState(owner) || owner.isModified()) {
    await owner.save();
  }

  const status = getAdminSubscriptionStatus(owner);
  const trialDaysRemaining = calculateDaysRemaining(owner.trialEndDate);
  const subscriptionDaysRemaining = calculateDaysRemaining(owner.subscriptionEndDate);
  const subscriptionType = owner.subscriptionType || (owner.subscriptionPlan ? mapPlanToSubscriptionType(owner.subscriptionPlan) : 'trial');

  return {
    id: shopDoc._id,
    shopName: shopDoc.name || 'My Shop',
    ownerName: owner.name || '',
    phoneNumber: shopDoc.phone || '',
    gstin: shopDoc.gstin || '',
    shopAddress: buildAddress(shopDoc),
    subscriptionType,
    subscriptionPlanLabel: formatPlanLabel(subscriptionType),
    subscriptionStatus: status,
    highlight:
      status === 'expired'
        ? 'expired'
        : status === 'trial' && trialDaysRemaining > 0 && trialDaysRemaining <= 3
          ? 'trial-ending'
          : status === 'active'
            ? 'active'
            : 'default',
    alerts: {
      trialEndingSoon: status === 'trial' && trialDaysRemaining > 0 && trialDaysRemaining <= 3,
      expired: status === 'expired',
      highValueCustomer: subscriptionType === 'yearly',
    },
    trial: {
      startDate: owner.trialStartDate,
      endDate: owner.trialEndDate,
      daysRemaining: trialDaysRemaining,
    },
    subscription: {
      startDate: owner.subscriptionStartDate,
      endDate: owner.subscriptionEndDate,
      daysRemaining: subscriptionDaysRemaining,
    },
    createdAt: shopDoc.createdAt,
    updatedAt: shopDoc.updatedAt,
  };
};

const listAdminShops = async (req, res) => {
  try {
    const { status = 'all', search = '' } = req.query;
    const shops = await Shop.find({})
      .populate('owner')
      .sort({ createdAt: -1 });

    const mapped = [];
    for (const shop of shops) {
      if (!shop.owner) continue;
      mapped.push(await serializeAdminShop(shop));
    }

    const searchValue = String(search).trim().toLowerCase();
    const filtered = mapped.filter((shop) => {
      const matchesStatus = status === 'all' || shop.subscriptionStatus === status;
      const matchesSearch = !searchValue
        || shop.shopName.toLowerCase().includes(searchValue)
        || shop.phoneNumber.toLowerCase().includes(searchValue);

      return matchesStatus && matchesSearch;
    });

    res.json({
      shops: filtered,
      total: filtered.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const shops = await Shop.find({})
      .populate('owner')
      .sort({ createdAt: -1 });

    const mapped = [];
    for (const shop of shops) {
      if (!shop.owner) continue;
      mapped.push(await serializeAdminShop(shop));
    }

    const stats = mapped.reduce((acc, shop) => {
      acc.totalUsers += 1;
      if (shop.subscriptionStatus === 'active') acc.activeSubscriptions += 1;
      if (shop.subscriptionStatus === 'trial') acc.trialUsers += 1;
      if (shop.subscriptionStatus === 'expired') acc.expiredUsers += 1;
      if (shop.alerts.trialEndingSoon) acc.trialsEndingSoon += 1;
      return acc;
    }, {
      totalUsers: 0,
      activeSubscriptions: 0,
      trialUsers: 0,
      expiredUsers: 0,
      trialsEndingSoon: 0,
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAdminShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id).populate('owner');
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found.' });
    }

    const ownerId = shop.owner?._id;
    const shopId = shop._id;

    await Sale.deleteMany({ shop: shopId });
    await Purchase.deleteMany({ shop: shopId });
    await Product.deleteMany({ shop: shopId });
    await Customer.deleteMany({ shop: shopId });
    await Supplier.deleteMany({ shop: shopId });
    await Udhaar.deleteMany({ shop: shopId });
    await SupplierUdhaar.deleteMany({ shop: shopId });
    await Expense.deleteMany({ shop: shopId });
    await DocumentSequence.deleteMany({ shop: shopId });
    await Shop.deleteOne({ _id: shopId });

    if (ownerId) {
      await SubscriptionPayment.deleteMany({ user: ownerId });
      await User.deleteOne({ _id: ownerId });
    }

    res.json({ message: 'User account and shop data removed successfully.', deletedShopId: String(shopId) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listAdminShops,
  getAdminStats,
  deleteAdminShop,
};
