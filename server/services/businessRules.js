/**
 * Business Rules Engine — Patch 9
 *
 * Rules are pure data objects — no side effects, no DB calls.
 * Each rule declares:
 *   id            — unique identifier for deduplication
 *   on            — trigger ('inventory_scan' | 'workflow_scan')
 *   check(data)   — pure boolean: should this rule fire?
 *   getDedupeKey  — unique key to prevent duplicate alerts
 *   buildNotification — returns notification object
 *   buildTask     — optional, returns task object (null = no task)
 *
 * NOTE: rules run against lean() Mongoose documents.
 * - metadata is a plain object (not Map), access as product.metadata?.key
 * - extra_fields is a plain object, access as sale.extra_fields?.workflow_status
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}

function hoursElapsed(createdAt) {
  return (Date.now() - new Date(createdAt)) / 3600000;
}

function minutesElapsed(createdAt) {
  return (Date.now() - new Date(createdAt)) / 60000;
}

function getWorkflowStatus(sale) {
  const ef = sale.extra_fields;
  if (!ef) return null;
  if (ef instanceof Map) return ef.get('workflow_status');
  return ef.workflow_status || null;
}

function getExpiryDate(product) {
  // Check metadata first (pharmacy batch, bakery, etc.), then top-level field
  return product.metadata?.expiry_date || product.expiry_date || null;
}

// ─── Rule Sets ──────────────────────────────────────────────────────────────

/**
 * Universal rules — apply to ALL business types
 */
const UNIVERSAL_RULES = [
  {
    id: 'low_stock',
    on: 'inventory_scan',
    check: (product) => {
      const threshold = product.low_stock_threshold ?? 5;
      return product.quantity > 0 && product.quantity <= threshold;
    },
    getDedupeKey: (product) => `low_stock:${product._id}`,
    buildNotification: (product) => {
      const threshold = product.low_stock_threshold ?? 5;
      const isCritical = product.quantity <= Math.max(1, Math.floor(threshold / 2));
      return {
        type: 'low_stock',
        priority: isCritical ? 'high' : 'medium',
        title: `Low Stock: ${product.name}`,
        message: `Only ${product.quantity} ${product.unit || 'units'} remaining (threshold: ${threshold}). Place a reorder.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      };
    },
    buildTask: (product) => {
      const threshold = product.low_stock_threshold ?? 5;
      return {
        title: `Restock: ${product.name}`,
        description: `Current stock: ${product.quantity} ${product.unit || 'units'} — below threshold of ${threshold}. Create a purchase order.`,
        assignedTo: 'manager',
        priority: 'medium',
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      };
    },
  },
  {
    id: 'out_of_stock',
    on: 'inventory_scan',
    check: (product) => product.quantity <= 0,
    getDedupeKey: (product) => `out_of_stock:${product._id}`,
    buildNotification: (product) => ({
      type: 'out_of_stock',
      priority: 'high',
      title: `Out of Stock: ${product.name}`,
      message: `${product.name} is completely out of stock. Sales will be blocked until restocked.`,
      forRoles: ['owner', 'manager'],
      relatedEntity: { type: 'product', id: String(product._id), name: product.name },
    }),
    buildTask: (product) => ({
      title: `Urgent Restock: ${product.name}`,
      description: `Out of stock! Create a purchase order immediately to resume sales.`,
      assignedTo: 'manager',
      priority: 'high',
      relatedEntity: { type: 'product', id: String(product._id), name: product.name },
    }),
  },
];

/**
 * Per-business-type rules — layered on top of universal rules.
 * Keys match Shop.businessType values.
 */
const BUSINESS_RULES = {

  electronics: [],
  hardware:    [],
  general:     [],
};

/**
 * Get all applicable rules for a business type and trigger.
 * Always includes universal rules.
 */
function getRulesFor(businessType, trigger) {
  const universal = UNIVERSAL_RULES.filter(r => r.on === trigger);
  const specific  = (BUSINESS_RULES[businessType] || []).filter(r => r.on === trigger);
  return [...universal, ...specific];
}

module.exports = { getRulesFor };
