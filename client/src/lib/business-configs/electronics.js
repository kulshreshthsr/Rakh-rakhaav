export default {
  // Entity labels
  product:        'Electronic Item',
  products:       'Electronics',
  productHindi:   'इलेक्ट्रॉनिक्स',
  item:           'Electronic Item',
  items:          'Electronics',
  inventory:      'Stock',

  // People
  supplier:       'Distributor',
  suppliers:      'Distributors',
  supplierHindi:  'डिस्ट्रीब्यूटर',

  // Actions
  addProduct:     'Add Electronic',
  newSale:        'New Invoice',
  editSale:       'Edit Invoice',

  // Search placeholders
  searchProduct:  'Search electronics by name, model, brand...',
  searchSupplier: 'Search distributor name or phone...',
  searchSale:     'Search invoice, customer, product...',

  // Empty states
  noProducts:   'No electronics added yet.',
  noSales:      'No invoices yet.',
  noSuppliers:  'No distributors found.',

  // Section headers
  supplierSection: 'Distributor Info',
  itemsSection:    'Electronics',

  // Directory pages
  supplierDirectory:      'Distributor Directory',
  supplierDirectoryHindi: 'डिस्ट्रीब्यूटर लिस्ट',
  refreshingSuppliers:    'Refreshing distributors...',
  allSuppliers:           'All Distributors',
  selectSupplier:         'Select a distributor to see details.',
  backToSales:            'Back to Invoices',

  // Dashboard quick actions
  quickNewSale:       'New Invoice',
  quickNewSaleHindi:  'नया Invoice बनाओ',
  quickAddStock:      'Add Electronic',
  quickAddStockHindi: 'Electronic जोड़ो',

  // KPIs
  kpiInvoices:      'Invoices',
  kpiTotalProducts: 'Electronics',
  kpiRecentSales:   'Recent Invoices',

  productFormSchema: {
    nameLabel:        'Product Name',
    descriptionLabel: 'Specifications',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Unit', 'Set', 'Pack'],
    attributesTitle:  'Product Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'brand',    label: 'Brand',       type: 'text',   placeholder: 'e.g. Samsung, LG, Sony' },
    { key: 'model_no', label: 'Model No.',   type: 'text',   placeholder: 'Model number' },
    { key: 'category', label: 'Category',    type: 'select', options: ['TV', 'AC', 'Refrigerator', 'Washing Machine', 'Microwave', 'Fan', 'Mixer/Grinder', 'Iron', 'Water Purifier', 'Laptop', 'Printer', 'Camera', 'Accessories', 'Other'] },
    { key: 'warranty', label: 'Warranty',    type: 'select', options: ['No Warranty', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years'] },
    { key: 'serial_no',label: 'Serial No.',  type: 'text',   placeholder: 'Serial number' },
  ],
  invoiceExtraFields: [
    { key: 'serial_no',       label: 'Serial Number',    type: 'text' },
    { key: 'imei_no',         label: 'IMEI (if mobile)', type: 'text' },
    { key: 'warranty_period', label: 'Warranty Period',  type: 'select', options: ['6 months', '1 year', '2 years', '3 years', 'As per brand'] },
    { key: 'demo_date',       label: 'Demo Date',        type: 'date' },
  ],
  invoiceLineFields: [
    { key: 'serial_no', label: 'Serial No.', type: 'text', placeholder: 'Serial number' },
  ],

  productAttributeSections: [
    {
      title: 'Product Details',
      fields: [
        { key: 'category', label: 'Category',      type: 'select', options: ['Home Appliances', 'Mobiles & Gadgets', 'Computing', 'Audio / Visual', 'Accessories & Spares', 'Other'] },
        { key: 'brand',    label: 'Brand',          type: 'text',   placeholder: 'e.g. Samsung, LG, Apple, Sony' },
        { key: 'model_no', label: 'Model No.',      type: 'text',   placeholder: 'Model number' },
        { key: 'color',    label: 'Color / Finish', type: 'text',   placeholder: 'e.g. Black, Silver, White' },
      ],
    },
    {
      title: 'Mobiles & Gadgets Details',
      visibleWhenCategory: 'Mobiles & Gadgets',
      fields: [
        { key: 'storage',    label: 'Storage',     type: 'select', options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', 'N/A'] },
        { key: 'ram',        label: 'RAM',         type: 'select', options: ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB', 'N/A'] },
        { key: 'os',         label: 'OS',          type: 'select', options: ['Android', 'iOS', 'Windows', 'Other', 'N/A'] },
        { key: 'imei_no',    label: 'IMEI Number', type: 'text',   placeholder: '15-digit IMEI', hint: 'Also captured per line-item in invoice' },
      ],
    },
    {
      title: 'Warranty & Compliance',
      fields: [
        { key: 'warranty',       label: 'Warranty Period',  type: 'select', options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years'] },
        { key: 'warranty_by',    label: 'Warranty By',      type: 'select', options: ['Manufacturer', 'Brand Service Centre', 'Our Shop'] },
        { key: 'serial_no',      label: 'Serial Number',    type: 'text',   placeholder: 'Serial number', hint: 'Also captured per line-item in invoice' },
        { key: 'is_refurbished', label: 'Refurbished',      type: 'checkbox', defaultValue: false },
        { key: 'refurb_grade',   label: 'Refurb Grade',     type: 'select', options: ['Grade A', 'Grade B', 'Grade C'], visibleWhen: { key: 'is_refurbished', value: true }, hint: 'A=Like New, B=Good, C=Fair' },
        { key: 'bis_cert',       label: 'BIS / ISI Certified', type: 'checkbox', defaultValue: false },
        { key: 'energy_star',    label: 'Energy Star Rating',  type: 'select', options: ['Not Rated', '1 Star', '2 Star', '3 Star', '4 Star', '5 Star'] },
      ],
    },
    {
      title: 'Technical Specifications',
      fields: [
        { key: 'specs', label: 'Key Specifications', type: 'textarea', placeholder: 'e.g. 43 inch, 4K UHD, 120Hz — or Snapdragon 8 Gen 3, 5000mAh...' },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'serial',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   false,
    trackSerials:    true,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Unit', 'Set', 'Pack'],
    expiryAlertDays: 365,
    stockLabel:   'Units',
    batchLabel:   'Batch',
    expiryLabel:  'Warranty Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'serial',
  },

  dashboardConfig: {
    callout: {
      icon: '🔌', color: 'indigo',
      title: 'Electronics Mode Active',
      body: 'Serial number tracking, warranty management & IMEI inventory.',
      cta: 'Electronics Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'serials',   icon: '🔖', label: 'Serial Inventory',  sublabel: 'Device serial numbers', href: '/product',   color: 'indigo', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Electronics Sales', sublabel: 'All device sales',      href: '/sales',     color: 'blue',   permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Stock Purchases',   sublabel: 'Distributor orders',    href: '/purchases', color: 'amber',  permission: 'CREATE_PURCHASE'  },
      { id: 'warranty',  icon: '🛡️', label: 'Warranty Claims',   sublabel: 'Open claims',           href: '/warranty',  color: 'teal',   permission: 'VIEW_SALES'       },
    ],
    tip: 'Record serial numbers for warranty claims. IMEI tracking reduces pilferage.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Sales / Technician', emoji: '💻', description: 'Billing, inventory & service records' },
      { role: 'manager',    businessLabel: 'Store Manager',      emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',           emoji: '📊', description: 'Financial records & GST reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Electronics Reports',
    pageSubtitle:    'Product sales, serial tracking & brand performance',
    accentColor:     '#1e3a8a',
    topItemsLabel:   'Top Electronics',
    topItemsIcon:    '🔌',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'invoices',
    analyticsTitle:  'Electronics Analytics',
    chartColor:      '#3730a3',
    insights: [
      { icon: '🔌', text: 'Record serial numbers for every electronics sale to support warranty claim processing.' },
      { icon: '🏷️', text: 'Brand-wise sales analysis helps identify which brands generate the most revenue.' },
      { icon: '📦', text: 'High-value items need serial-level inventory tracking to prevent stock shrinkage.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Tax Invoice',
    itemSectionTitle: 'Electronic Items',
    showSerialColumn: true,
    showHsnColumn:    true,
    showGstColumns:   true,
    accentColor:      '#0284c7',
    footerNote:       'Warranty as per manufacturer terms. Keep this invoice for warranty claims.',
  },

  challanConfig: {
    enabled: true,
    defaultChallanType: 'supply_of_goods',
    requireVehicleNumber: false,
    requirePONumber: false,
    showEwayBillWarning: true,
    defaultTerms: 'Goods dispatched in good condition. Please verify serial numbers and quantity on receipt. Report discrepancies within 24 hours.',
    uomOptions: ['NOS', 'PCS', 'SET', 'BOX', 'PAIR'],
  },

  workflowConfig: {
    enabled: true,
    stages: [
      { key: 'pending',   label: 'Pending',       color: 'gray'  },
      { key: 'demo',      label: 'Demo Given',     color: 'blue'  },
      { key: 'confirmed', label: 'Sale Confirmed', color: 'green' },
      { key: 'invoiced',  label: 'Invoiced',       color: 'green' },
      { key: 'delivered', label: 'Delivered',      color: 'green' },
      { key: 'paid',      label: 'Paid',           color: 'green' },
    ],
    dashboardWidgets: [
      { label: 'Pending Sales',    stage: 'pending',   href: '/sales' },
      { label: 'Demo in Progress', stage: 'demo',      href: '/sales' },
      { label: 'Ready to Invoice', stage: 'confirmed', href: '/sales' },
    ],
  },

  dashboardPanels: [
    {
      id: 'warranty_summary',
      dataKey: 'warrantySummary',
      condition: (val) => Boolean(val && ((val.pendingCount || 0) > 0 || (val.readyCount || 0) > 0)),
      href: '/warranty',
      icon: '🛡️',
      color: 'teal',
      renderLabel: (val) => {
        const parts = [];
        if ((val.pendingCount || 0) > 0) parts.push(`${val.pendingCount} warranty claim${val.pendingCount !== 1 ? 's' : ''} open`);
        if ((val.readyCount   || 0) > 0) parts.push(`${val.readyCount} ready for pickup`);
        return parts.join('  •  ');
      },
      renderSublabel: () => 'View Claims →',
    },
  ],

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',  sublabel: "Today's Revenue"    },
    kpi2: { label: 'Devices Sold', sublabel: 'Units today'        },
    kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit'       },
    kpi4: { label: 'Udhaar',       sublabel: 'Customer credit'   },
    kpi5: { label: 'GST Payable',  sublabel: 'This month'        },
    kpi6: { label: 'Stock Alerts', sublabel: 'Low / Out of stock'},
  },

  // ─── Electronics-specific expense categories ─────────────────────────────
  expenseCategories: [
    { id: 'spare_parts', labelHi: 'Spare Parts',  labelEn: 'Spare Parts',  emoji: '⚙️' },
    { id: 'tools',       labelHi: 'Tools',         labelEn: 'Tools',        emoji: '🔩' },
    { id: 'rent',        labelHi: 'किराया',         labelEn: 'Rent',         emoji: '🏠' },
    { id: 'salary',      labelHi: 'वेतन',           labelEn: 'Salary',       emoji: '👷' },
    { id: 'utility',     labelHi: 'बिजली-पानी',     labelEn: 'Utility',      emoji: '💡' },
    { id: 'maintenance', labelHi: 'मरम्मत',          labelEn: 'Maintenance',  emoji: '🔧' },
    { id: 'transport',   labelHi: 'परिवहन',          labelEn: 'Transport',    emoji: '🚛' },
    { id: 'misc',        labelHi: 'अन्य',            labelEn: 'Misc',         emoji: '📦' },
  ],
};
