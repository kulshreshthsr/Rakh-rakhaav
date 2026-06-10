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

// Luhn-like GST checksum algorithm (GST Act specification)
const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Compute the expected checksum character for the first 14 chars of a GSTIN.
 * Returns the character, or null if an invalid character is encountered.
 */
const computeGSTINChecksum = (gstin14) => {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charVal = GSTIN_CHARSET.indexOf(gstin14[i].toUpperCase());
    if (charVal === -1) return null;
    const product = charVal * (i % 2 === 0 ? 1 : 2);
    sum += product > 35 ? product - 35 : product;
  }
  return GSTIN_CHARSET[sum % 36];
};

/**
 * Validate the 15th-character checksum of a GSTIN.
 * Returns true if valid, false otherwise.
 */
const validateGSTINChecksum = (gstin) => {
  if (!gstin || gstin.length !== 15) return false;
  const g = gstin.toUpperCase();
  const expectedChecksum = computeGSTINChecksum(g.slice(0, 14));
  return expectedChecksum !== null && expectedChecksum === g[14];
};

/**
 * Validate a GSTIN string.
 * Returns { valid, stateCode, stateName, pan, error, checksumWarning }
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
 * Determine supply type from two 2-digit state codes.
 * Returns 'intra_state' or 'inter_state'.
 */
const getSupplyType = (shopStateCode, buyerStateCode) => {
  if (!shopStateCode || !buyerStateCode) return 'intra_state';
  return shopStateCode === buyerStateCode ? 'intra_state' : 'inter_state';
};

/**
 * Calculate GST amounts for a single line item.
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
 * Classify a sale for GSTR-1 tables.
 * Handles SEZ/DE supplies in addition to B2B, B2CL, B2CS.
 */
const classifyForGSTR1 = (sale) => {
  if (sale.is_sez_supply) return sale.sez_type === 'without_payment' ? 'SEWOP' : 'SEWP';
  if (sale.is_deemed_export) return 'DE';
  if (sale.buyer_gstin || sale.is_b2b || sale.invoice_type === 'B2B') return 'B2B';
  const isInterState = sale.supply_type === 'inter_state';
  if (isInterState && (sale.total_amount || 0) > 250000) return 'B2CL';
  return 'B2CS';
};

/**
 * Compute the inv_typ field for a B2B invoice in GSTR-1.
 * R = Regular, SEWP = SEZ with payment, SEWOP = SEZ without payment, DE = Deemed export.
 */
const getInvTyp = (sale) => {
  if (sale.is_sez_supply) return sale.sez_type === 'without_payment' ? 'SEWOP' : 'SEWP';
  if (sale.is_deemed_export) return 'DE';
  return 'R';
};

/**
 * Format a JS Date as 'DD-Mon-YYYY' for GSTN portal uploads.
 */
const formatGSTNDate = (date) => {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
};

/**
 * Get fiscal quarter number (1=Apr-Jun, 2=Jul-Sep, 3=Oct-Dec, 4=Jan-Mar).
 */
const getFiscalQuarter = (calendarMonth) => {
  if (calendarMonth >= 4 && calendarMonth <= 6) return 1;
  if (calendarMonth >= 7 && calendarMonth <= 9) return 2;
  if (calendarMonth >= 10 && calendarMonth <= 12) return 3;
  return 4;
};

/**
 * Get date range for a given fiscal quarter of a financial year.
 */
const getQuarterDateRange = (fiscalYear, quarter) => {
  const monthRanges = {
    1: { start: [fiscalYear,     3,  1], end: [fiscalYear,     5, 30] },
    2: { start: [fiscalYear,     6,  1], end: [fiscalYear,     8, 30] },
    3: { start: [fiscalYear,     9,  1], end: [fiscalYear,    11, 30] },
    4: { start: [fiscalYear + 1, 0,  1], end: [fiscalYear + 1, 2, 30] },
  };
  const r = monthRanges[quarter];
  const fromDate = new Date(r.start[0], r.start[1], r.start[2]);
  const toDate   = new Date(r.end[0],   r.end[1],   r.end[2], 23, 59, 59, 999);
  return { fromDate, toDate };
};

/**
 * Determine current filing period for a shop.
 */
const getCurrentFilingPeriod = (shop, referenceDate = new Date()) => {
  const month = referenceDate.getMonth() + 1;
  const year  = referenceDate.getFullYear();

  if (shop.gst_type === 'composition') {
    const q = getFiscalQuarter(month);
    const fyStart = month >= 4 ? year : year - 1;
    const fyLabel = `FY ${fyStart}-${String(fyStart + 1).slice(2)}`;
    const qLabels = {
      1: `Q1 Apr-Jun ${fyStart} (${fyLabel})`,
      2: `Q2 Jul-Sep ${fyStart} (${fyLabel})`,
      3: `Q3 Oct-Dec ${fyStart} (${fyLabel})`,
      4: `Q4 Jan-Mar ${fyStart + 1} (${fyLabel})`,
    };
    return { type: 'composition', quarter: q, label: qLabels[q], year, fiscalYear: fyLabel, dueDate: '18th of month after quarter end (CMP-08)' };
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
  computeGSTINChecksum,
  validateGSTINChecksum,
  validateGSTIN,
  getSupplyType,
  calculateItemGST,
  classifyForGSTR1,
  getInvTyp,
  formatGSTNDate,
  getFiscalQuarter,
  getQuarterDateRange,
  getCurrentFilingPeriod,
};
