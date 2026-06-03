export const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
];

export const UNION_TERRITORIES = [
  'Andaman & Nicobar Islands','Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu','Delhi',
  'Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

export const ALL_STATES_AND_UTS = [...INDIAN_STATES, ...UNION_TERRITORIES]; // combined, sorted A-Z

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GSTIN_LENGTH = 15;

export const GST_STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const normalizeGstin = (value) =>
  value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);

export const normalizeState = (value = '') => value.trim().toLowerCase();

export const fmt = (n) => parseFloat(n || 0).toFixed(2);

export const fmtINR = (n) =>
  '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtINRShort = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (v >= 100000)   return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)     return '₹' + (v / 1000).toFixed(1) + 'K';
  return '₹' + v.toFixed(0);
};

export const cleanPhone = (phone = '') => phone.replace(/\D/g, '');

export const formatDateInput = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const todayInputValue = () => formatDateInput(new Date());

// Auth token helper
export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null;

// Bill rounding
export const getRoundedBillValues = (amount) => {
  const n = Number(amount || 0);
  const rounded = Math.round(n);
  return { roundedTotal: rounded, roundOff: parseFloat((rounded - n).toFixed(2)) };
};

// Sale record date ISO builder
export const getSaleRecordDateISO = (value, reference = new Date()) => {
  if (!value) return new Date().toISOString();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date().toISOString();
  const d = new Date(reference);
  if (isNaN(d.getTime())) return new Date().toISOString();
  d.setFullYear(year, month - 1, day);
  return d.toISOString();
};

// Initial sale form builder
export const buildInitialSaleForm = (overrides = {}) => ({
  payment_type: 'cash',
  amount_paid: '',
  buyer_name: '',
  buyer_phone: '',
  buyer_gstin: '',
  buyer_address: '',
  buyer_state: '',
  notes: '',
  sale_date: todayInputValue(),
  discount_type: 'none',
  discount_value: '',
  ...overrides,
});

// Empty sale line item
export const emptySaleItem = () => ({
  _rowId: Math.random().toString(36).slice(2),
  product_id: '',
  quantity: 1,
  price_per_unit: '',
  item_metadata: {},
  unit_of_measurement: 'NOS',
  remarks: '',
});

// Month filter value from date
export const getMonthFilterValue = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// WhatsApp bill share message builder
export const buildWhatsAppShareMessage = (sale, shopName) => {
  const saleDate = new Date(sale.createdAt || sale.sold_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const advance = sale.payment_type === 'credit'
    ? parseFloat(sale.amount_paid || 0)
    : parseFloat(sale.total_amount || 0);
  const due = sale.payment_type === 'credit'
    ? Math.max(0, parseFloat(sale.total_amount || 0) - advance)
    : 0;
  const payLabel =
    sale.payment_type === 'cash' ? 'Cash (Paid)' :
    sale.payment_type === 'upi'  ? 'UPI (Paid)' :
    sale.payment_type === 'bank' ? 'Bank Transfer' : 'Udhaar (Credit)';
  const itemLines = (sale.items?.length > 0)
    ? sale.items.map((item, i) =>
        `  ${i + 1}. ${item.product_name} x ${item.quantity} @ ₹${fmt(item.price_per_unit)} = ₹${fmt(item.total_amount)}`
      ).join('\n')
    : `  1. ${sale.product_name} x ${sale.quantity} @ ₹${fmt(sale.price_per_unit)} = ₹${fmt(sale.total_amount)}`;
  const displayName = shopName?.trim() || 'our shop';
  return [
    sale.buyer_name && sale.buyer_name !== 'Walk-in Customer'
      ? `Namaste ${sale.buyer_name} ji,` : 'Namaste,',
    '',
    'Invoice / Bill Details',
    `Shop: ${displayName}`,
    `Invoice No: ${sale.invoice_number}`,
    `Date: ${saleDate}`,
    'Items:',
    itemLines,
    `Taxable Amount: ₹${fmt(sale.taxable_amount)}`,
    `GST: ₹${fmt(sale.total_gst)}`,
    `Total Amount: ₹${fmt(sale.total_amount)}`,
    `Payment: ${payLabel}`,
    ...(sale.payment_type === 'credit'
      ? [`Advance Payment: ₹${fmt(advance)}`, `Udhaar / Due: ₹${fmt(due)}`]
      : []),
    '',
    `Thank you for choosing ${displayName}`,
  ].join('\n');
};

// Format full datetime for display
export const formatFullDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// Normalize barcode string
export const normalizeBarcode = (value = '') =>
  String(value).replace(/\s+/g, '').trim();
