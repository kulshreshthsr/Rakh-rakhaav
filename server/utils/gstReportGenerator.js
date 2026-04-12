const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const toNumber = (value) => (isFiniteNumber(value) ? Number(value) : NaN);

const toIsoDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const escapeCsv = (value) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const buildCsv = (headers, rows) => [
  headers.map(escapeCsv).join(','),
  ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
].join('\n');

const buildError = (scope, identifier, message) => ({ scope, identifier, message });

const validateCommonRecord = (record, type, errors) => {
  const identifier = record.identifier || record.invoice_number || record.id || `${type}-unknown`;

  if (!record.invoice_number) {
    errors.push(buildError(type, identifier, 'Missing invoice_number'));
  }

  if (!toIsoDate(record.date || record.createdAt)) {
    errors.push(buildError(type, identifier, 'Invalid date'));
  }

  if (!isFiniteNumber(record.taxable_amount)) {
    errors.push(buildError(type, identifier, 'Invalid taxable_amount'));
  }

  if (!isFiniteNumber(record.total_amount)) {
    errors.push(buildError(type, identifier, 'Invalid total_amount'));
  }

  ['cgst_amount', 'sgst_amount', 'igst_amount', 'total_gst'].forEach((field) => {
    if (!isFiniteNumber(record[field])) {
      errors.push(buildError(type, identifier, `Invalid ${field}`));
    }
  });

  if (record.gstin && !GSTIN_REGEX.test(String(record.gstin))) {
    errors.push(buildError(type, identifier, 'Invalid GSTIN'));
  }

  const cgst = round2(record.cgst_amount);
  const sgst = round2(record.sgst_amount);
  const igst = round2(record.igst_amount);
  const totalGst = round2(record.total_gst);
  const expectedTotalGst = round2(cgst + sgst + igst);
  if (Math.abs(totalGst - expectedTotalGst) > 0.01) {
    errors.push(buildError(type, identifier, 'total_gst does not match tax heads'));
  }

  const taxableAmount = round2(record.taxable_amount);
  const totalAmount = round2(record.total_amount);
  if (Math.abs(totalAmount - round2(taxableAmount + totalGst)) > 0.01) {
    errors.push(buildError(type, identifier, 'total_amount does not equal taxable_amount plus total_gst'));
  }
};

const normalizeSaleRecord = (sale, errors, index) => {
  const identifier = sale.invoice_number || sale.id || `sales-${index}`;
  const normalized = {
    identifier,
    invoice_number: sale.invoice_number || '',
    date: toIsoDate(sale.createdAt || sale.date),
    party_name: sale.buyer_name || '',
    gstin: sale.buyer_gstin || '',
    invoice_type: sale.invoice_type || '',
    place_of_supply: sale.buyer_state || '',
    taxable_amount: round2(sale.taxable_amount),
    cgst_amount: round2(sale.cgst_amount),
    sgst_amount: round2(sale.sgst_amount),
    igst_amount: round2(sale.igst_amount),
    total_gst: round2(sale.total_gst),
    total_amount: round2(sale.total_amount),
    gst_rate: sale.gst_rate,
    gst_type: sale.gst_type || '',
  };

  validateCommonRecord(normalized, 'sales', errors);
  if (!normalized.invoice_type || !['B2B', 'B2C'].includes(normalized.invoice_type)) {
    errors.push(buildError('sales', normalized.identifier, 'Invalid invoice_type'));
  }

  return normalized;
};

const normalizePurchaseRecord = (purchase, errors, index) => {
  const identifier = purchase.invoice_number || purchase.id || `purchases-${index}`;
  const normalized = {
    identifier,
    invoice_number: purchase.invoice_number || '',
    date: toIsoDate(purchase.createdAt || purchase.date),
    party_name: purchase.supplier_name || '',
    gstin: purchase.supplier_gstin || '',
    invoice_type: purchase.invoice_type || '',
    place_of_supply: purchase.supplier_state || '',
    taxable_amount: round2(purchase.taxable_amount),
    cgst_amount: round2(purchase.cgst_amount),
    sgst_amount: round2(purchase.sgst_amount),
    igst_amount: round2(purchase.igst_amount),
    total_gst: round2(purchase.total_gst),
    total_amount: round2(purchase.total_amount),
    gst_rate: purchase.gst_rate,
    gst_type: purchase.gst_type || '',
  };

  validateCommonRecord(normalized, 'purchases', errors);
  if (!normalized.invoice_type || !['B2B', 'B2C'].includes(normalized.invoice_type)) {
    errors.push(buildError('purchases', normalized.identifier, 'Invalid invoice_type'));
  }

  return normalized;
};

const hasErrorsForIdentifier = (errors, scope, identifier) => (
  errors.some((error) => error.scope === scope && error.identifier === identifier)
);

