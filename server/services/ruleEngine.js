/**
 * Rule Engine — Patch 9
 *
 * Evaluates business rules against current shop data and creates/updates
 * Notifications and Tasks in the database.
 *
 * All public functions are fire-and-forget safe — they catch their own errors
 * so they never crash the calling request.
 */

const Notification = require('../models/notificationModel');
const Task         = require('../models/taskModel');
const AuditLog     = require('../models/auditLogModel');
const Product      = require('../models/productModel');
const Sale         = require('../models/salesModel');
const Customer     = require('../models/customerModel');
const { getRulesFor } = require('./businessRules');

// Lazily require AMC to avoid circular dependency risks
const getAMCModel = () => require('../models/amcModel');

// ─── Upsert helpers ──────────────────────────────────────────────────────────

async function upsertNotification(shopId, notifData) {
  const { dedupeKey, ...rest } = notifData;
  if (!dedupeKey) {
    return Notification.create({ shopId, ...rest }).catch(() => {});
  }
  return Notification.findOneAndUpdate(
    { shopId, dedupeKey },
    { $set: { shopId, dedupeKey, ...rest } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).catch(() => {});
}

async function upsertTask(shopId, taskData) {
  const { dedupeKey, ...rest } = taskData;
  if (!dedupeKey) {
    return Task.create({ shopId, ...rest }).catch(() => {});
  }
  // Only create if no active task with the same dedupeKey already exists
  const existing = await Task.exists({
    shopId, dedupeKey, status: { $in: ['pending', 'in_progress'] },
  }).catch(() => false);
  if (existing) return null;
  return Task.create({ shopId, dedupeKey, ...rest }).catch(() => {});
}

// ─── Rule evaluation ─────────────────────────────────────────────────────────

async function runInventoryRules(shopId, businessType) {
  const rules = getRulesFor(businessType, 'inventory_scan');
  if (!rules.length) return;

  const products = await Product.find({ shop: shopId, isActive: true })
    .select('_id name quantity unit low_stock_threshold metadata expiry_date')
    .lean();

  const ops = [];
  for (const rule of rules) {
    for (const product of products) {
      try {
        if (!rule.check(product)) continue;
        const dedupeKey = rule.getDedupeKey(product);
        ops.push(upsertNotification(shopId, { ...rule.buildNotification(product), dedupeKey }));
        if (rule.buildTask) {
          ops.push(upsertTask(shopId, {
            ...rule.buildTask(product),
            dedupeKey: `task:${dedupeKey}`,
            priority:  rule.buildNotification(product).priority,
          }));
        }
      } catch (_) { /* rule error — skip silently */ }
    }
  }
  await Promise.allSettled(ops);
}

async function runWorkflowRules(shopId, businessType) {
  const rules = getRulesFor(businessType, 'workflow_scan');
  if (!rules.length) return;

  // Scan last 7 days of non-terminal sales
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sales = await Sale.find({ shop: shopId, createdAt: { $gte: cutoff } })
    .select('_id invoice_number buyer_name extra_fields createdAt total_amount')
    .lean();

  const ops = [];
  for (const rule of rules) {
    for (const sale of sales) {
      try {
        if (!rule.check(sale)) continue;
        const dedupeKey = rule.getDedupeKey(sale);
        ops.push(upsertNotification(shopId, { ...rule.buildNotification(sale), dedupeKey }));
        if (rule.buildTask) {
          ops.push(upsertTask(shopId, {
            ...rule.buildTask(sale),
            dedupeKey: `task:${dedupeKey}`,
            priority:  rule.buildNotification(sale).priority,
          }));
        }
      } catch (_) { /* rule error — skip silently */ }
    }
  }
  await Promise.allSettled(ops);
}

async function runCustomerRules(shopId, businessType) {
  const rules = getRulesFor(businessType, 'customer_scan');
  if (!rules.length) return;

  const customers = await Customer.find({ shop: shopId, isActive: true, totalUdhaar: { $gt: 0 } })
    .select('_id name totalUdhaar totalPaid last_payment_date customer_type createdAt')
    .lean();

  const ops = [];
  for (const rule of rules) {
    for (const customer of customers) {
      try {
        if (!rule.check(customer)) continue;
        const dedupeKey = rule.getDedupeKey(customer);
        ops.push(upsertNotification(shopId, { ...rule.buildNotification(customer), dedupeKey }));
        if (rule.buildTask) {
          ops.push(upsertTask(shopId, {
            ...rule.buildTask(customer),
            dedupeKey: `task:${dedupeKey}`,
            priority:  rule.buildNotification(customer).priority,
          }));
        }
      } catch (_) { /* rule error — skip silently */ }
    }
  }
  await Promise.allSettled(ops);
}

async function runAmcRules(shopId, businessType) {
  if (businessType !== 'electronics') return;
  try {
    const AMC = getAMCModel();
    const now    = new Date();
    const in30   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const amcs   = await AMC.find({
      shop: shopId,
      status: 'active',
      amc_end_date: { $lte: in30 },
    }).select('_id amc_number customer_name product_name amc_end_date customer_phone').lean();

    const ops = [];
    for (const amc of amcs) {
      const daysLeft = Math.ceil((new Date(amc.amc_end_date) - now) / 86400000);
      const isExpired = daysLeft <= 0;
      const type = isExpired ? 'amc_expired' : 'amc_expiring';
      const priority = isExpired ? 'high' : (daysLeft <= 7 ? 'high' : 'medium');

      const notif = {
        type,
        priority,
        title: isExpired
          ? `Lapsed AMC: ${amc.customer_name}`
          : `AMC Expiring in ${daysLeft} day${daysLeft === 1 ? '' : 's'}: ${amc.customer_name}`,
        message: isExpired
          ? `AMC for ${amc.product_name} (${amc.amc_number}) has expired. Contact customer to renew.`
          : `AMC for ${amc.product_name} expires on ${new Date(amc.amc_end_date).toLocaleDateString()}. Reach out to renew.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'amc', id: String(amc._id), name: amc.amc_number },
        dedupeKey: `${type}:${amc._id}`,
      };
      ops.push(upsertNotification(shopId, notif));

      if (!isExpired) {
        ops.push(upsertTask(shopId, {
          title: `Renew AMC for ${amc.customer_name}`,
          description: `AMC ${amc.amc_number} for ${amc.product_name} expires in ${daysLeft} days. Call ${amc.customer_phone || 'customer'} to renew.`,
          assignedTo: 'manager',
          priority,
          relatedEntity: { type: 'amc', id: String(amc._id), name: amc.amc_number },
          dedupeKey: `task:amc_renew:${amc._id}`,
        }));
      }
    }
    await Promise.allSettled(ops);
  } catch (_) { /* never propagate */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Full shop scan — called on dashboard load.
 * Fire-and-forget: does NOT affect the calling request.
 */
async function scanShop(shopId, businessType = 'general') {
  try {
    await Promise.allSettled([
      runInventoryRules(shopId, businessType),
      runWorkflowRules(shopId, businessType),
      runCustomerRules(shopId, businessType),
      runAmcRules(shopId, businessType),
    ]);
  } catch (_) { /* never propagate */ }
}

/**
 * Handle specific business events emitted from controllers.
 * Used to auto-resolve notifications when conditions clear.
 */
async function handleEvent(event, payload = {}) {
  const { shopId, businessType, productId, newQuantity, saleId, newStage } = payload;
  try {
    switch (event) {
      case 'STOCK_UPDATED': {
        if (!productId) break;
        const threshold = payload.threshold ?? 5;
        if (newQuantity > threshold) {
          // Condition cleared — resolve low_stock/out_of_stock notifications + tasks
          await Promise.all([
            Notification.deleteMany({ shopId, dedupeKey: { $in: [`low_stock:${productId}`, `out_of_stock:${productId}`] } }),
            Task.updateMany(
              { shopId, dedupeKey: { $in: [`task:low_stock:${productId}`, `task:out_of_stock:${productId}`] }, status: 'pending' },
              { $set: { status: 'completed', completedAt: new Date(), completedBy: 'system (stock restored)' } }
            ),
          ]).catch(() => {});
        }
        // Re-run inventory rules (non-blocking)
        if (shopId && businessType) runInventoryRules(shopId, businessType).catch(() => {});
        break;
      }

      case 'WORKFLOW_ADVANCED': {
        if (!saleId) break;
        const terminalStages = ['completed', 'paid', 'delivered', 'done'];
        if (terminalStages.includes(newStage)) {
          // Condition cleared — auto-resolve workflow delay notifications + tasks
          await Promise.all([
            Notification.deleteMany({ shopId, 'relatedEntity.id': String(saleId), type: 'workflow_delay' }),
            Task.updateMany(
              { shopId, 'relatedEntity.id': String(saleId), status: { $in: ['pending', 'in_progress'] } },
              { $set: { status: 'completed', completedAt: new Date(), completedBy: 'system (stage completed)' } }
            ),
          ]).catch(() => {});
        }
        break;
      }

      case 'INVOICE_CREATED':
        // No auto-resolution needed; rules will fire on next scan
        break;

      default:
        break;
    }
  } catch (_) { /* never propagate */ }
}

/**
 * Write an audit log entry — lightweight, never throws.
 */
async function createAuditLog({ shopId, userId, username, action, entity, entityId, entityName, details }) {
  try {
    await AuditLog.create({ shopId, userId, username, action, entity, entityId, entityName, details });
  } catch (_) { /* audit failures must never break main flow */ }
}

// ─── Cross-shop scheduled runners ────────────────────────────────────────────

async function runCustomerDuesRules() {
  try {
    const Shop = require('../models/shopModel');
    const shops = await Shop.find({ isActive: true }).select('_id businessType').lean();
    for (const shop of shops) {
      await runCustomerRules(shop._id, shop.businessType || 'general').catch(() => {});
    }
  } catch (_) {}
}

async function runAMCExpiryRules() {
  try {
    const Shop = require('../models/shopModel');
    const shops = await Shop.find({ isActive: true }).select('_id businessType').lean();
    for (const shop of shops) {
      await runAmcRules(shop._id, shop.businessType || 'general').catch(() => {});
    }
  } catch (_) {}
}

module.exports = { scanShop, handleEvent, createAuditLog, runCustomerDuesRules, runAMCExpiryRules };
