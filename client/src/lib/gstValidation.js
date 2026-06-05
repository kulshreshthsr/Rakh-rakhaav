// GST validation utilities — mirrors server/lib/gstUtils.js for client-side use.
// Keep in sync with the backend: every legal rule here is authoritative.

export const STATE_CODES = {
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
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)',
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

// GST Act Section 25: GSTIN = 15 chars exactly
// 2-digit state code + 5-letter PAN + 4 digits + 1 letter + 1 alphanumeric [1-9A-Z] + Z + 1 checksum
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Normalize a GSTIN string: strip non-alphanumeric, uppercase, cap at 15 chars.
 */
export const normalizeGstin = (value = '') =>
  String(value).replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 15);

// Luhn-like GST checksum algorithm (GST Act specification)
const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Compute the expected checksum character for the first 14 chars of a GSTIN.
 * Returns the character from GSTIN_CHARSET, or null if an invalid character is found.
 */
export function computeGSTINChecksum(gstin14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charVal = GSTIN_CHARSET.indexOf(gstin14[i].toUpperCase());
    if (charVal === -1) return null;
    const product = charVal * (i % 2 === 0 ? 1 : 2);
    sum += product > 35 ? product - 35 : product;
  }
  return GSTIN_CHARSET[sum % 36];
}

/**
 * Validate the 15th-character checksum of a GSTIN.
 * Returns true if valid, false otherwise.
 */
export function validateGSTINChecksum(gstin) {
  if (!gstin || gstin.length !== 15) return false;
  const g = gstin.toUpperCase();
  const expectedChecksum = computeGSTINChecksum(g.slice(0, 14));
  return expectedChecksum !== null && expectedChecksum === g[14];
}

/**
 * Validate a GSTIN string.
 * @returns {{ valid: boolean, stateCode?: string, stateName?: string, pan?: string, error?: string }}
 */
export const validateGSTIN = (gstin) => {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, error: 'GSTIN is required' };
  }
  const g = gstin.trim().toUpperCase();
  if (g.length !== 15) {
    return { valid: false, error: `${15 - g.length} more character${15 - g.length === 1 ? '' : 's'} needed` };
  }
  if (!GSTIN_REGEX.test(g)) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }
  const stateCode = g.substring(0, 2);
  if (!STATE_CODES[stateCode]) {
    return { valid: false, error: `Invalid state code: ${stateCode}` };
  }
  if (!validateGSTINChecksum(g)) {
    return { valid: false, error: 'GSTIN checksum invalid — typo हो सकता है। GSTIN certificate से verify करें।' };
  }
  return {
    valid: true,
    stateCode,
    stateName: STATE_CODES[stateCode],
    pan: g.substring(2, 12),
  };
};

/**
 * Determine supply type.
 * @param {string} shopStateCode  2-digit state code of the seller
 * @param {string} otherStateCode 2-digit state code of the buyer/supplier
 * @returns {'intra_state' | 'inter_state'}
 */
export const getSupplyType = (shopStateCode, otherStateCode) => {
  if (!shopStateCode || !otherStateCode) return 'intra_state';
  return shopStateCode === otherStateCode ? 'intra_state' : 'inter_state';
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Calculate GST for a single line item.
 */
export const calculateItemGST = (basePrice, quantity, gstRate, supplyType) => {
  const taxableAmount = round2(basePrice * quantity);
  const rate = Number(gstRate) || 0;
  const halfRate = rate / 2;

  if (supplyType === 'inter_state') {
    const igstAmount = round2(taxableAmount * rate / 100);
    return { taxableAmount, cgstRate: 0, sgstRate: 0, igstRate: rate, cgstAmount: 0, sgstAmount: 0, igstAmount, totalGst: igstAmount };
  }

  const cgstAmount = round2(taxableAmount * halfRate / 100);
  const sgstAmount = round2(taxableAmount * halfRate / 100);
  return { taxableAmount, cgstRate: halfRate, sgstRate: halfRate, igstRate: 0, cgstAmount, sgstAmount, igstAmount: 0, totalGst: round2(cgstAmount + sgstAmount) };
};

/**
 * Summarise GST on an array of cart items.
 * Each item must have: price_per_unit, quantity, gst_rate.
 */
export const summariseCartGST = (items = [], supplyType = 'intra_state') => {
  let taxable = 0, cgst = 0, sgst = 0, igst = 0;
  for (const item of items) {
    const calc = calculateItemGST(
      Number(item.price_per_unit || 0),
      Number(item.quantity || 0),
      Number(item.gst_rate || 0),
      supplyType
    );
    taxable += calc.taxableAmount;
    cgst    += calc.cgstAmount;
    sgst    += calc.sgstAmount;
    igst    += calc.igstAmount;
  }
  return {
    taxableAmount: round2(taxable),
    cgstAmount:    round2(cgst),
    sgstAmount:    round2(sgst),
    igstAmount:    round2(igst),
    totalTax:      round2(cgst + sgst + igst),
    totalAmount:   round2(taxable + cgst + sgst + igst),
    isInterState:  supplyType === 'inter_state',
  };
};

// Valid GST rate slabs (for dropdown options and validation)
export const GST_RATE_SLABS = [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28];

export const RCM_CATEGORIES = [
  { value: 'GTA',                    label: 'Goods Transport Agency (GTA)' },
  { value: 'legal',                  label: 'Legal Services' },
  { value: 'sponsorship',            label: 'Sponsorship' },
  { value: 'security',               label: 'Security Services' },
  { value: 'motor_vehicle_renting',  label: 'Renting of Motor Vehicle' },
  { value: 'import_services',        label: 'Import of Services' },
  { value: 'unregistered_supplier',  label: 'Unregistered Supplier (Section 9(4))' },
  { value: 'other',                  label: 'Other' },
];

export const ITC_BLOCKED_REASONS = [
  { value: 'personal_use',             label: 'Personal use' },
  { value: 'motor_vehicle',            label: 'Motor vehicle (non-commercial)' },
  { value: 'food_beverages',           label: 'Food & beverages' },
  { value: 'club_membership',          label: 'Club membership' },
  { value: 'travel_benefits',          label: 'Travel benefits to employees' },
  { value: 'construction',             label: 'Construction of immovable property' },
  { value: 'composition_purchase',     label: 'Composition scheme purchase' },
  { value: 'unregistered_supplier',    label: 'Unregistered supplier' },
];
