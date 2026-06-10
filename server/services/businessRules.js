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
        note: 'action_restock',
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
      note: 'action_restock',
      relatedEntity: { type: 'product', id: String(product._id), name: product.name },
    }),
  },
];

/**
 * Per-business-type rules — layered on top of universal rules.
 * Keys match Shop.businessType values.
 */
const BUSINESS_RULES = {

  electronics: [
    {
      id: 'electronics_slow_moving_highvalue',
      on: 'inventory_scan',
      check: (product) => {
        if (product.price < 10000 || product.quantity <= 0) return false;
        const lastSaleDate = product.metadata?.last_sale_date;
        if (!lastSaleDate) return false;
        return (Date.now() - new Date(lastSaleDate)) > 45 * 24 * 60 * 60 * 1000;
      },
      getDedupeKey: (product) => `elec_slow_hv:${product._id}`,
      buildNotification: (product) => ({
        type: 'slow_moving_highvalue',
        priority: 'high',
        title: `High-Value Dead Stock: ${product.name}`,
        message: `₹${Number(product.price).toLocaleString('en-IN')} item has not sold in 45+ days. Consider display demo, price adjustment, or return to supplier.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: (product) => ({
        title: `Review slow-moving: ${product.name}`,
        description: `High-value item (₹${Number(product.price).toLocaleString('en-IN')}) unsold for 45+ days. Check if demo conversion or price drop can help.`,
        assignedTo: 'manager',
        priority: 'high',
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
    },
    {
      id: 'electronics_demo_unit_aging',
      on: 'inventory_scan',
      check: (product) => {
        const isDemo = (product.category || '').toLowerCase().includes('demo') ||
                       (product.sub_category || '').toLowerCase().includes('demo') ||
                       product.metadata?.is_demo === true || product.metadata?.is_demo === 'true';
        if (!isDemo || product.quantity <= 0) return false;
        const lastSaleDate = product.metadata?.last_sale_date;
        const referenceDate = lastSaleDate || product.createdAt;
        if (!referenceDate) return false;
        return (Date.now() - new Date(referenceDate)) > 30 * 24 * 60 * 60 * 1000;
      },
      getDedupeKey: (product) => `demo_aging:${product._id}`,
      buildNotification: (product) => ({
        type: 'demo_aging',
        priority: 'medium',
        title: `Demo Unit Sitting: ${product.name}`,
        message: `Demo unit has been in stock 30+ days without a sale. Mark it sold-as-demo or reduce price to clear it.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: null,
    },
    {
      id: 'electronics_accessory_restock',
      on: 'inventory_scan',
      check: (product) => {
        const accessoryCategories = ['charger', 'earphone', 'cable', 'cover', 'case', 'screen guard', 'adapter'];
        const cat = (product.category || '').toLowerCase();
        const isAccessory = accessoryCategories.some(a => cat.includes(a));
        return isAccessory && product.quantity <= 5;
      },
      getDedupeKey: (product) => `accessory_restock:${product._id}`,
      buildNotification: (product) => ({
        type: 'accessory_low_stock',
        priority: 'medium',
        title: `Accessory Running Low: ${product.name}`,
        message: `Only ${product.quantity} left. Accessories sell quickly alongside handset sales — reorder now.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: null,
    },
    {
      id: 'electronics_imei_dead_stock',
      on: 'inventory_scan',
      check: (product) => {
        if (product.quantity <= 0) return false;
        const isPhone = (product.category || '').toLowerCase().includes('mobile') ||
                        (product.category || '').toLowerCase().includes('phone') ||
                        (product.category || '').toLowerCase().includes('smartphone') ||
                        product.metadata?.serial_tracking === true;
        if (!isPhone) return false;
        const lastSaleDate = product.metadata?.last_sale_date;
        if (!lastSaleDate) return false;
        return (Date.now() - new Date(lastSaleDate)) > 120 * 24 * 60 * 60 * 1000;
      },
      getDedupeKey: (product) => `imei_dead:${product._id}`,
      buildNotification: (product) => ({
        type: 'imei_dead_stock',
        priority: 'high',
        title: `IMEI Unit Stuck in Stock: ${product.name}`,
        message: `${product.quantity} unit(s) unsold for 120+ days. Check for dead stock, damage, or model discontinuation.`,
        forRoles: ['owner'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: (product) => ({
        title: `Dead stock review: ${product.name}`,
        description: `${product.quantity} unit(s) stuck in stock 120+ days. Verify IMEI units are intact and consider discount or return to distributor.`,
        assignedTo: 'owner',
        priority: 'high',
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
    },
    {
      id: 'warranty_sla_breach',
      on: 'workflow_scan',
      check: (sale) => {
        const status = sale.extra_fields?.workflow_status || sale.extra_fields?.get?.('workflow_status');
        if (!status || ['completed', 'delivered', 'done', 'paid'].includes(status)) return false;
        const daysSinceCreated = (Date.now() - new Date(sale.createdAt)) / 86400000;
        return daysSinceCreated > 7;
      },
      getDedupeKey: (sale) => `warranty_sla:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'sla_breach',
        priority: 'high',
        title: `Warranty SLA Breach: ${sale.buyer_name || sale.invoice_number}`,
        message: `Warranty/service case open ${Math.floor((Date.now() - new Date(sale.createdAt)) / 86400000)} days — escalate to brand service immediately.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `SLA Breach: ${sale.invoice_number}`,
        description: `Warranty case exceeds 7-day SLA. Follow up with brand service center and update customer.`,
        assignedTo: 'manager',
        priority: 'high',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  hardware: [
    {
      id: 'slow_moving_stock',
      on: 'inventory_scan',
      check: (product) => {
        const lastSaleDate = product.metadata?.last_sale_date;
        if (!lastSaleDate || product.quantity <= 0) return false;
        return (Date.now() - new Date(lastSaleDate)) > 90 * 24 * 60 * 60 * 1000;
      },
      getDedupeKey: (product) => `slow_moving:${product._id}`,
      buildNotification: (product) => ({
        type: 'slow_moving',
        priority: 'medium',
        title: `Slow-Moving Stock: ${product.name}`,
        message: `${product.name} has ${product.quantity} units unsold for 90+ days. Consider a discount or return to supplier.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: null,
    },
    {
      id: 'contractor_dues_aging',
      on: 'customer_scan',
      check: (customer) => {
        if (!customer.totalUdhaar || customer.totalUdhaar <= 0) return false;
        const since = customer.last_payment_date || customer.createdAt;
        return (Date.now() - new Date(since)) > 30 * 24 * 60 * 60 * 1000;
      },
      getDedupeKey: (customer) => `dues_aging:${customer._id}`,
      buildNotification: (customer) => ({
        type: 'dues_aging',
        priority: customer.totalUdhaar > 50000 ? 'high' : 'medium',
        title: `Contractor dues pending: ${customer.name}`,
        message: `₹${Number(customer.totalUdhaar).toLocaleString('en-IN')} outstanding from ${customer.name} for 30+ days.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'customer', id: String(customer._id), name: customer.name },
      }),
      buildTask: (customer) => ({
        title: `Follow up: ${customer.name} dues`,
        description: `₹${Number(customer.totalUdhaar).toLocaleString('en-IN')} outstanding. Call or send WhatsApp reminder.`,
        assignedTo: 'owner',
        priority: 'high',
        relatedEntity: { type: 'customer', id: String(customer._id), name: customer.name },
      }),
    },
    {
      id: 'cement_seasonal_alert',
      on: 'inventory_scan',
      check: (product) => {
        const isCement = (product.category || '').toLowerCase().includes('cement');
        const month = new Date().getMonth(); // Jan=0…May=4 (construction season Feb–Jun)
        return isCement && month >= 1 && month <= 4 && product.quantity < 50;
      },
      getDedupeKey: (product) => `seasonal:cement:${product._id}`,
      buildNotification: (product) => ({
        type: 'seasonal_restock',
        priority: 'medium',
        title: `Season Alert: Low cement stock`,
        message: `Construction season starting. ${product.name} stock is ${product.quantity} bags — reorder now before prices rise.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: null,
    },
  ],

  general: [],
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
