export default {
  // Entity labels
  product:        'Service / Part',
  products:       'Services & Parts',
  productHindi:   'सर्विस',
  item:           'Service',
  items:          'Services',
  inventory:      'Parts & Services',

  // Transactions
  invoice:        'Job Card',
  invoices:       'Job Cards',
  sale:           'Repair Job',
  sales:          'Repair Jobs',

  // Actions
  addProduct:     'Add Service / Part',
  newSale:        'New Repair Job',
  newPurchase:    'New Purchase',
  editSale:       'Edit Repair Job',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search services or parts by name...',
  searchCustomer: 'Search customer name or phone...',
  searchSale:     'Search job card, customer, item...',
  searchPurchase: 'Search purchase, supplier...',

  // Empty states
  noProducts:   'No services or parts added yet.',
  noSales:      'No repair jobs yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  customerSection: 'Customer Info',
  itemsSection:    'Services',

  // Directory pages
  backToSales:     'Back to Repair Jobs',
  backToPurchases: 'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Repair Job',
  quickNewSaleHindi:  'Job Card बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Service',
  quickAddStockHindi: 'Service जोड़ो',

  // KPIs
  kpiInvoices:      'Job Cards',
  kpiTotalProducts: 'Services & Parts',
  kpiRecentSales:   'Recent Repairs',

  entityType: 'service',

  formSectionLabels: {
    basics:  'Service / Part Information',
    pricing: 'Rate & Price',
    stock:   'Parts Availability',
    tax:     'GST / SAC Code',
  },

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Service / Part Name',
    descriptionLabel: 'Description / Notes',
    trackQuantity:    true,
    showBarcode:      false,
    unitOptions:      ['Piece', 'Service', 'Hour', 'Set', 'Pair', 'Litre'],
    attributesTitle:  'Service Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: false,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'service_type', label: 'Type',     type: 'select', options: ['Labour', 'Spare Part', 'Consumable', 'Accessory'] },
    { key: 'brand',        label: 'Brand',    type: 'text',   placeholder: 'Brand / Model' },
    { key: 'compatible',   label: 'Fits',     type: 'text',   placeholder: 'Device or model compatibility' },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [
    { key: 'device_model',   label: 'Device / Model',  type: 'text', placeholder: 'e.g. iPhone 14, Dell Inspiron' },
    { key: 'serial_no',      label: 'Serial / IMEI',   type: 'text', placeholder: 'Device serial number' },
    { key: 'complaint',      label: 'Complaint',        type: 'textarea', placeholder: 'Customer complaint description' },
    { key: 'delivery_date',  label: 'Delivery Date',   type: 'date' },
    { key: 'technician',     label: 'Technician',      type: 'text', placeholder: 'Assigned technician' },
  ],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [],

  productAttributeSections: [
    {
      title: 'Service / Part Details',
      fields: [
        { key: 'service_type', label: 'Type',          type: 'select', options: ['Labour / Service Charge', 'Spare Part', 'Consumable', 'Accessory'] },
        { key: 'brand',        label: 'Brand',          type: 'text',   placeholder: 'Brand / Manufacturer' },
        { key: 'compatible',   label: 'Compatible With',type: 'text',   placeholder: 'Device or model this fits' },
        { key: 'part_no',      label: 'Part Number',    type: 'text',   placeholder: 'OEM or aftermarket part number' },
      ],
    },
    {
      title: 'Warranty',
      fields: [
        { key: 'warranty_on_repair', label: 'Warranty on Service', type: 'select', options: ['No Warranty', '1 Week', '1 Month', '3 Months', '6 Months'] },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'simple',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Service', 'Hour', 'Set', 'Pair', 'Litre'],
    expiryAlertDays: 30,
    stockLabel:   'Parts Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Job',
    saleNounPlural: 'Jobs',
    stages: [
      { id: 'received',   label: 'Received',   color: 'amber',  icon: '📥', terminal: false },
      { id: 'diagnosing', label: 'Diagnosing', color: 'purple', icon: '🔍', terminal: false },
      { id: 'repairing',  label: 'Repairing',  color: 'orange', icon: '🛠️', terminal: false },
      { id: 'ready',      label: 'Ready',      color: 'blue',   icon: '✅', terminal: false },
      { id: 'delivered',  label: 'Delivered',  color: 'green',  icon: '📤', terminal: false },
      { id: 'paid',       label: 'Paid',       color: 'slate',  icon: '💰', terminal: true  },
    ],
    initialStage: 'received',
    transitions: {
      received:   ['diagnosing', 'repairing'],
      diagnosing: ['repairing'],
      repairing:  ['ready'],
      ready:      ['delivered'],
      delivered:  ['paid'],
      paid:       [],
    },
    actions: {
      received:   [{ id: 'diagnose', label: 'Start Diagnosis', icon: '🔍', nextStage: 'diagnosing', color: 'purple' }],
      diagnosing: [{ id: 'repair',   label: 'Start Repair',    icon: '🛠️', nextStage: 'repairing',  color: 'orange' }],
      repairing:  [{ id: 'ready',    label: 'Mark Ready',      icon: '✅', nextStage: 'ready',      color: 'blue'   }],
      ready:      [{ id: 'deliver',  label: 'Mark Delivered',  icon: '📤', nextStage: 'delivered',  color: 'green'  }],
      delivered:  [{ id: 'payment',  label: 'Collect Payment', icon: '💰', nextStage: 'paid',       color: 'slate', triggerInvoice: true }],
      paid:       [],
    },
    dashboardWidgets: [
      { id: 'in_repair',    label: 'In Repair', stages: ['repairing'],             icon: '🛠️', color: 'orange' },
      { id: 'ready',        label: 'Ready',     stages: ['ready'],                 icon: '✅', color: 'blue'   },
      { id: 'pending_jobs', label: 'Pending',   stages: ['received', 'diagnosing'], icon: '📥', color: 'amber'  },
    ],
    quickActions: [
      { id: 'new_job',  label: 'New Job',    labelHindi: 'नया Job',   icon: '🛠️', href: '/sales?open=1',       permission: 'CREATE_INVOICE' },
      { id: 'active',   label: 'Active Jobs', labelHindi: 'Active Jobs', icon: '🔧', href: '/sales?wf=repairing', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '🔨', color: 'blue',
      title: 'Repair Shop Mode Active',
      body: 'Device repair tracking, diagnosis workflow & customer pickups.',
      cta: 'New Repair Ticket', href: '/sales?open=1', permission: 'CREATE_INVOICE',
    },
    tiles: [
      { id: 'tickets',   icon: '🎟️', label: 'Repair Tickets',  sublabel: 'All repair jobs',       href: '/sales',     color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'parts',     icon: '🔩',  label: 'Parts Stock',     sublabel: 'Spare parts inventory', href: '/product',   color: 'slate', permission: 'MANAGE_INVENTORY' },
      { id: 'purchases', icon: '🛒',  label: 'Parts Purchases', sublabel: 'Reorder parts',         href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Document device fault and customer complaint for every repair ticket.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Repair Technician', emoji: '🛠️', description: 'Manage repair jobs, parts & advance job status' },
      { role: 'manager', businessLabel: 'Shop Manager',      emoji: '👔', description: 'Full access — repairs, parts, billing & reports' },
      { role: 'viewer',  businessLabel: 'Counter Staff',     emoji: '📋', description: 'View repair tickets & customer info only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Repair Shop Reports',
    pageSubtitle:    'Repair tickets, parts usage & technician performance',
    accentColor:     '#1d4ed8',
    topItemsLabel:   'Top Repair Services',
    topItemsIcon:    '🔨',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'repair tickets',
    analyticsTitle:  'Repair Analytics',
    chartColor:      '#1d4ed8',
    insights: [
      { icon: '🔨', text: 'Document device fault clearly on every repair ticket for customer reference and warranty.' },
      { icon: '📋', text: 'Pending repairs older than 7 days should be escalated or customer notified immediately.' },
      { icon: '📦', text: 'Track parts used per repair type to forecast inventory needs accurately.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Job Card',
    accentColor:      '#1e40af',
    showJobBlock:     true,
    itemSectionTitle: 'Services & Parts',
    footerNote:       'Warranty on repairs as mentioned per service. Bring device and this job card for warranty claims.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',   sublabel: "Today's Revenue"   },
    kpi2: { label: 'Job Cards',     sublabel: 'Closed today'       },
    kpi3: { label: 'Labour Income', sublabel: "Today's earnings"   },
    kpi4: { label: 'Pending Jobs',  sublabel: 'Awaiting pickup'    },
    kpi5: { label: 'GST Payable',   sublabel: 'This month'         },
    kpi6: { label: 'Parts Alert',   sublabel: 'Low spare parts'    },
  },
};
