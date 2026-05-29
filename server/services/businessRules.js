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

  // ─── PHARMACY ───────────────────────────────────────────────────
  pharmacy: [
    {
      id: 'expiry_warning',
      on: 'inventory_scan',
      check: (product) => {
        const d = daysUntil(getExpiryDate(product));
        return d > 0 && d <= 30;
      },
      getDedupeKey: (product) => `expiry_warning:${product._id}`,
      buildNotification: (product) => {
        const d = daysUntil(getExpiryDate(product));
        const expStr = new Date(getExpiryDate(product)).toLocaleDateString('en-IN');
        return {
          type: 'expiry_warning',
          priority: d <= 7 ? 'critical' : 'high',
          title: `Expiry Alert: ${product.name}`,
          message: `Expires in ${d} day${d !== 1 ? 's' : ''} (${expStr}). Remove from dispensing shelf.`,
          forRoles: ['owner', 'manager'],
          relatedEntity: { type: 'product', id: String(product._id), name: product.name },
        };
      },
      buildTask: null,
    },
    {
      id: 'expired_medicine',
      on: 'inventory_scan',
      check: (product) => {
        const expiry = getExpiryDate(product);
        return expiry && new Date(expiry) < new Date();
      },
      getDedupeKey: (product) => `expired:${product._id}`,
      buildNotification: (product) => ({
        type: 'expired',
        priority: 'critical',
        title: `EXPIRED: ${product.name}`,
        message: `This medicine has expired! Remove all units from stock immediately to prevent patient harm.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: (product) => ({
        title: `Remove Expired Medicine: ${product.name}`,
        description: `Expired medicine in stock. Remove all units from the dispensing shelf immediately.`,
        assignedTo: 'manager',
        priority: 'critical',
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
    },
    {
      id: 'pending_prescription_stale',
      on: 'workflow_scan',
      check: (sale) => getWorkflowStatus(sale) === 'pending' && hoursElapsed(sale.createdAt) > 2,
      getDedupeKey: (sale) => `pending_rx:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'medium',
        title: `Prescription Pending: ${sale.buyer_name || 'Customer'}`,
        message: `Bill ${sale.invoice_number} has been pending for over 2 hours. Validate or dispense.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `Validate Prescription: ${sale.invoice_number}`,
        description: `Pending over 2 hours. Pharmacist review and validation required.`,
        assignedTo: 'manager',
        priority: 'medium',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  // ─── RESTAURANT ─────────────────────────────────────────────────
  restaurant: [
    {
      id: 'order_waiting_too_long',
      on: 'workflow_scan',
      check: (sale) => {
        const s = getWorkflowStatus(sale);
        return ['pending', 'cooking'].includes(s) && minutesElapsed(sale.createdAt) > 30;
      },
      getDedupeKey: (sale) => `order_waiting:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'high',
        title: `Order Delayed: ${sale.invoice_number}`,
        message: `${sale.buyer_name ? sale.buyer_name + "'s order" : 'Order'} ${sale.invoice_number} has been waiting ${Math.round(minutesElapsed(sale.createdAt))} minutes. Check kitchen status.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: null,
    },
    {
      id: 'table_occupied_too_long',
      on: 'workflow_scan',
      check: (sale) => {
        const s = getWorkflowStatus(sale);
        return s === 'served' && minutesElapsed(sale.createdAt) > 90;
      },
      getDedupeKey: (sale) => `table_long:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'medium',
        title: `Table Occupied Long`,
        message: `${sale.buyer_name || 'Guest'} (${sale.invoice_number}) has been served but not billed in over 90 minutes.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `Close Bill: ${sale.invoice_number}`,
        description: `Table occupied 90+ minutes post-service. Present bill and collect payment.`,
        assignedTo: 'cashier',
        priority: 'medium',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  // ─── SALON ──────────────────────────────────────────────────────
  salon: [
    {
      id: 'appointment_overdue',
      on: 'workflow_scan',
      check: (sale) => getWorkflowStatus(sale) === 'scheduled' && hoursElapsed(sale.createdAt) > 24,
      getDedupeKey: (sale) => `appt_overdue:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'medium',
        title: `Appointment Overdue`,
        message: `${sale.buyer_name || 'Client'}'s appointment ${sale.invoice_number} is scheduled but not started for 24+ hours.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `Follow Up: ${sale.buyer_name || sale.invoice_number}`,
        description: `Appointment not started for 24+ hours. Contact client to reschedule or cancel.`,
        assignedTo: 'cashier',
        priority: 'medium',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  // ─── AUTOMOBILE ─────────────────────────────────────────────────
  automobile: [
    {
      id: 'repair_delayed',
      on: 'workflow_scan',
      check: (sale) => {
        const s = getWorkflowStatus(sale);
        return ['inspection', 'repairing'].includes(s) && hoursElapsed(sale.createdAt) > 48;
      },
      getDedupeKey: (sale) => `repair_delayed:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'high',
        title: `Job Card Delayed: ${sale.invoice_number}`,
        message: `Repair for ${sale.buyer_name || 'vehicle'} (${sale.invoice_number}) has been open for ${Math.round(hoursElapsed(sale.createdAt))}h. Customer update recommended.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `Update Customer: ${sale.buyer_name || sale.invoice_number}`,
        description: `Job card open for 48+ hours. Call customer with status update and ETA.`,
        assignedTo: 'manager',
        priority: 'high',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  // ─── REPAIR SHOP ────────────────────────────────────────────────
  repair_shop: [
    {
      id: 'repair_delayed',
      on: 'workflow_scan',
      check: (sale) => {
        const s = getWorkflowStatus(sale);
        return ['received', 'diagnosing', 'repairing'].includes(s) && hoursElapsed(sale.createdAt) > 72;
      },
      getDedupeKey: (sale) => `repair_delayed:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'high',
        title: `Repair Delayed: ${sale.invoice_number}`,
        message: `Repair job ${sale.invoice_number} has been open for ${Math.round(hoursElapsed(sale.createdAt))}h. Customer update required.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `Customer Update: ${sale.buyer_name || sale.invoice_number}`,
        description: `Repair job open > 72 hours. Call customer with status or delivery estimate.`,
        assignedTo: 'manager',
        priority: 'high',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  // ─── SERVICE CENTER ─────────────────────────────────────────────
  service_center: [
    {
      id: 'service_delayed',
      on: 'workflow_scan',
      check: (sale) => {
        const s = getWorkflowStatus(sale);
        return ['logged', 'in_service', 'testing'].includes(s) && hoursElapsed(sale.createdAt) > 72;
      },
      getDedupeKey: (sale) => `service_delayed:${sale._id}`,
      buildNotification: (sale) => ({
        type: 'workflow_delay',
        priority: 'high',
        title: `Service Delayed: ${sale.invoice_number}`,
        message: `Service job ${sale.invoice_number} open for ${Math.round(hoursElapsed(sale.createdAt))}h. SLA breach risk.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
      buildTask: (sale) => ({
        title: `Escalate Service: ${sale.invoice_number}`,
        description: `Service job > 72 hours. Escalate to manager and update customer with resolution ETA.`,
        assignedTo: 'manager',
        priority: 'high',
        relatedEntity: { type: 'sale', id: String(sale._id), name: sale.invoice_number },
      }),
    },
  ],

  // ─── BAKERY ─────────────────────────────────────────────────────
  bakery: [
    {
      id: 'freshness_ending',
      on: 'inventory_scan',
      check: (product) => {
        const d = daysUntil(getExpiryDate(product));
        return d >= 0 && d <= 1;
      },
      getDedupeKey: (product) => `freshness_ending:${product._id}`,
      buildNotification: (product) => ({
        type: 'expiry_warning',
        priority: 'high',
        title: `Freshness Alert: ${product.name}`,
        message: `${product.name} freshness ends within 24 hours. Apply discount or remove from display.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: (product) => ({
        title: `Mark Down: ${product.name}`,
        description: `Freshness ending within 24h. Apply discount or move to day-end clearance.`,
        assignedTo: 'manager',
        priority: 'high',
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
    },
  ],

  // ─── SWEET SHOP ─────────────────────────────────────────────────
  sweet_shop: [
    {
      id: 'shelf_life_ending',
      on: 'inventory_scan',
      check: (product) => {
        const d = daysUntil(getExpiryDate(product));
        return d >= 0 && d <= 2;
      },
      getDedupeKey: (product) => `shelf_life_ending:${product._id}`,
      buildNotification: (product) => ({
        type: 'expiry_warning',
        priority: 'high',
        title: `Shelf Life Alert: ${product.name}`,
        message: `${product.name} shelf life ends within 48 hours. Apply discount or remove from display.`,
        forRoles: ['owner', 'manager'],
        relatedEntity: { type: 'product', id: String(product._id), name: product.name },
      }),
      buildTask: null,
    },
  ],

  // ─── CLOTHING ───────────────────────────────────────────────────
  clothing: [
    // Universal low_stock already covers variant-level stock
    // Future: exchange request pending task can be added here
  ],

  // ─── ELECTRONICS / MOBILE SHOP ──────────────────────────────────
  electronics: [],
  mobile_shop: [],

  // ─── GENERAL / KIRANA / GROCERY / HARDWARE / RETAIL ─────────────
  general:  [],
  kirana:   [],
  grocery:  [],
  hardware: [],
  retail:   [],
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
