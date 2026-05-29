export default {
  // Entity labels
  product:        'Service',
  products:       'Services',
  productHindi:   'सर्विस',
  item:           'Service',
  items:          'Services',
  inventory:      'Services & Products',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',
  sale:           'Service',
  sales:          'Services',

  // People
  customer:       'Client',
  customers:      'Clients',
  customerHindi:  'क्लाइंट',

  // Actions
  addProduct:     'Add Service',
  newSale:        'New Appointment',
  newPurchase:    'New Purchase',
  editSale:       'Edit Appointment',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search services by name or category...',
  searchCustomer: 'Search client name or phone...',
  searchSale:     'Search bill, client, service...',

  // Form placeholders
  customerNamePlaceholder: 'Client का नाम',

  // Empty states
  noProducts:   'No services added yet.',
  noCustomers:  'No clients found.',
  noSales:      'No appointments yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  customerSection: 'Client Info',
  itemsSection:    'Services',

  // Directory pages
  customerDirectory:      'Client Directory',
  customerDirectoryHindi: 'क्लाइंट लिस्ट',
  refreshingCustomers:    'Refreshing clients…',
  backToSales:            'Back to Services',
  backToPurchases:        'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Appointment',
  quickNewSaleHindi:  'नई Appointment लो',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Service',
  quickAddStockHindi: 'Service जोड़ो',

  // KPIs
  kpiInvoices:       'Bills',
  kpiTotalProducts:  'Total Services',
  kpiTotalCustomers: 'Total Clients',
  kpiRecentSales:    'Recent Services',

  // ─── Product form schema ────────────────────────────────────────────────────
  entityType: 'service',

  formSectionLabels: {
    basics:  'Service Information',
    pricing: 'Service Rate',
    stock:   'Capacity & Availability',
    tax:     'GST / SAC Code',
  },

  productFormSchema: {
    nameLabel:        'Service Name',
    descriptionLabel: 'Service Description',
    trackQuantity:    false,
    showBarcode:      false,
    unitOptions:      ['Session', 'Per Visit', 'Monthly Package', 'Combo'],
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
    { key: 'category',  label: 'Category',       type: 'select', options: ['Haircut', 'Hair Color', 'Facial', 'Waxing', 'Threading', 'Nails', 'Spa', 'Massage', 'Makeup', 'Mehendi', 'Other'] },
    { key: 'duration',  label: 'Duration (mins)', type: 'number', placeholder: 'e.g. 30', min: 5 },
    { key: 'for_gender',label: 'For',             type: 'select', options: ['All', 'Female', 'Male', 'Kids'] },
  ],

  // ─── Grouped product attribute sections ────────────────────────────────────
  productAttributeSections: [
    {
      title: 'Service Details',
      fields: [
        { key: 'category',   label: 'Category',          type: 'select', options: ['Haircut', 'Hair Color', 'Hair Treatment', 'Facial', 'Waxing', 'Threading', 'Nails', 'Spa', 'Massage', 'Makeup', 'Mehendi', 'Bridal', 'Other'] },
        { key: 'for_gender', label: 'For',               type: 'select', options: ['All', 'Female', 'Male', 'Kids'] },
        { key: 'duration',   label: 'Duration (mins)',   type: 'number', placeholder: '30', min: 5, step: '5', hint: 'Average time to complete this service' },
      ],
    },
    {
      title: 'Booking & Availability',
      fields: [
        { key: 'requires_appointment', label: 'Requires Appointment',  type: 'checkbox', defaultValue: false },
        { key: 'available_days',       label: 'Available On',          type: 'multiselect', options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hint: 'Leave empty if available all days' },
        { key: 'assigned_stylist',     label: 'Default Stylist',       type: 'text', placeholder: 'Stylist name (optional)' },
      ],
    },
    {
      title: 'Products Used',
      fields: [
        { key: 'products_used', label: 'Products / Materials Used', type: 'tags', placeholder: 'L\'Oréal, Wella, Kerastase...', hint: 'Enter comma-separated product/brand names' },
      ],
    },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [
    { key: 'technician',       label: 'Stylist / Staff', type: 'text', placeholder: 'Staff name' },
    { key: 'appointment_date', label: 'Appointment Date', type: 'date' },
  ],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [],

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
    allowedUnits: ['Service', 'Session', 'Piece', 'ML', 'Gram'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Consumables',
    deductionMethod: 'simple',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Appointment',
    saleNounPlural: 'Appointments',
    stages: [
      { id: 'scheduled',  label: 'Scheduled',  color: 'purple', icon: '📅', terminal: false },
      { id: 'in_service', label: 'In Service', color: 'pink',   icon: '✂️', terminal: false },
      { id: 'completed',  label: 'Completed',  color: 'green',  icon: '✅', terminal: false },
      { id: 'paid',       label: 'Paid',       color: 'slate',  icon: '💰', terminal: true  },
    ],
    initialStage: 'scheduled',
    transitions: {
      scheduled:  ['in_service', 'paid'],
      in_service: ['completed'],
      completed:  ['paid'],
      paid:       [],
    },
    actions: {
      scheduled:  [{ id: 'start_service',    label: 'Start Service',    icon: '✂️', nextStage: 'in_service', color: 'pink'   }],
      in_service: [{ id: 'complete_service', label: 'Complete',         icon: '✅', nextStage: 'completed',  color: 'green'  }],
      completed:  [{ id: 'collect_payment',  label: 'Collect Payment',  icon: '💰', nextStage: 'paid',       color: 'slate', triggerInvoice: true }],
      paid:       [],
    },
    dashboardWidgets: [
      { id: 'upcoming',   label: 'Upcoming',   stages: ['scheduled'],  icon: '📅', color: 'purple' },
      { id: 'in_service', label: 'In Chair',   stages: ['in_service'], icon: '✂️', color: 'pink'   },
      { id: 'done_today', label: 'Done Today', stages: ['paid'],       icon: '✅', color: 'green'  },
    ],
    quickActions: [
      { id: 'new_appointment', label: 'New Appointment', labelHindi: 'नई Booking', icon: '📅', href: '/sales?open=1', permission: 'CREATE_INVOICE' },
      { id: 'in_service',      label: 'In Service',      labelHindi: 'Service में', icon: '✂️', href: '/sales?wf=in_service', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '✂️', color: 'purple',
      title: 'Salon Mode Active',
      body: 'Appointment tracking, service workflow & client management.',
      cta: 'New Appointment', href: '/sales?open=1', permission: 'CREATE_INVOICE',
    },
    tiles: [
      { id: 'appointments', icon: '📅', label: "Today's Slots",   sublabel: 'Appointment queue',    href: '/sales',           color: 'purple', permission: 'CREATE_INVOICE'   },
      { id: 'services',     icon: '💇', label: 'Services Menu',   sublabel: 'Add or edit services', href: '/product',         color: 'indigo', permission: 'MANAGE_INVENTORY' },
      { id: 'clients',      icon: '👤', label: 'Client Directory',sublabel: 'All clients',          href: '/sales/customers', color: 'pink',   permission: 'VIEW_SALES'       },
    ],
    tip: 'Add stylist name and service notes to each appointment bill for better tracking.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Stylist / Beautician', emoji: '✂️', description: 'Manage appointments, services & client billing' },
      { role: 'manager', businessLabel: 'Salon Manager',        emoji: '👔', description: 'Full access — staff, services, clients & reports' },
      { role: 'viewer',  businessLabel: 'Receptionist',         emoji: '📅', description: 'View appointments & client list — no billing' },
    ],
  },

  reportConfig: {
    pageTitle:       'Salon Performance',
    pageSubtitle:    'Service revenue, stylist productivity & appointment trends',
    accentColor:     '#7c3aed',
    topItemsLabel:   'Top Services',
    topItemsIcon:    '✂️',
    topBuyersLabel:  'Top Clients',
    invoiceUnit:     'appointments',
    analyticsTitle:  'Salon Analytics',
    chartColor:      '#7c3aed',
    insights: [
      { icon: '✂️', text: 'Add stylist name to each appointment bill for accurate performance tracking.' },
      { icon: '📅', text: 'Weekend slots have the highest demand. Ensure adequate staff coverage.' },
      { icon: '🔄', text: 'Repeat client rate is the most important salon KPI. Track customer revisits.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Service Bill',
    accentColor:      '#be185d',
    showJobBlock:     true,
    showHsnColumn:    false,
    itemSectionTitle: 'Services',
    footerNote:       'Thank you for visiting! We look forward to serving you again.',
  },
};
