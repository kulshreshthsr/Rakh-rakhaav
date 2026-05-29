export default {
  // Entity labels
  product:        'Service / Part',
  products:       'Services & Parts',
  productHindi:   'सर्विस',
  item:           'Service',
  items:          'Services',
  inventory:      'Parts & Services',

  // Transactions
  invoice:        'Job Card / Invoice',
  invoices:       'Job Cards',
  sale:           'Service',
  sales:          'Services',

  // Actions
  addProduct:     'Add Service / Part',
  newSale:        'New Job Card',
  newPurchase:    'New Purchase',
  editSale:       'Edit Job Card',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search services or parts by name...',
  searchCustomer: 'Search customer name or phone...',
  searchSale:     'Search job card, customer, service...',
  searchPurchase: 'Search purchase, supplier...',

  // Empty states
  noProducts:   'No services or parts added yet.',
  noSales:      'No service jobs yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  customerSection: 'Customer Info',
  itemsSection:    'Services',

  // Directory pages
  backToSales:     'Back to Services',
  backToPurchases: 'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Job Card',
  quickNewSaleHindi:  'Job Card बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Service',
  quickAddStockHindi: 'Service जोड़ो',

  // KPIs
  kpiInvoices:      'Job Cards',
  kpiTotalProducts: 'Services & Parts',
  kpiRecentSales:   'Recent Jobs',

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
    descriptionLabel: 'Description / Specifications',
    trackQuantity:    true,
    showBarcode:      false,
    unitOptions:      ['Piece', 'Service', 'Hour', 'Set', 'Kit'],
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
    { key: 'service_type', label: 'Type',          type: 'select', options: ['Labour', 'Spare Part', 'AMC', 'Consumable', 'Accessory'] },
    { key: 'brand',        label: 'Brand',          type: 'text',   placeholder: 'Brand name' },
    { key: 'model_no',     label: 'Model No.',      type: 'text',   placeholder: 'Model / part number' },
    { key: 'warranty',     label: 'Warranty',       type: 'select', options: ['No Warranty', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years'] },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [
    { key: 'appliance_type', label: 'Appliance Type',   type: 'text', placeholder: 'e.g. AC, Washing Machine' },
    { key: 'serial_no',      label: 'Serial Number',    type: 'text', placeholder: 'Product serial number' },
    { key: 'complaint',      label: 'Problem / Complaint', type: 'textarea', placeholder: 'Describe the issue' },
    { key: 'technician',     label: 'Technician',       type: 'text', placeholder: 'Assigned technician' },
    { key: 'delivery_date',  label: 'Delivery Date',    type: 'date' },
  ],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [],

  productAttributeSections: [
    {
      title: 'Service / Part Details',
      fields: [
        { key: 'service_type', label: 'Type',         type: 'select', options: ['Labour / Service Charge', 'Spare Part', 'AMC / Contract', 'Consumable', 'Accessory'] },
        { key: 'brand',        label: 'Brand',         type: 'text',   placeholder: 'Brand name' },
        { key: 'model_no',     label: 'Model / Part No.', type: 'text', placeholder: 'Model or part number' },
        { key: 'compatible',   label: 'Compatible With',  type: 'text', placeholder: 'Appliance or device model' },
      ],
    },
    {
      title: 'Warranty',
      fields: [
        { key: 'warranty',       label: 'Warranty Period',    type: 'select', options: ['No Warranty', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years'] },
        { key: 'warranty_by',    label: 'Warranty Provided By', type: 'select', options: ['Manufacturer', 'Our Service Centre'] },
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
    allowedUnits: ['Piece', 'Service', 'Hour', 'Set', 'Kit'],
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
    saleNoun: 'Service Job',
    saleNounPlural: 'Service Jobs',
    stages: [
      { id: 'logged',     label: 'Logged',     color: 'amber',  icon: '📝', terminal: false },
      { id: 'in_service', label: 'In Service', color: 'orange', icon: '🔌', terminal: false },
      { id: 'testing',    label: 'Testing',    color: 'purple', icon: '🧪', terminal: false },
      { id: 'ready',      label: 'Ready',      color: 'blue',   icon: '✅', terminal: false },
      { id: 'paid',       label: 'Paid',       color: 'slate',  icon: '💰', terminal: true  },
    ],
    initialStage: 'logged',
    transitions: {
      logged:     ['in_service'],
      in_service: ['testing', 'ready'],
      testing:    ['ready'],
      ready:      ['paid'],
      paid:       [],
    },
    actions: {
      logged:     [{ id: 'start',   label: 'Start Service',   icon: '🔌', nextStage: 'in_service', color: 'orange' }],
      in_service: [{ id: 'test',    label: 'Move to Testing', icon: '🧪', nextStage: 'testing',    color: 'purple' }],
      testing:    [{ id: 'ready',   label: 'Mark Ready',      icon: '✅', nextStage: 'ready',      color: 'blue'   }],
      ready:      [{ id: 'payment', label: 'Collect Payment', icon: '💰', nextStage: 'paid',       color: 'slate', triggerInvoice: true }],
      paid:       [],
    },
    dashboardWidgets: [
      { id: 'in_service', label: 'In Service', stages: ['in_service'],                   icon: '🔌', color: 'orange' },
      { id: 'ready',      label: 'Ready',      stages: ['ready'],                        icon: '✅', color: 'blue'   },
      { id: 'active',     label: 'Active',     stages: ['logged', 'in_service', 'testing'], icon: '📝', color: 'amber' },
    ],
    quickActions: [
      { id: 'new_job',    label: 'New Job',    labelHindi: 'नया Job',    icon: '🔌', href: '/sales?open=1',        permission: 'CREATE_INVOICE' },
      { id: 'in_service', label: 'In Service', labelHindi: 'Service में', icon: '🔧', href: '/sales?wf=in_service', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '🛠️', color: 'blue',
      title: 'Service Center Mode Active',
      body: 'Service tracking, testing workflow & delivery management.',
      cta: 'New Service Log', href: '/sales?open=1', permission: 'CREATE_INVOICE',
    },
    tiles: [
      { id: 'service_logs', icon: '📋', label: 'Service Logs',    sublabel: 'All active services', href: '/sales',     color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'parts',        icon: '⚙️',  label: 'Parts Inventory', sublabel: 'Parts stock',        href: '/product',   color: 'slate', permission: 'MANAGE_INVENTORY' },
      { id: 'purchases',    icon: '🛒',  label: 'Parts Purchase',  sublabel: 'Restock parts',      href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Track warranty status and service history for repeat customers.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Service Technician', emoji: '🔌', description: 'Manage service jobs & advance workflow stages' },
      { role: 'manager', businessLabel: 'Center Manager',     emoji: '👔', description: 'Full access — service logs, parts & reports' },
      { role: 'viewer',  businessLabel: 'Front Desk',         emoji: '📝', description: 'Log jobs & view service status — no billing' },
    ],
  },

  reportConfig: {
    pageTitle:       'Service Center Reports',
    pageSubtitle:    'Service logs, warranty analytics & parts inventory',
    accentColor:     '#0284c7',
    topItemsLabel:   'Top Services',
    topItemsIcon:    '🛠️',
    topBuyersLabel:  'Top Clients',
    invoiceUnit:     'service logs',
    analyticsTitle:  'Service Analytics',
    chartColor:      '#0284c7',
    insights: [
      { icon: '🛠️', text: 'Track warranty status on every service job. Flag out-of-warranty repairs for billing.' },
      { icon: '📋', text: 'Record device serial number for complete service history and warranty validation.' },
      { icon: '⏱️', text: 'SLA-based turnaround tracking improves customer confidence and repeat business.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Service Invoice',
    accentColor:      '#1e40af',
    showJobBlock:     true,
    itemSectionTitle: 'Services & Parts',
    footerNote:       'Warranty on service as per terms. Keep this invoice for future reference.',
  },
};
