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
