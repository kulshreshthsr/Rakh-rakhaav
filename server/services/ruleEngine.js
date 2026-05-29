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
const { getRulesFor } = require('./businessRules');

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

module.exports = { scanShop, handleEvent, createAuditLog };