const sumTaxHeads = (records) => ({
  cgst: round2(records.reduce((sum, record) => sum + round2(record.cgst_amount), 0)),
  sgst: round2(records.reduce((sum, record) => sum + round2(record.sgst_amount), 0)),
  igst: round2(records.reduce((sum, record) => sum + round2(record.igst_amount), 0)),
});

const applyCredit = (availableCredit, liabilities, fromHead, targets, utilization) => {
  let remainingCredit = round2(availableCredit[fromHead] || 0);

  for (const target of targets) {
    if (remainingCredit <= 0) break;
    const usable = round2(Math.min(remainingCredit, liabilities[target] || 0));
    if (usable <= 0) continue;

    liabilities[target] = round2(liabilities[target] - usable);
    remainingCredit = round2(remainingCredit - usable);
    utilization[fromHead][target] = round2((utilization[fromHead][target] || 0) + usable);
  }

  availableCredit[fromHead] = remainingCredit;
};

const buildGstr3b = (salesRecords, purchaseRecords) => {
  const outputTax = sumTaxHeads(salesRecords);
  const inputCredit = sumTaxHeads(purchaseRecords);
  const liabilities = { ...outputTax };
  const remainingCredit = { ...inputCredit };
  const utilization = {
    igst: { igst: 0, cgst: 0, sgst: 0 },
    cgst: { igst: 0, cgst: 0, sgst: 0 },
    sgst: { igst: 0, cgst: 0, sgst: 0 },
  };

  applyCredit(remainingCredit, liabilities, 'igst', ['igst', 'cgst', 'sgst'], utilization);
  applyCredit(remainingCredit, liabilities, 'cgst', ['cgst', 'igst'], utilization);
  applyCredit(remainingCredit, liabilities, 'sgst', ['sgst', 'igst'], utilization);

  const outwardTaxable = round2(salesRecords.reduce((sum, record) => sum + record.taxable_amount, 0));
  const outputGst = round2(outputTax.cgst + outputTax.sgst + outputTax.igst);
  const inputGst = round2(inputCredit.cgst + inputCredit.sgst + inputCredit.igst);
  const payableByHead = {
    cgst: round2(liabilities.cgst),
    sgst: round2(liabilities.sgst),
    igst: round2(liabilities.igst),
  };
  const payableTotal = round2(payableByHead.cgst + payableByHead.sgst + payableByHead.igst);
  const excessCredit = {
    cgst: round2(remainingCredit.cgst),
    sgst: round2(remainingCredit.sgst),
    igst: round2(remainingCredit.igst),
  };

  return {
    json: {
      outward_taxable: outwardTaxable,
      output_gst: outputGst,
      input_gst: inputGst,
      output_tax: outputTax,
      input_tax_credit: inputCredit,
      credit_utilized: utilization,
      payable_by_head: payableByHead,
      payable_total: payableTotal,
      excess_credit: excessCredit,
      net_payable: payableTotal,
    },
    summary: {
      outward_supplies_taxable_value: outwardTaxable,
      output_tax_liability: outputTax,
      eligible_itc: inputCredit,
      tax_payable_after_itc: payableByHead,
      net_gst_payable: payableTotal,
    },
  };
};

const buildGstr1 = (salesRecords) => {
  const b2bInvoices = salesRecords
    .filter((record) => record.invoice_type === 'B2B')
    .map((record) => ({
      invoice_number: record.invoice_number,
      date: record.date,
      buyer_name: record.party_name,
      buyer_gstin: record.gstin,
      place_of_supply: record.place_of_supply,
      taxable_amount: record.taxable_amount,
      cgst_amount: record.cgst_amount,
      sgst_amount: record.sgst_amount,
      igst_amount: record.igst_amount,
      total_gst: record.total_gst,
      total_amount: record.total_amount,
      gst_rate: record.gst_rate,
      gst_type: record.gst_type,
    }));

  const b2cRecords = salesRecords.filter((record) => record.invoice_type === 'B2C');
  const b2cSummary = {
    count: b2cRecords.length,
    taxable_amount: round2(b2cRecords.reduce((sum, record) => sum + record.taxable_amount, 0)),
    cgst_amount: round2(b2cRecords.reduce((sum, record) => sum + record.cgst_amount, 0)),
    sgst_amount: round2(b2cRecords.reduce((sum, record) => sum + record.sgst_amount, 0)),
    igst_amount: round2(b2cRecords.reduce((sum, record) => sum + record.igst_amount, 0)),
    total_gst: round2(b2cRecords.reduce((sum, record) => sum + record.total_gst, 0)),
    total_amount: round2(b2cRecords.reduce((sum, record) => sum + record.total_amount, 0)),
  };

  const csvRows = salesRecords.map((record) => ({
    invoice_number: record.invoice_number,
    invoice_date: record.date,
    invoice_type: record.invoice_type,
    buyer_name: record.party_name,
    buyer_gstin: record.gstin,
    place_of_supply: record.place_of_supply,
    taxable_amount: record.taxable_amount,
    cgst_amount: record.cgst_amount,
    sgst_amount: record.sgst_amount,
    igst_amount: record.igst_amount,
    total_gst: record.total_gst,
    total_amount: record.total_amount,
    gst_rate: record.gst_rate ?? '',
    gst_type: record.gst_type,
  }));

  return {
    json: {
      b2b_invoices: b2bInvoices,
      b2c_summary: b2cSummary,
      total_invoices: salesRecords.length,
      total_taxable_amount: round2(salesRecords.reduce((sum, record) => sum + record.taxable_amount, 0)),
      total_tax_amount: round2(salesRecords.reduce((sum, record) => sum + record.total_gst, 0)),
      total_invoice_value: round2(salesRecords.reduce((sum, record) => sum + record.total_amount, 0)),
    },
    csv: buildCsv([
      'invoice_number',
      'invoice_date',
      'invoice_type',
      'buyer_name',
      'buyer_gstin',
      'place_of_supply',
      'taxable_amount',
      'cgst_amount',
      'sgst_amount',
      'igst_amount',
      'total_gst',
      'total_amount',
      'gst_rate',
      'gst_type',
    ], csvRows),
  };
};

