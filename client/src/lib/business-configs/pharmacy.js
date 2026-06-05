export default {
  // Entity labels
  product:        'Medicine',
  products:       'Medicines',
  productHindi:   'दवाई',
  item:           'Medicine',
  items:          'Medicines',
  inventory:      'Medicine Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // People
  customer:       'Patient / Customer',
  customers:      'Patients',
  customerHindi:  'मरीज़',
  supplier:       'Distributor',
  suppliers:      'Distributors',
  supplierHindi:  'डिस्ट्रीब्यूटर',

  // Actions
  addProduct:     'Add Medicine',
  newSale:        'New Bill',
  newPurchase:    'New Purchase',
  editSale:       'Edit Bill',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search medicines by name, composition, batch...',
  searchCustomer: 'Search patient name or phone...',
  searchSupplier: 'Search distributor name or phone...',
  searchSale:     'Search bill, patient, medicine...',
  searchPurchase: 'Search purchase, distributor...',

  // Form placeholders
  customerNamePlaceholder: 'Patient / Customer का नाम',
  supplierNamePlaceholder: 'Distributor का नाम',

  // Empty states
  noProducts:   'No medicines added yet.',
  noCustomers:  'No patients found.',
  noSuppliers:  'No distributors found.',
  noSales:      'No bills yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  customerSection: 'Patient Info',
  supplierSection: 'Distributor Info',
  itemsSection:    'Medicines',

  // Directory pages
  customerDirectory:      'Patient Directory',
  customerDirectoryHindi: 'मरीज़ लिस्ट',
  supplierDirectory:      'Distributor Directory',
  supplierDirectoryHindi: 'डिस्ट्रीब्यूटर लिस्ट',
  refreshingCustomers:    'Refreshing patients…',
  refreshingSuppliers:    'Refreshing distributors...',
  allSuppliers:           'All Distributors',
  selectSupplier:         'Select a distributor to see details.',
  backToSales:            'Back to Bills',
  backToPurchases:        'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Medicine',
  quickAddStockHindi: 'Medicine जोड़ो',

  // KPIs
  kpiInvoices:       'Bills',
  kpiTotalProducts:  'Total Medicines',
  kpiTotalCustomers: 'Total Patients',
  kpiRecentSales:    'Recent Bills',

  entityType: 'medicine',

  formSectionLabels: {
    basics:  'Medicine Information',
    pricing: 'Pricing',
    stock:   'Stock & Dispensing',
    tax:     'GST & Tax',
  },

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Medicine Name',
    descriptionLabel: 'Composition / Usage',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Strip', 'Tablet', 'Bottle', 'Syrup', 'Injection', 'Capsule', 'Tube', 'Sachet', 'Cream', 'Drops'],
    attributesTitle:  'Medicine Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:      ['cash', 'upi', 'credit'],
    showBarcodeScanner:  true,
    defaultPayment:      'cash',
  },

  // ─── Extra product attributes (stored in p.metadata) ───────────────────────
  productAttributes: [
    { key: 'batch_no',      label: 'Batch Number',   type: 'text',   placeholder: 'e.g. BT2024001' },
    { key: 'expiry_date',   label: 'Expiry Date',    type: 'date' },
    { key: 'manufacturer',  label: 'Manufacturer',   type: 'text',   placeholder: 'Company name' },
    { key: 'rack_no',       label: 'Rack / Shelf',   type: 'text',   placeholder: 'e.g. A-12' },
    { key: 'schedule',      label: 'Schedule',       type: 'select', options: ['OTC', 'Schedule H', 'Schedule H1', 'Schedule X', 'Schedule G'] },
  ],

  // ─── Grouped product attribute sections ────────────────────────────────────
  productAttributeSections: [
    {
      title: 'Batch Information',
      fields: [
        { key: 'batch_no',    label: 'Batch Number',        type: 'text', required: true, placeholder: 'e.g. BT2024001', hint: 'Required for Schedule H / H1 medicines' },
        { key: 'expiry_date', label: 'Expiry Date',         type: 'date', required: true },
        { key: 'mfg_date',    label: 'Manufacturing Date',  type: 'date' },
        { key: 'mrp',         label: 'MRP (Maximum Retail Price ₹)', type: 'number', placeholder: 'As printed on package', hint: 'Selling price cannot exceed MRP — DPCO law' },
      ],
    },
    {
      title: 'Medicine Details',
      fields: [
        { key: 'composition', label: 'Composition / Salt',  type: 'text', placeholder: 'e.g. Paracetamol 500mg' },
        { key: 'dosage',      label: 'Dosage / Strength',   type: 'text', placeholder: 'e.g. 500mg, 10mg/5ml' },
        { key: 'category',    label: 'Category',            type: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream / Gel', 'Drops', 'Inhaler', 'Powder', 'Ointment', 'Sachet', 'Other'] },
        { key: 'schedule',    label: 'Schedule',            type: 'select', options: ['OTC', 'Schedule H', 'Schedule H1', 'Schedule X', 'Schedule G', 'Schedule C', 'Schedule C1'] },
        { key: 'manufacturer',label: 'Manufacturer',        type: 'text', placeholder: 'Company name' },
        { key: 'is_narcotic', label: 'Narcotic / Controlled Substance', type: 'checkbox', defaultValue: false, hint: 'Enable for items that require a special register entry' },
      ],
    },
    {
      title: 'Storage & Location',
      fields: [
        { key: 'rack_no',           label: 'Rack / Shelf',         type: 'text',   placeholder: 'e.g. A-12' },
        { key: 'storage_conditions',label: 'Storage Conditions',   type: 'select', options: ['Room Temp (15–25°C)', 'Cool & Dry (below 25°C)', 'Refrigerate (2–8°C)', 'Freeze (below −15°C)', 'Protect from Light'] },
      ],
    },
  ],

  // ─── Invoice-level extra fields (stored in s.extra_fields) ─────────────────
  invoiceExtraFields: [
    { key: 'prescription_no',  label: 'Prescription No.',         type: 'text',   placeholder: 'Rx number (optional)' },
    { key: 'doctor_name',      label: "Doctor's Name",            type: 'text',   placeholder: 'Referring doctor' },
    { key: 'insurance_type',   label: 'Insurance Scheme',         type: 'select', options: ['None', 'CGHS', 'ESIC', 'Ayushman Bharat', 'Private Insurance', 'Other'], required: false },
    { key: 'insurance_card_no',label: 'Insurance Card / UHID No.',type: 'text',   placeholder: 'Patient insurance card number', required: false },
    { key: 'insurance_company',label: 'Insurance Company',        type: 'text',   placeholder: 'Only for private insurance', required: false },
    { key: 'insurance_amount', label: 'Amount Covered by Insurance (₹)', type: 'number', required: false },
  ],

  // ─── Per-line-item extra fields (stored in item.item_metadata) ─────────────
  invoiceLineFields: [
    { key: 'batch_no',    label: 'Batch', type: 'text', placeholder: 'Batch no.' },
    { key: 'expiry_date', label: 'Expiry', type: 'date' },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'batch',
    trackBatches:    true,
    trackExpiry:     true,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'strips',
    allowedUnits: ['Strip', 'Tablet', 'Bottle', 'Syrup', 'Injection', 'Capsule', 'Tube', 'Sachet', 'Cream', 'Drops'],
    expiryAlertDays: 30,
    stockLabel:   'Strips',
    batchLabel:   'Batch No.',
    expiryLabel:  'Expiry Date',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'fefo',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Prescription',
    saleNounPlural: 'Prescriptions',
    stages: [
      { id: 'pending',   label: 'Pending',   color: 'amber', icon: '📋', terminal: false },
      { id: 'validated', label: 'Validated', color: 'blue',  icon: '✅', terminal: false },
      { id: 'dispensed', label: 'Dispensed', color: 'green', icon: '💊', terminal: false },
      { id: 'paid',      label: 'Paid',      color: 'slate', icon: '💰', terminal: true  },
    ],
    initialStage: 'pending',
    transitions: {
      pending:   ['validated', 'dispensed'],
      validated: ['dispensed'],
      dispensed: ['paid'],
      paid:      [],
    },
    actions: {
      pending:   [{ id: 'validate', label: 'Validate Rx', icon: '✅', nextStage: 'validated', color: 'blue', allowedRoles: ['owner', 'manager'] }],
      validated: [{ id: 'dispense', label: 'Dispense',        icon: '💊', nextStage: 'dispensed', color: 'green' }],
      dispensed: [{ id: 'collect',  label: 'Collect Payment', icon: '💰', nextStage: 'paid',      color: 'slate', triggerInvoice: true }],
      paid:      [],
    },
    dashboardWidgets: [
      { id: 'pending_rx',      label: 'Pending Rx', stages: ['pending'],   icon: '📋', color: 'amber' },
      { id: 'dispensed_today', label: 'Dispensed',  stages: ['dispensed'], icon: '💊', color: 'green' },
    ],
    quickActions: [
      { id: 'new_bill',   label: 'New Bill',   labelHindi: 'नया Bill',   icon: '💊', href: '/sales?open=1',    permission: 'CREATE_INVOICE' },
      { id: 'pending_rx', label: 'Pending Rx', labelHindi: 'Pending Rx', icon: '📋', href: '/sales?wf=pending', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '💊', color: 'cyan',
      title: 'Pharmacy Mode Active',
      body: 'Batch numbers, expiry dates & prescription management enabled.',
      cta: 'Medicine Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'expiry',    icon: '⏰', label: 'Expiry Alerts',     sublabel: 'Near-expiry medicines',   href: '/product?filter=expiring', color: 'orange', permission: 'MANAGE_INVENTORY' },
      { id: 'batch',     icon: '🔬', label: 'Batch Records',     sublabel: 'Batch-wise stock',        href: '/product',                 color: 'blue',   permission: 'MANAGE_INVENTORY' },
      { id: 'purchases', icon: '🛒', label: 'Distributor Orders',sublabel: 'Medicine purchases',      href: '/purchases',               color: 'teal',   permission: 'CREATE_PURCHASE'  },
      { id: 'narcotics', icon: '🔒', label: 'Narcotics Register',sublabel: 'Schedule X dispensing log',href: '/narcotics',              color: 'red',    permission: 'VIEW_REPORTS'     },
    ],
    tip: 'Schedule H medicines require valid prescription. Track batch numbers for traceability.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'manager',    businessLabel: 'Pharmacist',          emoji: '💊', description: 'Validate prescriptions, dispense & full operations' },
      { role: 'cashier',    businessLabel: 'Dispenser / Counter', emoji: '🏥', description: 'Billing, dispensing medicines & patient service' },
      { role: 'accountant', businessLabel: 'Medical Accountant',  emoji: '📊', description: 'Financial records, reports & GST filing only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Pharmacy Reports',
    pageSubtitle:    'Medicine sales, batch records & expiry analytics',
    accentColor:     '#0891b2',
    topItemsLabel:   'Top Medicines',
    topItemsIcon:    '💊',
    topBuyersLabel:  'Top Patients',
    invoiceUnit:     'bills',
    analyticsTitle:  'Medicine Analytics',
    chartColor:      '#0891b2',
    insights: [
      { icon: '⚠️', text: 'Schedule H medicines require a valid prescription. Ensure Rx is attached before dispensing.' },
      { icon: '📅', text: 'Review batch expiry dates weekly. Remove expired stock from shelves immediately.' },
      { icon: '🔬', text: 'FEFO (First Expiry First Out) is active — oldest batches are deducted first automatically.' },
    ],
  },

  invoiceConfig: {
    documentTitle:         'Medicine Bill',
    accentColor:           '#0891b2',
    showBatchColumns:      true,
    showPrescriptionBlock: true,
    showMrpColumn:         true,
    showInsuranceBlock:    true,
    itemSectionTitle:      'Medicines',
    footerNote:            'Keep medicines in cool, dry place away from sunlight. Check expiry date before use. Not valid without pharmacist seal.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',    sublabel: "Today's Revenue"      },
    kpi2: { label: 'Prescriptions',  sublabel: 'Dispensed today'       },
    kpi3: { label: 'Margin',         sublabel: 'Net profit today'      },
    kpi4: { label: 'Udhaar',         sublabel: 'Patient credit'        },
    kpi5: { label: 'GST Payable',    sublabel: 'This month'            },
    kpi6: { label: 'Expiry Alerts',  sublabel: 'Expiring in 30 days'   },
  },

  dashboardPanels: [
    {
      id: 'expiry_alerts',
      dataKey: 'expiryStats',
      condition: (val) => Boolean(val && (val.expiredCount > 0 || val.expiring7Days > 0 || val.expiring30Days > 0)),
      href: '/product?filter=expiring',
      icon: '⏰',
      color: 'amber',
      renderLabel: (val) => {
        if (val.expiredCount > 0) return `${val.expiredCount} items expired`;
        if (val.expiring7Days > 0) return `${val.expiring7Days} items expiring this week`;
        return `${val.expiring30Days} items expiring in 30 days`;
      },
      renderSublabel: () => 'Expiry alerts →',
    },
    {
      id: 'insurance_pending',
      dataKey: 'insurancePending',
      condition: (val) => Number(val) > 0,
      href: '/sales?filter=insurance_pending',
      icon: '🏥',
      color: 'blue',
      renderLabel: (val) => `${val} Insurance Claims Pending`,
      renderSublabel: () => 'Awaiting reimbursement →',
    },
  ],

  // ─── Pharmacy-specific expense categories ────────────────────────────────
  expenseCategories: [
    { id: 'medicine_purchase', labelHi: 'दवाई खरीद',    labelEn: 'Medicine Purchase', emoji: '💊' },
    { id: 'cold_chain',        labelHi: 'Cold Chain',    labelEn: 'Cold Chain',        emoji: '❄️' },
    { id: 'license_renewal',   labelHi: 'License Fee',   labelEn: 'License Renewal',   emoji: '📜' },
    { id: 'rent',              labelHi: 'किराया',         labelEn: 'Rent',              emoji: '🏠' },
    { id: 'salary',            labelHi: 'वेतन',           labelEn: 'Salary',            emoji: '👷' },
    { id: 'utility',           labelHi: 'बिजली-पानी',     labelEn: 'Utility',           emoji: '💡' },
    { id: 'maintenance',       labelHi: 'मरम्मत',          labelEn: 'Maintenance',       emoji: '🔧' },
    { id: 'transport',         labelHi: 'परिवहन',          labelEn: 'Transport',         emoji: '🚛' },
    { id: 'misc',              labelHi: 'अन्य',            labelEn: 'Misc',              emoji: '📦' },
  ],
};
