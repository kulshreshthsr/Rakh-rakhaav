const Sale = require('../models/salesModel');
const Purchase = require('../models/purchaseModel');
const Expense = require('../models/expenseModel');
const Income = require('../models/incomeModel');
const BankEntry = require('../models/bankEntryModel');
const Customer = require('../models/customerModel');
const Supplier = require('../models/supplierModel');
const Udhaar = require('../models/udhaarModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const AuditTrail = require('../models/auditTrailModel');

const round2 = (value) => Number(Number(value || 0).toFixed(2));
const getIsoDate = (value) => new Date(value || Date.now()).toISOString();
const isBankMode = (mode) => ['bank', 'upi'].includes(String(mode || '').toLowerCase());
const isCashMode = (mode) => String(mode || '').toLowerCase() === 'cash';

const normalizeDateRange = (from, to) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
};

const pushValidationError = (errors, code, message, reference_id = '') => {
  errors.push({ code, message, reference_id });
};

const getTransactionTypeFromReference = (entry, fallback) => {
  if (entry.reference_type === 'sale') return 'sale';
  if (entry.reference_type === 'purchase') return 'purchase';
  return fallback;
};

const buildPartyLedger = ({
  party,
  type,
  entries,
  errors,
  openingBalanceOverride = null,
}) => {
  const openingBalance = round2(openingBalanceOverride != null ? openingBalanceOverride : (party.opening_balance || 0));
  let runningBalance = openingBalance;
  let totalSales = 0;
  let totalPurchase = 0;
  let totalPaid = 0;
  let totalReceived = 0;

  const sortedEntries = [...entries].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
  const transactions = sortedEntries.map((entry) => {
    const isDebit = entry.type === 'debit' || entry.type === 'diya';
    const amount = round2(entry.amount || 0);
    const transactionType = getTransactionTypeFromReference(
      entry,
      isDebit ? (type === 'customer' ? 'sale' : 'purchase') : (type === 'customer' ? 'receipt' : 'payment')
    );

    const debit = isDebit ? amount : 0;
    const credit = isDebit ? 0 : amount;
    runningBalance = round2(runningBalance + debit - credit);

    if (type === 'customer' && transactionType === 'sale') totalSales = round2(totalSales + amount);
    if (type === 'supplier' && transactionType === 'purchase') totalPurchase = round2(totalPurchase + amount);
    if (type === 'customer' && !isDebit) totalReceived = round2(totalReceived + amount);
    if (type === 'supplier' && !isDebit) totalPaid = round2(totalPaid + amount);

    if (!entry.reference_id && ['sale', 'purchase', 'receipt', 'payment'].includes(transactionType)) {
      pushValidationError(errors, 'MISSING_REFERENCE', `Missing reference for ${party.name} ${transactionType} entry`, party.name);
    }

    return {
      date: getIsoDate(entry.date || entry.createdAt),
      transaction_type: transactionType,
      reference_id: entry.reference_id || '',
      debit,
      credit,
      running_balance: runningBalance,
      note: entry.note || '',
      payment_mode: entry.payment_mode || '',
    };
  });

  if (runningBalance < 0) {
    pushValidationError(errors, 'NEGATIVE_PARTY_BALANCE', `${party.name} has a negative closing balance`, party.name);
  }

  return {
    party_id: String(party._id),
    party_name: party.name,
    type,
    opening_balance: openingBalance,
    total_sales: totalSales,
    total_purchase: totalPurchase,
    total_paid: totalPaid,
    total_received: totalReceived,
    closing_balance: runningBalance,
    transactions,
  };
};

const appendAccountEntry = (bucket, {
  date,
  transaction_type,
  reference_id,
  inflow = 0,
  outflow = 0,
  note = '',
}) => {
  bucket.push({
    date: getIsoDate(date),
    transaction_type,
    reference_id: reference_id || '',
    inflow: round2(inflow),
    outflow: round2(outflow),
    note,
  });
};

const finalizeAccountLedger = (openingBalance, entries) => {
  let runningBalance = round2(openingBalance || 0);
  const transactions = [...entries]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((entry) => {
      runningBalance = round2(runningBalance + entry.inflow - entry.outflow);
      return { ...entry, running_balance: runningBalance };
    });

  return {
    opening_balance: round2(openingBalance || 0),
    closing_balance: runningBalance,
    total_inflow: round2(transactions.reduce((sum, entry) => sum + entry.inflow, 0)),
    total_outflow: round2(transactions.reduce((sum, entry) => sum + entry.outflow, 0)),
    transactions,
  };
};