const buildRegister = (records, kind) => {
  const csvHeaders = [
    'invoice_number',
    'date',
    'party_name',
    'gstin',
    'invoice_type',
    'place_of_supply',
    'taxable_amount',
    'cgst_amount',
    'sgst_amount',
    'igst_amount',
    'total_gst',
    'total_amount',
    'gst_rate',
    'gst_type',
  ];

  const json = records.map((record) => ({
    invoice_number: record.invoice_number,
    date: record.date,
    ...(kind === 'sales'
      ? { buyer_name: record.party_name, buyer_gstin: record.gstin }
      : { supplier_name: record.party_name, supplier_gstin: record.gstin }),
    invoice_type: record.invoice_type,
    place_of_supply: record.place_of_supply,
    taxable_amount: record.taxable_amount,
    cgst_amount: record.cgst_amount,
    sgst_amount: record.sgst_amount,
    igst_amount: record.igst_amount,
    total_gst: record.total_gst,
    total_amount: record.total_amount,
    gst_rate: record.gst_rate,
    gst_type: record.gst_type,
  }));

  const csvRows = records.map((record) => ({
    invoice_number: record.invoice_number,
    date: record.date,
    party_name: record.party_name,
    gstin: record.gstin,
    invoice_type: record.invoice_type,
    place_of_supply: record.place_of_supply,
    taxable_amount: record.taxable_amount,
    cgst_amount: record.cgst_amount,
    sgst_amount: record.sgst_amount,
    igst_amount: record.igst_amount,
    total_gst: record.total_gst,
    total_amount: record.total_amount,
    gst_rate: record.gst_rate ?? '',
    gst_type: record.gst_type,
  }));

  return {
    json,
    csv: buildCsv(csvHeaders, csvRows),
  };
};

const generateGSTComplianceReport = (input = {}) => {
  const errors = [];

  const rawSales = Array.isArray(input.sales) ? input.sales : [];
  const rawPurchases = Array.isArray(input.purchases) ? input.purchases : [];

  const normalizedSales = rawSales.map((sale, index) => normalizeSaleRecord(sale, errors, index));
  const normalizedPurchases = rawPurchases.map((purchase, index) => normalizePurchaseRecord(purchase, errors, index));

  const validSales = normalizedSales.filter((record) => !hasErrorsForIdentifier(errors, 'sales', record.identifier));
  const validPurchases = normalizedPurchases.filter((record) => !hasErrorsForIdentifier(errors, 'purchases', record.identifier));

  const gstr1 = buildGstr1(validSales);
  const gstr3b = buildGstr3b(validSales, validPurchases);
  const purchaseRegister = buildRegister(validPurchases, 'purchases');
  const salesRegister = buildRegister(validSales, 'sales');

  return {
    gstr1,
    gstr3b,
    purchase_register: purchaseRegister,
    sales_register: salesRegister,
    pdf_data: {
      title: input.title || 'GST Report',
      sections: [
        {
          heading: 'GSTR-3B Summary',
          content: gstr3b.summary,
        },
        {
          heading: 'GSTR-1 Summary',
          content: gstr1.json,
        },
        {
          heading: 'Sales Register',
          table: salesRegister.json,
        },
        {
          heading: 'Purchase Register',
          table: purchaseRegister.json,
        },
      ],
    },
    errors,
  };
};

module.exports = {
  generateGSTComplianceReport,
};
