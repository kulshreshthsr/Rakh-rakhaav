export default {
  // Entity labels
  product:        'Pet Product',
  products:       'Pet Products',
  productHindi:   'पालतू जानवर',
  item:           'Item',
  items:          'Items',
  inventory:      'Pet Stock',

  // Transactions
  invoice:        'Invoice',
  invoices:       'Invoices',

  // People
  customer:       'Pet Owner',
  customers:      'Pet Owners',
  customerHindi:  'पेट ओनर',
  supplier:       'Supplier / Breeder',

  // Actions
  addProduct:     'Add Product',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search products by pet type, name, brand...',
  searchCustomer: 'Search pet owner name or phone...',
  searchSale:     'Search bill, pet owner, item...',

  // Empty states
  noProducts:   'No products added yet.',
  noCustomers:  'No pet owners found.',
  noSales:      'No bills yet.',

  // Section headers
  customerSection: 'Pet Owner Info',
  itemsSection:    'Items',

  // Directory pages
  customerDirectory:      'Pet Owner Directory',
  customerDirectoryHindi: 'पेट ओनर लिस्ट',
  refreshingCustomers:    'Refreshing pet owners…',
  backToSales:            'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Item',
  quickAddStockHindi: 'Item जोड़ो',

  // KPIs
  kpiInvoices:       'Bills',
  kpiTotalProducts:  'Products & Pets',
  kpiTotalCustomers: 'Pet Owners',
  kpiRecentSales:    'Recent Bills',

  productFormSchema: {
    nameLabel:        'Product / Pet Name',
    descriptionLabel: 'Description / Breed Info',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Kg', 'Gram', 'Packet', 'Bottle', 'Box', 'Bundle'],
    attributesTitle:  'Product Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'category',  label: 'Category',  type: 'select', options: ['Live Pet', 'Pet Food', 'Grooming', 'Accessories', 'Medicine / Health', 'Cage / Aquarium', 'Other'] },
    { key: 'for_pet',   label: 'For Pet',   type: 'select', options: ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'All Pets', 'Other'] },
    { key: 'brand',     label: 'Brand',     type: 'text',   placeholder: 'Brand name' },
    { key: 'expiry_date',label: 'Expiry Date', type: 'date' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Product Details',
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: ['Live Pet', 'Pet Food / Treats', 'Grooming', 'Toys', 'Accessories', 'Medicine / Supplements', 'Cage / Aquarium / Habitat', 'Bedding', 'Other'] },
        { key: 'for_pet',  label: 'For Pet',  type: 'select', options: ['Dog', 'Cat', 'Fish / Aquatic', 'Bird', 'Rabbit', 'Hamster', 'All Pets', 'Other'] },
        { key: 'brand',    label: 'Brand',    type: 'text',   placeholder: 'Brand name' },
      ],
    },
    {
      title: 'Pet / Animal Details',
      fields: [
        { key: 'breed',      label: 'Breed / Species', type: 'text',   placeholder: 'e.g. Labrador, Siamese, Goldfish', visibleWhen: { key: 'category', value: 'Live Pet' } },
        { key: 'age_stage',  label: 'Age Stage',       type: 'select', options: ['Puppy / Kitten / Baby', 'Young', 'Adult', 'Senior', 'All Ages'] },
        { key: 'weight_range', label: 'Weight Range',  type: 'select', options: ['Small (0-5 kg)', 'Medium (5-25 kg)', 'Large (25 kg+)', 'All Sizes', 'N/A'] },
      ],
    },
    {
      title: 'Safety & Expiry',
      fields: [
        { key: 'expiry_date',    label: 'Expiry Date',       type: 'date' },
        { key: 'is_vet_approved',label: 'Vet Approved',      type: 'checkbox', defaultValue: false },
        { key: 'is_organic',     label: 'Natural / Organic', type: 'checkbox', defaultValue: false },
      ],
    },
  ],

  // ─── Inventory behavior ───────────────────────────────────────────────────
  inventoryBehavior: {
    mode: 'simple',
    trackBatches:    false,
    trackExpiry:     true,
    trackVariants:   false,
    trackSerials:    false,
    supportRecipes:  false,
    supportLooseQty: false,
    stockUnit: 'pcs',
    allowedUnits: ['Piece', 'Pack', 'Kg', 'Gram', 'Box', 'Bottle'],
    expiryAlertDays: 30,
    stockLabel:   'Stock',
    batchLabel:   'Batch',
    expiryLabel:  'Expiry Date',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '🐾', color: 'teal',
      title: 'Pet Shop Mode Active',
      body: 'Pets, food & accessories.',
      cta: 'Pet Stock', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'pet_products', icon: '🐾', label: 'Pet Products',  sublabel: 'All stock',                href: '/product',   color: 'teal',  permission: 'MANAGE_INVENTORY' },
      { id: 'sales',        icon: '💰', label: 'Sales Today',   sublabel: "Today's billing",           href: '/sales',     color: 'green', permission: 'VIEW_SALES'       },
      { id: 'pet_profiles', icon: '🐕', label: 'Pet Profiles',  sublabel: 'Customer pets',             href: '/pets',      color: 'blue',  permission: 'VIEW_SALES'       },
      { id: 'purchases',    icon: '📦', label: 'Purchases',     sublabel: 'Restock pet supplies',      href: '/purchases', color: 'amber', permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Check expiry on pet food regularly. Track vaccination due dates for pet owner reminders.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier', businessLabel: 'Pet Care Staff', emoji: '🐾', description: 'Billing, stock & customer management' },
      { role: 'manager', businessLabel: 'Shop Manager',   emoji: '👔', description: 'Full access — sales, purchases & reports' },
      { role: 'viewer',  businessLabel: 'Groomer / Helper', emoji: '🐶', description: 'View stock & pet info — no billing' },
    ],
  },

  reportConfig: {
    pageTitle:       'Pet Shop Reports',
    pageSubtitle:    'Pet product sales, expiry tracking & breed-wise trends',
    accentColor:     '#059669',
    topItemsLabel:   'Top Pet Products',
    topItemsIcon:    '🐾',
    topBuyersLabel:  'Top Pet Owners',
    invoiceUnit:     'bills',
    analyticsTitle:  'Pet Shop Analytics',
    chartColor:      '#059669',
    insights: [
      { icon: '🐾', text: 'Check expiry on pet food regularly. Expired pet products pose serious health risks.' },
      { icon: '📅', text: 'Veterinary product expiry must be monitored closely — remove expired items immediately.' },
      { icon: '🔄', text: 'Monthly repeat purchases (pet food, treats) are predictable — use for reorder planning.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Invoice',
    accentColor:      '#059669',
    itemSectionTitle: 'Pet Products',
    showHsnColumn:    false,
    showGstColumns:   true,
    footerNote:       'Consult a veterinarian for pet health concerns. Check expiry before feeding. Store products as directed.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई',  sublabel: 'Total billed today' },
    kpi2: { label: 'Bills',        sublabel: 'Pet owners served'  },
    kpi3: { label: 'मुनाफा',      sublabel: 'Gross profit'       },
    kpi4: { label: 'Udhaar',       sublabel: 'Customer credit'    },
    kpi5: { label: 'GST Payable',  sublabel: 'This month'        },
    kpi6: { label: 'Expiry Alerts',sublabel: 'Pet food expiry'   },
  },
};
