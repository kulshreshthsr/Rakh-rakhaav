export default {
  // Entity labels
  product:        'Book / Item',
  products:       'Books & Items',
  productHindi:   'किताब',
  item:           'Item',
  items:          'Items',
  inventory:      'Stock',

  // Transactions
  invoice:        'Bill',
  invoices:       'Bills',

  // People
  supplier:       'Publisher / Supplier',
  suppliers:      'Publishers / Suppliers',

  // Actions
  addProduct:     'Add Book / Item',
  newSale:        'New Bill',
  editSale:       'Edit Bill',

  // Search placeholders
  searchProduct:  'Search books by title, author, class, subject...',
  searchSupplier: 'Search publisher or supplier name...',
  searchSale:     'Search bill, customer, book...',

  // Empty states
  noProducts:   'No books or items added yet.',
  noSales:      'No bills yet.',

  // Section headers
  supplierSection: 'Publisher / Supplier Info',

  // Directory pages
  supplierDirectory:      'Publisher Directory',
  supplierDirectoryHindi: 'पब्लिशर लिस्ट',
  allSuppliers:           'All Publishers / Suppliers',
  selectSupplier:         'Select a publisher to see details.',
  backToSales:            'Back to Bills',

  // Dashboard quick actions
  quickNewSale:       'New Bill',
  quickNewSaleHindi:  'नया Bill बनाओ',
  quickAddStock:      'Add Book',
  quickAddStockHindi: 'Book जोड़ो',

  // KPIs
  kpiInvoices:      'Bills',
  kpiTotalProducts: 'Books & Items',
  kpiRecentSales:   'Recent Bills',

  productFormSchema: {
    nameLabel:        'Title / Item Name',
    descriptionLabel: 'Author / Description',
    trackQuantity:    true,
    showBarcode:      true,
    unitOptions:      ['Piece', 'Set', 'Pack'],
    attributesTitle:  'Book Details',
  },
  saleFormSchema: {
    paymentMethods:     ['cash', 'upi', 'credit'],
    showBarcodeScanner: true,
    defaultPayment:     'cash',
  },
  productAttributes: [
    { key: 'author',    label: 'Author',    type: 'text',   placeholder: 'Author name' },
    { key: 'publisher', label: 'Publisher', type: 'text',   placeholder: 'Publisher name' },
    { key: 'category',  label: 'Category',  type: 'select', options: ['Textbook', 'Novel', 'Children\'s', 'Reference', 'Religious', 'Notebook', 'Stationery', 'Magazine', 'Other'] },
    { key: 'class_grade',label: 'Class / Grade', type: 'text', placeholder: 'e.g. Class 10, Grade 5' },
    { key: 'language',  label: 'Language',  type: 'select', options: ['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali', 'Other'] },
    { key: 'isbn',      label: 'ISBN',      type: 'text',   placeholder: '13-digit ISBN' },
  ],
  invoiceExtraFields: [],
  invoiceLineFields:  [],

  productAttributeSections: [
    {
      title: 'Book / Item Details',
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: ['Textbook', 'Novel', 'Children\'s Book', 'Reference', 'Religious', 'Competitive Exam', 'Magazine', 'Notebook', 'Stationery', 'Other'] },
        { key: 'author',   label: 'Author',   type: 'text',   placeholder: 'Author name' },
        { key: 'publisher',label: 'Publisher',type: 'text',   placeholder: 'Publisher / Brand name' },
        { key: 'language', label: 'Language', type: 'select', options: ['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali', 'Kannada', 'Other'] },
        { key: 'isbn',     label: 'ISBN',     type: 'text',   placeholder: '13-digit ISBN (for books)' },
      ],
    },
    {
      title: 'Academic Details',
      fields: [
        { key: 'class_grade', label: 'Class / Grade',  type: 'text',   placeholder: 'e.g. Class 10, Grade 5' },
        { key: 'subject',     label: 'Subject',         type: 'select', options: ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'General', 'N/A'] },
        { key: 'board',       label: 'Board / Exam',   type: 'select', options: ['CBSE', 'ICSE', 'State Board', 'IIT-JEE', 'NEET', 'UPSC', 'Bank PO', 'SSC', 'Railway', 'N/A', 'Other'] },
        { key: 'edition',     label: 'Edition / Year', type: 'text',   placeholder: 'e.g. 2025 Edition' },
        { key: 'is_new_syllabus', label: 'New Syllabus', type: 'checkbox', defaultValue: false, hint: 'Check if this is the revised / new syllabus edition' },
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
    allowedUnits: ['Piece', 'Copy', 'Set', 'Pack'],
    expiryAlertDays: 30,
    stockLabel:   'Copies',
    batchLabel:   'Batch / Edition',
    expiryLabel:  'Expiry',
    variantLabel: 'Variant',
    serialLabel:  'Serial No.',
    recipeLabel:  'Recipe',
    deductionMethod: 'simple',
  },

  dashboardConfig: {
    callout: {
      icon: '📚', color: 'indigo',
      title: 'Bookstall Mode Active',
      body: 'Class-wise book inventory, school kits & stationery management.',
      cta: 'Book Inventory', href: '/product', permission: 'MANAGE_INVENTORY',
    },
    tiles: [
      { id: 'books',     icon: '📖', label: 'Books & Copies',  sublabel: 'Class-wise inventory',    href: '/product',   color: 'indigo', permission: 'MANAGE_INVENTORY' },
      { id: 'sales',     icon: '🧾', label: 'Book Sales',      sublabel: "Today's school sales",    href: '/sales',     color: 'green',  permission: 'VIEW_SALES'       },
      { id: 'purchases', icon: '🛒', label: 'Restock Books',   sublabel: 'Purchase from publisher', href: '/purchases', color: 'amber',  permission: 'CREATE_PURCHASE'  },
    ],
    tip: 'Season demand peaks at school opening. Keep syllabus books adequately stocked.',
  },

  roleConfig: {
    suggestedRoles: [
      { role: 'cashier',    businessLabel: 'Counter Staff',  emoji: '📚', description: 'Billing, inventory & customer management' },
      { role: 'manager',    businessLabel: 'Store Manager',  emoji: '👔', description: 'Full access — sales, stock & reports' },
      { role: 'accountant', businessLabel: 'Accounts',       emoji: '📊', description: 'Financial records & reports only' },
    ],
  },

  reportConfig: {
    pageTitle:       'Bookstall Reports',
    pageSubtitle:    'Book sales, publisher trends & seasonal demand analytics',
    accentColor:     '#3730a3',
    topItemsLabel:   'Top Books',
    topItemsIcon:    '📚',
    topBuyersLabel:  'Top Customers',
    invoiceUnit:     'bills',
    analyticsTitle:  'Bookstall Analytics',
    chartColor:      '#3730a3',
    insights: [
      { icon: '📚', text: 'School season (June-July) drives peak demand. Pre-stock textbooks 2 months early.' },
      { icon: '📖', text: 'Stationery bundled with books increases average bill value significantly.' },
      { icon: '🎓', text: 'Class-wise book bundles are popular with parents — track demand by grade.' },
    ],
  },

  invoiceConfig: {
    documentTitle:    'Book Invoice',
    accentColor:      '#0369a1',
    itemSectionTitle: 'Books & Items',
    showHsnColumn:    true,
    showGstColumns:   true,
    footerNote:       'Books once sold are non-returnable unless damaged at time of purchase.',
  },

  kpiConfig: {
    kpi1: { label: 'आज की कमाई', sublabel: 'Total billed today'  },
    kpi2: { label: 'Books Sold',  sublabel: 'Copies today'        },
    kpi3: { label: 'मुनाफा',     sublabel: 'Gross profit'        },
    kpi4: { label: 'Udhaar',      sublabel: 'School/student dues' },
    kpi5: { label: 'GST Payable', sublabel: 'This month'         },
    kpi6: { label: 'Stock Alerts',sublabel: 'Low stock books'    },
  },
};