const detectDuplicates = (records, keyBuilder, errors, code, label) => {
  const seen = new Set();
  records.forEach((record) => {
    const key = keyBuilder(record);
    if (!key) return;
    if (seen.has(key)) {
      pushValidationError(errors, code, `Duplicate ${label} detected`, key);
      return;
    }
    seen.add(key);
  });
};

const generateAccountingSummary = async ({ shopId, from = null, to = null }) => {
  const dateRange = normalizeDateRange(from, to);
  const fromDate = dateRange?.$gte ? new Date(dateRange.$gte) : null;
  const baseFilter = { shop: shopId };
  const withDate = (field = 'createdAt') => (
    dateRange ? { ...baseFilter, [field]: dateRange } : baseFilter
  );
  const beforeDate = (field = 'createdAt') => (
    fromDate ? { ...baseFilter, [field]: { $lt: fromDate } } : null
  );

  const [
    sales,
    purchases,
    expenses,
    income,
    bankEntries,
    customers,
    suppliers,
    customerLedgerEntries,
    supplierLedgerEntries,
    auditTrail,
    salesBefore,
    purchasesBefore,
    expensesBefore,
    incomeBefore,
    bankEntriesBefore,
    customerLedgerEntriesBefore,
    supplierLedgerEntriesBefore,
  ] = await Promise.all([
    Sale.find(withDate()).sort({ createdAt: 1 }).lean(),
    Purchase.find(withDate()).sort({ createdAt: 1 }).lean(),
    Expense.find(withDate('date')).sort({ date: 1 }).lean(),
    Income.find(withDate('date')).sort({ date: 1 }).lean(),
    BankEntry.find(withDate('date')).sort({ date: 1 }).lean(),
    Customer.find(baseFilter).sort({ name: 1 }).lean(),
    Supplier.find(baseFilter).sort({ name: 1 }).lean(),
    Udhaar.find(withDate('date')).sort({ date: 1 }).lean(),
    SupplierUdhaar.find(withDate('date')).sort({ date: 1 }).lean(),
    AuditTrail.find(withDate('timestamp')).sort({ timestamp: -1 }).limit(200).lean(),
    fromDate ? Sale.find(beforeDate()).lean() : [],
    fromDate ? Purchase.find(beforeDate()).lean() : [],
    fromDate ? Expense.find(beforeDate('date')).lean() : [],
    fromDate ? Income.find(beforeDate('date')).lean() : [],
    fromDate ? BankEntry.find(beforeDate('date')).lean() : [],
    fromDate ? Udhaar.find(beforeDate('date')).lean() : [],
    fromDate ? SupplierUdhaar.find(beforeDate('date')).lean() : [],
  ]);

  const errors = [];
  detectDuplicates(sales, (sale) => sale.invoice_number, errors, 'DUPLICATE_SALE', 'sale invoice');
  detectDuplicates(purchases, (purchase) => purchase.invoice_number, errors, 'DUPLICATE_PURCHASE', 'purchase invoice');

  const customerEntryMap = customerLedgerEntries.reduce((map, entry) => {
    const key = String(entry.customer);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
    return map;
  }, new Map());
  const supplierEntryMap = supplierLedgerEntries.reduce((map, entry) => {
    const key = String(entry.supplier);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
    return map;
  }, new Map());
  const customerOpeningMap = customerLedgerEntriesBefore.reduce((map, entry) => {
    const key = String(entry.customer);
    const current = map.get(key) || 0;
    const delta = entry.type === 'debit' || entry.type === 'diya' ? Number(entry.amount || 0) : -Number(entry.amount || 0);
    map.set(key, round2(current + delta));
    return map;
  }, new Map());
  const supplierOpeningMap = supplierLedgerEntriesBefore.reduce((map, entry) => {
    const key = String(entry.supplier);
    const current = map.get(key) || 0;
    const delta = entry.type === 'debit' || entry.type === 'diya' ? Number(entry.amount || 0) : -Number(entry.amount || 0);
    map.set(key, round2(current + delta));
    return map;
  }, new Map());

  const partyLedgers = [
    ...customers.map((customer) => buildPartyLedger({
      party: customer,
      type: 'customer',
      entries: customerEntryMap.get(String(customer._id)) || [],
      errors,
      openingBalanceOverride: round2((customer.opening_balance || 0) + (customerOpeningMap.get(String(customer._id)) || 0)),
    })),
    ...suppliers.map((supplier) => buildPartyLedger({
      party: supplier,
      type: 'supplier',
      entries: supplierEntryMap.get(String(supplier._id)) || [],
      errors,
      openingBalanceOverride: round2((supplier.opening_balance || 0) + (supplierOpeningMap.get(String(supplier._id)) || 0)),
    })),
  ];

  const cashEntries = [];
  const bankAccountEntries = [];
  let cashOpeningDelta = 0;
  let bankOpeningDelta = 0;

  const appendOpeningDelta = (target, inflow = 0, outflow = 0) => {
    if (target === 'cash') cashOpeningDelta = round2(cashOpeningDelta + inflow - outflow);
    if (target === 'bank') bankOpeningDelta = round2(bankOpeningDelta + inflow - outflow);
  };

  sales.forEach((sale) => {
    if (isCashMode(sale.payment_type)) {
      appendAccountEntry(cashEntries, {
        date: sale.createdAt,
        transaction_type: 'sale',
        reference_id: sale.invoice_number,
        inflow: sale.total_amount,
        note: sale.buyer_name || sale.product_name || 'Sale receipt',
      });
    } else if (isBankMode(sale.payment_type)) {
      appendAccountEntry(bankAccountEntries, {
        date: sale.createdAt,
        transaction_type: 'sale',
        reference_id: sale.invoice_number,
        inflow: sale.total_amount,
        note: sale.buyer_name || sale.product_name || 'Sale receipt',
      });
    }
  });
  salesBefore.forEach((sale) => {
    if (isCashMode(sale.payment_type)) appendOpeningDelta('cash', sale.total_amount, 0);
    if (isBankMode(sale.payment_type)) appendOpeningDelta('bank', sale.total_amount, 0);
  });

  purchases.forEach((purchase) => {
    if (isCashMode(purchase.payment_type)) {
      appendAccountEntry(cashEntries, {
        date: purchase.createdAt,
        transaction_type: 'purchase',
        reference_id: purchase.invoice_number,
        outflow: purchase.total_amount,
        note: purchase.supplier_name || purchase.product_name || 'Purchase payment',
      });
    } else if (isBankMode(purchase.payment_type)) {
      appendAccountEntry(bankAccountEntries, {
        date: purchase.createdAt,
        transaction_type: 'purchase',
        reference_id: purchase.invoice_number,
        outflow: purchase.total_amount,
        note: purchase.supplier_name || purchase.product_name || 'Purchase payment',
      });
    }
  });
  purchasesBefore.forEach((purchase) => {
    if (isCashMode(purchase.payment_type)) appendOpeningDelta('cash', 0, purchase.total_amount);
    if (isBankMode(purchase.payment_type)) appendOpeningDelta('bank', 0, purchase.total_amount);
  });

  [...customerLedgerEntries, ...supplierLedgerEntries].forEach((entry) => {
    if (!entry.payment_mode && entry.type === 'credit' && entry.reference_type === 'manual') {
      pushValidationError(errors, 'MISSING_PAYMENT_MODE', 'Manual settlement is missing payment mode', entry.reference_id || String(entry._id));
      return;
    }
    const target = isBankMode(entry.payment_mode) ? bankAccountEntries : isCashMode(entry.payment_mode) ? cashEntries : null;
    if (!target) return;
    const isCustomerReceipt = Boolean(entry.customer) && entry.type === 'credit';
    appendAccountEntry(target, {
      date: entry.date || entry.createdAt,
      transaction_type: isCustomerReceipt ? 'receipt' : 'payment',
      reference_id: entry.reference_id,
      inflow: isCustomerReceipt ? entry.amount : 0,
      outflow: isCustomerReceipt ? 0 : entry.amount,
      note: entry.note || '',
    });
  });
  [...customerLedgerEntriesBefore, ...supplierLedgerEntriesBefore].forEach((entry) => {
    if (!entry.payment_mode) return;
    const target = isBankMode(entry.payment_mode) ? 'bank' : isCashMode(entry.payment_mode) ? 'cash' : null;
    if (!target) return;
    const isCustomerReceipt = Boolean(entry.customer) && entry.type === 'credit';
    appendOpeningDelta(target, isCustomerReceipt ? entry.amount : 0, isCustomerReceipt ? 0 : entry.amount);
  });

  expenses.forEach((expense) => {
    if (!expense.payment_mode) {
      pushValidationError(errors, 'MISSING_PAYMENT_MODE', 'Expense is missing payment mode', String(expense._id));
      return;
    }
    const target = isBankMode(expense.payment_mode) ? bankAccountEntries : isCashMode(expense.payment_mode) ? cashEntries : null;
    if (!target) return;
    appendAccountEntry(target, {
      date: expense.date,
      transaction_type: 'expense',
      reference_id: expense.reference_id || '',
      outflow: expense.amount,
      note: expense.category || expense.note || 'Expense',
    });
  });
  expensesBefore.forEach((expense) => {
    if (isBankMode(expense.payment_mode)) appendOpeningDelta('bank', 0, expense.amount);
    if (isCashMode(expense.payment_mode)) appendOpeningDelta('cash', 0, expense.amount);
  });

  income.forEach((entry) => {
    const target = isBankMode(entry.payment_mode) ? bankAccountEntries : isCashMode(entry.payment_mode) ? cashEntries : null;
    if (!target) {
      pushValidationError(errors, 'MISSING_PAYMENT_MODE', 'Income is missing payment mode', String(entry._id));
      return;
    }
    appendAccountEntry(target, {
      date: entry.date,
      transaction_type: 'income',
      reference_id: entry.reference_id || '',
      inflow: entry.amount,
      note: entry.source || entry.note || 'Other income',
    });
  });
  incomeBefore.forEach((entry) => {
    if (isBankMode(entry.payment_mode)) appendOpeningDelta('bank', entry.amount, 0);
    if (isCashMode(entry.payment_mode)) appendOpeningDelta('cash', entry.amount, 0);
  });

  bankEntries.forEach((entry) => {
    appendAccountEntry(bankAccountEntries, {
      date: entry.date,
      transaction_type: entry.entry_type,
      reference_id: entry.reference_id || '',
      inflow: ['deposit', 'interest', 'transfer_in'].includes(entry.entry_type) ? entry.amount : 0,
      outflow: ['withdrawal', 'charge', 'transfer_out'].includes(entry.entry_type) ? entry.amount : 0,
      note: entry.note || '',
    });
  });
  bankEntriesBefore.forEach((entry) => {
    appendOpeningDelta(
      'bank',
      ['deposit', 'interest', 'transfer_in'].includes(entry.entry_type) ? entry.amount : 0,
      ['withdrawal', 'charge', 'transfer_out'].includes(entry.entry_type) ? entry.amount : 0
    );
  });

  const expensesList = expenses.map((expense) => ({
    id: String(expense._id),
    date: getIsoDate(expense.date),
    category: expense.category,
    amount: round2(expense.amount),
    payment_mode: expense.payment_mode || '',
    note: expense.note || '',
    reference_id: expense.reference_id || '',
  }));

  const incomeList = income.map((entry) => ({
    id: String(entry._id),
    date: getIsoDate(entry.date),
    source: entry.source,
    category: entry.category,
    amount: round2(entry.amount),
    payment_mode: entry.payment_mode,
    note: entry.note || '',
    reference_id: entry.reference_id || '',
  }));

  const auditList = auditTrail.map((entry) => ({
    action_type: entry.action_type,
    entity: entry.entity,
    entity_id: entry.entity_id,
    timestamp: getIsoDate(entry.timestamp || entry.createdAt),
    user_id: String(entry.user_id),
    before_value: entry.before_value,
    after_value: entry.after_value,
    reference_id: entry.reference_id || '',
  }));

  const cashAccount = finalizeAccountLedger(cashOpeningDelta, cashEntries);
  const bankAccount = finalizeAccountLedger(bankOpeningDelta, bankAccountEntries);
  if (cashAccount.closing_balance < 0) {
    pushValidationError(errors, 'NEGATIVE_CASH_BALANCE', 'Cash account closing balance is negative', 'cash_account');
  }
  if (bankAccount.closing_balance < 0) {
    pushValidationError(errors, 'NEGATIVE_BANK_BALANCE', 'Bank account closing balance is negative', 'bank_account');
  }

  return {
    party_ledgers: partyLedgers,
    cash_account: cashAccount,
    bank_account: bankAccount,
    expenses: expensesList,
    income: incomeList,
    audit_trail: auditList,
    errors,
  };
};

module.exports = {
  generateAccountingSummary,
};
