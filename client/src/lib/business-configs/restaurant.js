export default {
  // Entity labels
  product:        'Dish',
  products:       'Menu Items',
  productHindi:   'खाना',
  item:           'Dish',
  items:          'Dishes',
  inventory:      'Menu',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',
  sale:           'Order',
  sales:          'Orders',

  // People
  customer:       'Guest',
  customers:      'Guests',
  customerHindi:  'गेस्ट',
  supplier:       'Vendor',
  suppliers:      'Vendors',
  supplierHindi:  'वेंडर',

  // Actions
  addProduct:     'Add Dish',
  newSale:        'New Order',
  newPurchase:    'New Purchase',
  editSale:       'Edit Order',
  editPurchase:   'Edit Purchase',

  // Search placeholders
  searchProduct:  'Search dishes by name or category...',
  searchCustomer: 'Search guest name or phone...',
  searchSupplier: 'Search vendor name or phone...',
  searchSale:     'Search order, guest, dish...',
  searchPurchase: 'Search purchase, vendor...',

  // Form placeholders
  customerNamePlaceholder: 'Guest का नाम',
  supplierNamePlaceholder: 'Vendor का नाम',

  // Empty states
  noProducts:   'No dishes in menu yet.',
  noCustomers:  'No guests found.',
  noSuppliers:  'No vendors found.',
  noSales:      'No orders yet.',
  noPurchases:  'No purchases yet.',

  // Section headers
  customerSection: 'Guest Info',
  supplierSection: 'Vendor Info',
  itemsSection:    'Dishes',

  // Directory pages
  customerDirectory:      'Guest Directory',
  customerDirectoryHindi: 'गेस्ट लिस्ट',
  supplierDirectory:      'Vendor Directory',
  supplierDirectoryHindi: 'वेंडर लिस्ट',
  refreshingCustomers:    'Refreshing guests…',
  refreshingSuppliers:    'Refreshing vendors...',
  allSuppliers:           'All Vendors',
  selectSupplier:         'Select a vendor to see details.',
  backToSales:            'Back to Orders',
  backToPurchases:        'Back to Purchases',

  // Dashboard quick actions
  quickNewSale:       'New Order',
  quickNewSaleHindi:  'नया Order लो',
  quickPurchase:      'New Purchase',
  quickPurchaseHindi: 'Purchase जोड़ो',
  quickAddStock:      'Add Dish',
  quickAddStockHindi: 'Menu में जोड़ो',

  // KPIs
  kpiInvoices:       'Orders',
  kpiTotalProducts:  'Menu Items',
  kpiTotalCustomers: 'Total Guests',
  kpiRecentSales:    'Recent Orders',

  entityType: 'dish',

  formSectionLabels: {
    basics:  'Dish Information',
    pricing: 'Menu Pricing',
    stock:   'Availability',
    tax:     'GST & Tax',
  },

  // ─── Product form schema ────────────────────────────────────────────────────
  productFormSchema: {
    nameLabel:        'Dish Name',
    descriptionLabel: 'Description / Ingredients',
    trackQuantity:    false,
    showBarcode:      false,
    unitOptions:      ['Serving', 'Plate', 'Bowl', 'Half', 'Full', 'Piece'],
    attributesTitle:  'Dish Details',
  },

  // ─── Sale form schema ───────────────────────────────────────────────────────
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: false,
    defaultPayment:     'cash',
  },

  // ─── Extra product attributes ───────────────────────────────────────────────
  productAttributes: [
    { key: 'category',   label: 'Category',    type: 'select', options: ['Starter', 'Main Course', 'Breads', 'Rice', 'Dessert', 'Beverage', 'Snack', 'Special'] },
    { key: 'food_type',  label: 'Food Type',   type: 'select', options: ['Veg', 'Non-Veg', 'Egg', 'Vegan'] },
    { key: 'prep_time',  label: 'Prep Time',   type: 'number', placeholder: 'Minutes', min: 0 },
    { key: 'spice_level',label: 'Spice Level', type: 'select', options: ['Mild', 'Medium', 'Spicy', 'Extra Spicy'] },
  ],

  // ─── Grouped product attribute sections ────────────────────────────────────
  productAttributeSections: [
    {
      title: 'Dish Details',
      fields: [
        { key: 'category',   label: 'Category',    type: 'select', options: ['Starter', 'Main Course', 'Breads', 'Rice & Biryani', 'Dessert', 'Beverage', 'Snack', 'Combo', 'Thali', 'Special'] },
        { key: 'food_type',  label: 'Food Type',   type: 'select', options: ['Veg', 'Non-Veg', 'Egg', 'Vegan'] },
        { key: 'spice_level',label: 'Spice Level', type: 'select', options: ['Not Applicable', 'Mild', 'Medium', 'Spicy', 'Extra Spicy'] },
        { key: 'is_jain',    label: 'Jain Friendly', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      title: 'Kitchen & Availability',
      fields: [
        { key: 'prep_time',        label: 'Preparation Time (mins)', type: 'number', placeholder: '15', min: 0, step: '5', required: true, hint: 'Average kitchen prep time' },
        { key: 'kitchen_section',  label: 'Kitchen Section', type: 'select', options: ['Main Kitchen', 'Tandoor', 'Chinese Section', 'Cold Kitchen', 'Bakery', 'Bar', 'N/A'] },
        { key: 'is_dine_in',       label: 'Available for Dine-In',   type: 'checkbox', defaultValue: true },
        { key: 'is_takeaway',      label: 'Available for Takeaway',  type: 'checkbox', defaultValue: true },
        { key: 'is_delivery',      label: 'Available for Delivery',  type: 'checkbox', defaultValue: false },
      ],
    },
    {
      title: 'Allergens & Dietary',
      fields: [
        { key: 'allergens', label: 'Contains Allergens', type: 'multiselect', options: ['Gluten', 'Dairy', 'Eggs', 'Tree Nuts', 'Peanuts', 'Soy', 'Shellfish', 'Sesame', 'Mustard'], hint: 'Select all allergens present in this dish' },
      ],
    },
  ],

  // ─── Invoice-level extra fields ─────────────────────────────────────────────
  invoiceExtraFields: [
    { key: 'order_type',           label: 'Order Type',          type: 'select',  options: ['Dine-In', 'Takeaway', 'Delivery', 'Swiggy', 'Zomato', 'Other'], required: true, defaultValue: 'Dine-In' },
    { key: 'table_no',             label: 'Table No.',           type: 'text',    placeholder: 'e.g. T-5, Counter, Outdoor 2', showWhen: { field: 'order_type', value: 'Dine-In' } },
    { key: 'covers',               label: 'No. of Guests',       type: 'number',  placeholder: '2', showWhen: { field: 'order_type', value: 'Dine-In' } },
    { key: 'waiter_name',          label: 'Waiter / Staff',      type: 'text',    placeholder: 'Staff name' },
    { key: 'delivery_platform_id', label: 'Platform Order ID',   type: 'text',    placeholder: 'Swiggy / Zomato order ID', showWhen: { field: 'order_type', values: ['Swiggy', 'Zomato', 'Delivery'] } },
    { key: 'delivery_address',     label: 'Delivery Address',    type: 'text',    showWhen: { field: 'order_type', values: ['Delivery'] } },
    { key: 'special_instructions', label: 'Special Instructions',type: 'text',    placeholder: 'e.g. No onion, Extra spicy, Jain preparation' },
  ],

  // ─── Per-line-item extra fields ─────────────────────────────────────────────
  invoiceLineFields: [],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'recipe',
    trackBatches:    false,
    trackExpiry:     false,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  true,
    supportLooseQty: false,
    stockUnit: 'portions',
    allowedUnits: ['Portion', 'Plate', 'Bowl', 'Piece', 'Glass', 'Kg', 'Litre'],
    expiryAlertDays: 1,
    stockLabel:   'Portions',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe / Ingredients',
    deductionMethod: 'recipe',
  },

  workflowConfig: {
    enabled: true,
    saleNoun: 'Order',
    saleNounPlural: 'Orders',
    stages: [
      { id: 'pending',   label: 'New Order', color: 'amber',  icon: '🆕', terminal: false },
      { id: 'cooking',   label: 'Cooking',   color: 'orange', icon: '🍳', terminal: false },
      { id: 'ready',     label: 'Ready',     color: 'blue',   icon: '✅', terminal: false },
      { id: 'served',    label: 'Served',    color: 'green',  icon: '🍽️', terminal: false },
      { id: 'completed', label: 'Paid',      color: 'slate',  icon: '💰', terminal: true  },
    ],
    initialStage: 'pending',
    transitions: {
      pending:   ['cooking', 'completed'],
      cooking:   ['ready'],
      ready:     ['served', 'completed'],
      served:    ['completed'],
      completed: [],
    },
    actions: {
      pending:   [{ id: 'send_kitchen', label: 'Send to Kitchen', icon: '🍳', nextStage: 'cooking',   color: 'orange' }],
      cooking:   [{ id: 'mark_ready',   label: 'Mark Ready',      icon: '✅', nextStage: 'ready',     color: 'blue'   }],
      ready:     [{ id: 'mark_served',  label: 'Mark Served',     icon: '🍽️', nextStage: 'served',    color: 'green'  }],
      served:    [{ id: 'close_bill',   label: 'Close Bill',      icon: '💰', nextStage: 'completed', color: 'slate', triggerInvoice: true }],
      completed: [],
    },
    dashboardWidgets: [
      { id: 'kitchen_queue', label: 'Kitchen Queue',  stages: ['cooking'],                              icon: '🍳', color: 'orange' },
      { id: 'ready_orders',  label: 'Ready to Serve', stages: ['ready'],                               icon: '✅', color: 'blue'   },
      { id: 'active_tables', label: 'Active Tables',  stages: ['pending', 'cooking', 'ready', 'served'], icon: '🍽️', color: 'red'   },
    ],
    quickActions: [
      { id: 'new_order',    label: 'New Order',     labelHindi: 'नया Order लो', icon: '➕', href: '/sales?open=1', permission: 'CREATE_INVOICE' },
      { id: 'kitchen_view', label: 'Kitchen Queue', labelHindi: 'Kitchen Queue', icon: '🍳', href: '/sales?wf=cooking', permission: 'CREATE_INVOICE' },
    ],
  },

  dashboardConfig: {
    callout: {
      icon: '🍽️', color: 'orange',
      title: 'Restaurant Mode Active',
      body: 'Table management, KOT workflow & kitchen queue enabled.',
      cta: 'New Order', href: '/sales?open=1', permission: 'CREATE_INVOICE',
    },
    tiles: [
      { id: 'dine_in',   icon: '🪑', label: 'Dine-In Orders',   sublabel: 'Table-wise orders',         href: '/sales',              color: 'orange', permission: 'CREATE_INVOICE'   },
      { id: 'menu',      icon: '🍜', label: 'Menu / Dishes',    sublabel: 'Add or edit dishes',         href: '/product',            color: 'amber',  permission: 'MANAGE_INVENTORY' },
      { id: 'tables',    icon: '🗺️', label: 'Table Status',     sublabel: 'Live floor view',            href: '/tables',             color: 'blue',   permission: 'CREATE_INVOICE'   },
      { id: 'delivery',  icon: '🛵', label: 'Delivery Orders',  sublabel: 'Swiggy / Zomato / Direct',  href: '/sales?filter=delivery', color: 'red',  permission: 'VIEW_SALES'       },
      { id: 'reports',   icon: '📊', label: 'Sales Reports',    sublabel: 'Revenue & insights',         href: '/reports',            color: 'green',  permission: 'VIEW_REPORTS'     },
    ],
    tip: 'Track table numbers and covers per order. Use KOT workflow for kitchen efficiency.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'manager', businessLabel: 'Restaurant Manager', emoji: '👨‍🍳', description: 'Manage orders, menu, staff & view reports' },
      { role: 'cashier', businessLabel: 'Waiter / Counter',   emoji: '🍽️', description: 'Take orders, advance KOT workflow & generate bills' },
      { role: 'viewer',  businessLabel: 'Kitchen Staff',      emoji: '🍳', description: 'View kitchen queue & orders only — no billing' },
    ],
  },

  reportConfig: {
    pageTitle:       'Restaurant Analytics',
    pageSubtitle:    'Dish performance, order trends & kitchen insights',
    accentColor:     '#f97316',
    topItemsLabel:   'Top Dishes',
    topItemsIcon:    '🍽️',
    topBuyersLabel:  'Regular Diners',
    invoiceUnit:     'orders',
    analyticsTitle:  'Kitchen & Sales Analytics',
    chartColor:      '#f97316',
    insights: [
      { icon: '🍽️', text: 'Track table numbers and covers per order for accurate revenue-per-table analysis.' },
      { icon: '⏰', text: 'Evening hours typically drive the highest order volumes. Prepare kitchen staff accordingly.' },
      { icon: '🔄', text: 'Monitor peak hours to optimise kitchen throughput and reduce customer wait times.' },
    ],
  },

  invoiceConfig: {
    documentTitle:      'Restaurant Bill',
    documentSubtitle:   'Guest Copy',
    accentColor:        '#b91c1c',
    showTableBlock:     true,
    showHsnColumn:      false,
    showGstColumns:     false,
    itemSectionTitle:   'Order Items',
    showSignatureBlock: false,
    footerNote:         'Thank you for dining with us! We hope to see you again soon.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',      sublabel: 'Total billed today'   },
    kpi2: { label: 'Orders',           sublabel: 'Served today'          },
    kpi3: { label: 'मुनाफा',          sublabel: 'After food cost'       },
    kpi4: { label: 'Open Tables',      sublabel: 'Active right now'      },
    kpi5: { label: 'GST Payable',      sublabel: 'This month'            },
    kpi6: { label: 'Low Ingredients',  sublabel: 'Needs restock'         },
  },

  dashboardPanels: [
    {
      id: 'table_status',
      dataKey: 'tableStatus',
      condition: (val) => Boolean(val),
      href: '/tables',
      icon: '🪑',
      color: 'orange',
      renderLabel: (val) => `${val.occupiedCount || 0} table${(val.occupiedCount || 0) !== 1 ? 's' : ''} occupied`,
      renderSublabel: () => 'View Floor →',
      renderExtra: (val, data) => {
        const channels = {};
        (data.todayOrders || []).forEach((s) => {
          const ef = (s.extra_fields instanceof Map ? Object.fromEntries(s.extra_fields) : s.extra_fields) || {};
          const ch = ef.order_type || 'Dine-In';
          if (!channels[ch]) channels[ch] = { count: 0, revenue: 0 };
          channels[ch].count++;
          channels[ch].revenue += s.total_amount || 0;
        });
        const CHANNEL_ICONS = { 'Dine-In': '🍽️', Takeaway: '📦', Delivery: '🛵', Swiggy: '🟠', Zomato: '🔴' };
        return Object.entries(channels)
          .filter(([, v]) => v.count > 0)
          .map(([ch, v]) => ({
            key: ch,
            icon: CHANNEL_ICONS[ch] || '🍽️',
            label: ch,
            sublabel: `₹${data.fmt ? data.fmt(v.revenue) : Math.round(v.revenue)} (${v.count})`,
          }));
      },
    },
  ],

  // ─── Restaurant-specific expense categories ──────────────────────────────
  expenseCategories: [
    { id: 'raw_materials', labelHi: 'कच्चा माल',      labelEn: 'Raw Materials',    emoji: '🥬' },
    { id: 'kitchen_gas',   labelHi: 'रसोई गैस',        labelEn: 'Kitchen Gas',      emoji: '🔥' },
    { id: 'packaging',     labelHi: 'पैकेजिंग',        labelEn: 'Packaging',        emoji: '📦' },
    { id: 'zomato_comm',   labelHi: 'Online Commission',labelEn: 'Online Commission',emoji: '📲' },
    { id: 'rent',          labelHi: 'किराया',           labelEn: 'Rent',             emoji: '🏠' },
    { id: 'salary',        labelHi: 'वेतन',             labelEn: 'Salary',           emoji: '👷' },
    { id: 'utility',       labelHi: 'बिजली-पानी',       labelEn: 'Utility',          emoji: '💡' },
    { id: 'maintenance',   labelHi: 'मरम्मत',            labelEn: 'Maintenance',      emoji: '🔧' },
    { id: 'transport',     labelHi: 'परिवहन',            labelEn: 'Transport',        emoji: '🚛' },
    { id: 'misc',          labelHi: 'अन्य',              labelEn: 'Misc',             emoji: '🗂️' },
  ],
};
