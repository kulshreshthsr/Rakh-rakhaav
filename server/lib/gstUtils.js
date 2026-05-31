'use strict';

const STATE_CODES = {
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

// GST Act: 15-char format — 2-digit state code + 5-letter PAN + 4 digits + 1 letter + 1 alphanumeric + Z + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Validate a GSTIN string.
 * Returns { valid, stateCode, stateName, pan, error }
 */
const validateGSTIN = (gstin) => {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, error: 'GSTIN is required' };
  }
  const g = gstin.trim().toUpperCase();
  if (g.length !== 15) {
    return { valid: false, error: `GSTIN must be exactly 15 characters (got ${g.length})` };
  }
  if (!GSTIN_REGEX.test(g)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Expected: 2-digit state code + 5-letter PAN + 4 digits + 1 letter + 1 alphanumeric + Z + 1 checksum',
    };
  }
  const stateCode = g.substring(0, 2);
  if (!STATE_CODES[stateCode]) {
    return { valid: false, error: `Invalid state code: ${stateCode}` };
  }
  return {
    valid: true,
    stateCode,
    stateName: STATE_CODES[stateCode],
    pan: g.substring(2, 12),
  };
};

/**
 * Determine supply type from two 2-digit state codes.
 * Returns 'intra_state' or 'inter_state'.
 */
const getSupplyType = (shopStateCode, buyerStateCode) => {
  if (!shopStateCode || !buyerStateCode) return 'intra_state';
  return shopStateCode === buyerStateCode ? 'intra_state' : 'inter_state';
};

/**
 * Calculate GST amounts for a single line item.
 * basePrice × quantity = taxable; then split CGST+SGST or IGST depending on supply type.
 */
const calculateItemGST = (basePrice, quantity, gstRate, supplyType) => {
  const taxableAmount = round2(basePrice * quantity);
  const rate = Number(gstRate) || 0;
  const halfRate = rate / 2;

  if (supplyType === 'inter_state') {
    const igstAmount = round2(taxableAmount * rate / 100);
    return {
      taxableAmount,
      cgstRate: 0, sgstRate: 0, igstRate: rate,
      cgstAmount: 0, sgstAmount: 0, igstAmount,
      totalGst: igstAmount,
      gst_type: 'IGST',
    };
  }

  const cgstAmount = round2(taxableAmount * halfRate / 100);
  const sgstAmount = round2(taxableAmount * halfRate / 100);
  return {
    taxableAmount,
    cgstRate: halfRate, sgstRate: halfRate, igstRate: 0,
    cgstAmount, sgstAmount, igstAmount: 0,
    totalGst: round2(cgstAmount + sgstAmount),
    gst_type: 'CGST_SGST',
  };
};

/**
 * Classify a sale for GSTR-1 tables:
 *   B2B  → Table 4 (any B2B invoice)
 *   B2CL → Table 5 (inter-state, unregistered, > ₹2,50,000)
 *   B2CS → Table 7 (intra-state or inter-state ≤ ₹2,50,000, unregistered)
 */
const classifyForGSTR1 = (sale) => {
  if (sale.buyer_gstin || sale.is_b2b || sale.invoice_type === 'B2B') return 'B2B';
  const isInterState = sale.supply_type === 'inter_state';
  if (isInterState && (sale.total_amount || 0) > 250000) return 'B2CL';
  return 'B2CS';
};

/**
 * Format a JS Date as 'DD-Mon-YYYY' for GSTN portal uploads.
 * e.g. 2026-01-15 → '15-Jan-2026'
 */
const formatGSTNDate = (date) => {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
};

/**
 * Get fiscal quarter number (1=Apr-Jun, 2=Jul-Sep, 3=Oct-Dec, 4=Jan-Mar)
 * for a given calendar month (1-12).
 */
const getFiscalQuarter = (calendarMonth) => {
  if (calendarMonth >= 4 && calendarMonth <= 6) return 1;
  if (calendarMonth >= 7 && calendarMonth <= 9) return 2;
  if (calendarMonth >= 10 && calendarMonth <= 12) return 3;
  return 4; // Jan-Mar
};

/**
 * Get date range for a given fiscal quarter of a financial year.
 * year = the year in which April falls (e.g. 2025 for FY 2025-26).
 * quarter = 1..4
 */
const getQuarterDateRange = (fiscalYear, quarter) => {
  const monthRanges = {
    1: { start: [fiscalYear,     3,  1], end: [fiscalYear,     5, 30] }, // Apr-Jun
    2: { start: [fiscalYear,     6,  1], end: [fiscalYear,     8, 30] }, // Jul-Sep
    3: { start: [fiscalYear,     9,  1], end: [fiscalYear,    11, 30] }, // Oct-Dec
    4: { start: [fiscalYear + 1, 0,  1], end: [fiscalYear + 1, 2, 30] }, // Jan-Mar
  };
  const r = monthRanges[quarter];
  const fromDate = new Date(r.start[0], r.start[1], r.start[2]);
  const toDate   = new Date(r.end[0],   r.end[1],   r.end[2], 23, 59, 59, 999);
  return { fromDate, toDate };
};

/**
 * Determine current filing period for a shop.
 * Returns an object with type, period descriptor, and due date text.
 */
const getCurrentFilingPeriod = (shop, referenceDate = new Date()) => {
  const month = referenceDate.getMonth() + 1;
  const year  = referenceDate.getFullYear();

  if (shop.gst_type === 'composition') {
    const q = getFiscalQuarter(month);
    const qLabels = { 1: 'Q1 (Apr-Jun)', 2: 'Q2 (Jul-Sep)', 3: 'Q3 (Oct-Dec)', 4: 'Q4 (Jan-Mar)' };
    return { type: 'composition', quarter: q, label: qLabels[q], year, dueDate: '18th of month after quarter end (CMP-08)' };
  }

  if (shop.filing_frequency === 'quarterly') {
    const q = getFiscalQuarter(month);
    return { type: 'qrmp', quarter: q, year, month, dueDate: 'GSTR-1: 13th, GSTR-3B: 22nd/24th after quarter end' };
  }

  return { type: 'monthly', month, year, dueDate: 'GSTR-1: 11th, GSTR-3B: 20th of next month' };
};

module.exports = {
  STATE_CODES,
  GSTIN_REGEX,
  round2,
  validateGSTIN,
  getSupplyType,
  calculateItemGST,
  classifyForGSTR1,
  formatGSTNDate,
  getFiscalQuarter,
  getQuarterDateRange,
  getCurrentFilingPeriod,
};
