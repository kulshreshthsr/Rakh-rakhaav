const Sale     = require('../models/salesModel');
const Product  = require('../models/productModel');
const Shop     = require('../models/shopModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Udhaar   = require('../models/udhaarModel');
const DocumentSequence = require('../models/documentSequenceModel');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getOrCreateShop = async (userId) => {
  let shop = await Shop.findOne({ owner: userId });
  if (!shop) shop = await Shop.create({ name: 'My Shop', owner: userId });
  return shop;
};

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

const generateInvoiceNumber = async (shopId) => {
  const financialYear = getFinancialYear();
  const sequence = await DocumentSequence.findOneAndUpdate(
    { shop: shopId, doc_type: 'sale', financial_year: financialYear },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `INV/${financialYear}/${String(sequence.last_number).padStart(4, '0')}`;
};

const normalizeState = (value = '') => value.trim().toLowerCase();
const round2 = (value) => parseFloat(Number(value || 0).toFixed(2));

const sumTaxHeads = (records = []) => ({
  cgst: round2(records.reduce((sum, record) => sum + (record.cgst_amount || 0), 0)),
  sgst: round2(records.reduce((sum, record) => sum + (record.sgst_amount || 0), 0)),
  igst: round2(records.reduce((sum, record) => sum + (record.igst_amount || 0), 0)),
});

const applyCredit = (availableCredit, liabilities, fromHead, targets, utilization) => {
  let remainingCredit = availableCredit[fromHead] || 0;

  for (const target of targets) {
    if (remainingCredit <= 0) break;
    const usable = Math.min(remainingCredit, liabilities[target] || 0);
    if (usable <= 0) continue;

    liabilities[target] = round2(liabilities[target] - usable);
    remainingCredit = round2(remainingCredit - usable);
    utilization[fromHead][target] = round2((utilization[fromHead][target] || 0) + usable);
  }

  availableCredit[fromHead] = remainingCredit;
};

const calculateGSTR3BSummary = (sales = [], purchases = []) => {
  const outputTax = sumTaxHeads(sales);
  const inputCredit = sumTaxHeads(purchases);
  const liabilities = { ...outputTax };
  const remainingCredit = { ...inputCredit };
  const utilization = {
    igst: { igst: 0, cgst: 0, sgst: 0 },
    cgst: { igst: 0, cgst: 0, sgst: 0 },
    sgst: { igst: 0, cgst: 0, sgst: 0 },
  };

  // As per GST utilization order: IGST credit first, then CGST/SGST.
  applyCredit(remainingCredit, liabilities, 'igst', ['igst', 'cgst', 'sgst'], utilization);
  applyCredit(remainingCredit, liabilities, 'cgst', ['cgst', 'igst'], utilization);
  applyCredit(remainingCredit, liabilities, 'sgst', ['sgst', 'igst'], utilization);

  const outputTotal = round2(outputTax.cgst + outputTax.sgst + outputTax.igst);
  const inputTotal = round2(inputCredit.cgst + inputCredit.sgst + inputCredit.igst);
  const payable = {
    cgst: round2(liabilities.cgst),
    sgst: round2(liabilities.sgst),
    igst: round2(liabilities.igst),
  };
  const payableTotal = round2(payable.cgst + payable.sgst + payable.igst);
  const excessCredit = {
    cgst: round2(remainingCredit.cgst),
    sgst: round2(remainingCredit.sgst),
    igst: round2(remainingCredit.igst),
  };

  return {
    outward_taxable: round2(sales.reduce((sum, record) => sum + (record.taxable_amount || 0), 0)),
    output_gst: outputTotal,
    input_gst: inputTotal,
    output_tax: outputTax,
    input_tax_credit: inputCredit,
    credit_utilized: utilization,
    payable_by_head: payable,
    payable_total: payableTotal,
    excess_credit: excessCredit,
    net_payable: payableTotal,
  };
};

const calculateGST = (taxable_amount, gst_rate, shopState, buyerState) => {
  const gst    = (taxable_amount * gst_rate) / 100;
  const normalizedShopState = normalizeState(shopState);
  const normalizedBuyerState = normalizeState(buyerState);
  const isIGST = normalizedBuyerState && normalizedShopState && normalizedShopState !== normalizedBuyerState;
  if (isIGST) {
    return {
      cgst_amount: 0, sgst_amount: 0,
      igst_amount: parseFloat(gst.toFixed(2)),
      total_gst:   parseFloat(gst.toFixed(2)),
      gst_type:    'IGST',
    };
  } else {
    const half = parseFloat((gst / 2).toFixed(2));
    return {
      cgst_amount: half, sgst_amount: half, igst_amount: 0,
      total_gst:   parseFloat(gst.toFixed(2)),
      gst_type:    'CGST_SGST',
    };
  }
};

const getExistingItemQuantities = (record) => {
  const quantityMap = new Map();
  const sourceItems = record?.items?.length
    ? record.items
    : (record?.product ? [{ product: record.product, quantity: record.quantity }] : []);

  for (const item of sourceItems) {
    const productId = String(item.product);
    quantityMap.set(productId, (quantityMap.get(productId) || 0) + Number(item.quantity || 0));
  }

  return quantityMap;
};

const syncSaleStock = async (previousSale, nextItems) => {
  const previousMap = getExistingItemQuantities(previousSale);
  const nextMap = new Map();

  for (const item of nextItems) {
    const productId = String(item.product);
    nextMap.set(productId, (nextMap.get(productId) || 0) + Number(item.quantity || 0));
  }

  const productIds = [...new Set([...previousMap.keys(), ...nextMap.keys()])];

  for (const productId of productIds) {
    const previousQty = previousMap.get(productId) || 0;
    const nextQty = nextMap.get(productId) || 0;
    const delta = nextQty - previousQty;
    if (!delta) continue;

    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found while updating sale');
    if (delta > 0 && product.quantity < delta) {
      throw new Error(`${product.name}: sirf ${product.quantity} stock available hai`);
    }

    await Product.findByIdAndUpdate(productId, { $inc: { quantity: -delta } });
  }
};

const syncCustomerLedgerForSale = async (shopId, saleDoc, itemNames = []) => {
  if (saleDoc.payment_type !== 'credit' || !saleDoc.buyer_name) {
    saleDoc.customer = null;
    return;
  }

  let customer = saleDoc.customer
    ? await Customer.findById(saleDoc.customer)
    : null;

  if (!customer) {
    customer = await Customer.findOne({
      shop: shopId,
      $or: [
        { name: { $regex: new RegExp(`^${saleDoc.buyer_name}$`, 'i') } },
        ...(saleDoc.buyer_phone ? [{ phone: saleDoc.buyer_phone }] : []),
      ],
    });
  }

  if (!customer) {
    customer = await Customer.create({
      shop: shopId,
      name: saleDoc.buyer_name,
      phone: saleDoc.buyer_phone || '',
      gstin: saleDoc.buyer_gstin || '',
      address: saleDoc.buyer_address || '',
      totalSales: 0,
      totalPaid: 0,
      totalUdhaar: 0,
    });
  }

  customer.name = saleDoc.buyer_name;
  customer.phone = saleDoc.buyer_phone || '';
  customer.gstin = saleDoc.buyer_gstin || '';
  customer.address = saleDoc.buyer_address || '';
  customer.totalSales = round2((customer.totalSales || 0) + saleDoc.total_amount);
  customer.totalPaid = round2((customer.totalPaid || 0) + (saleDoc.amount_paid || 0));
  customer.totalUdhaar = round2(customer.totalSales - customer.totalPaid);
  await customer.save();

  saleDoc.customer = customer._id;
  await Udhaar.deleteMany({ reference_id: saleDoc.invoice_number, reference_type: 'sale' });

  await Udhaar.create({
    shop: shopId,
    customer: customer._id,
    type: 'debit',
    amount: saleDoc.total_amount,
    running_balance: customer.totalUdhaar,
    note: `Credit Sale â€” ${itemNames.join(', ')} (${saleDoc.invoice_number})`,
    date: new Date(),
    reference_id: saleDoc.invoice_number,
    reference_type: 'sale',
  });

  if (saleDoc.amount_paid > 0) {
    await Udhaar.create({
      shop: shopId,
      customer: customer._id,
      type: 'credit',
      amount: saleDoc.amount_paid,
      running_balance: customer.totalUdhaar,
      note: `Advance payment at time of sale (${saleDoc.invoice_number})`,
      date: new Date(),
      reference_id: saleDoc.invoice_number,
      reference_type: 'sale',
    });
  }
};

const reverseCustomerLedgerForSale = async (saleDoc) => {
  if (saleDoc.payment_type !== 'credit') return;

  const customer = saleDoc.customer
    ? await Customer.findById(saleDoc.customer)
    : await Customer.findOne({
        shop: saleDoc.shop,
        name: { $regex: new RegExp(`^${saleDoc.buyer_name}$`, 'i') },
      });

  if (!customer) return;

  customer.totalSales = Math.max(0, round2((customer.totalSales || 0) - (saleDoc.total_amount || 0)));
  customer.totalPaid = Math.max(0, round2((customer.totalPaid || 0) - (saleDoc.amount_paid || 0)));
  customer.totalUdhaar = round2(customer.totalSales - customer.totalPaid);
  await customer.save();
  await Udhaar.deleteMany({ reference_id: saleDoc.invoice_number, reference_type: 'sale' });
};

const buildSaleRecordData = async ({
  shop,
  payload,
  existingSale = null,
  invoiceNumber = null,
}) => {
  const {
    items,
    product_id, quantity, price_per_unit,
    buyer_name, buyer_phone, buyer_gstin,
    buyer_address, buyer_state,
    payment_type = 'cash',
    amount_paid = 0,
    notes,
  } = payload;

  if (payment_type === 'credit' && !buyer_name) {
    throw new Error('Udhaar sale ke liye buyer ka naam zaroori hai!');
  }

  const rawItems = items && items.length > 0
    ? items
    : [{ product_id, quantity, price_per_unit }];

  if (!rawItems?.length) {
    throw new Error('Kam se kam ek item zaroori hai');
  }

  let totalTaxable = 0, totalCGST = 0, totalSGST = 0;
  let totalIGST = 0, totalGST = 0, grandTotal = 0;
  let totalCost = 0;
  const invoice_type = (buyer_gstin && buyer_gstin.trim() !== '') ? 'B2B' : 'B2C';
  const resolvedItems = [];
  const previousQuantities = getExistingItemQuantities(existingSale);

  for (const item of rawItems) {
    const product = await Product.findById(item.product_id);
    if (!product) throw new Error(`Product not found: ${item.product_id}`);

    const qty = Number(item.quantity);
    const ppu = Number(item.price_per_unit);
    if (qty <= 0 || ppu < 0) throw new Error(`Invalid quantity or price for ${product.name}`);

    const previousQty = previousQuantities.get(String(product._id)) || 0;
    const extraNeeded = Math.max(0, qty - previousQty);
    if (product.quantity < extraNeeded) {
      throw new Error(`${product.name}: sirf ${product.quantity} stock available hai`);
    }

    const cost = product.cost_price || 0;
    const gst_rate = product.gst_rate || 0;
    const taxable = parseFloat((qty * ppu).toFixed(2));
    const gstCalc = calculateGST(taxable, gst_rate, shop.state, buyer_state);
    const lineTotal = parseFloat((taxable + gstCalc.total_gst).toFixed(2));
    const lineCost = parseFloat((cost * qty).toFixed(2));

    totalTaxable += taxable;
    totalCGST += gstCalc.cgst_amount;
    totalSGST += gstCalc.sgst_amount;
    totalIGST += gstCalc.igst_amount;
    totalGST += gstCalc.total_gst;
    grandTotal += lineTotal;
    totalCost += lineCost;

    resolvedItems.push({
      product: product._id,
      product_name: product.name,
      hsn_code: product.hsn_code,
      quantity: qty,
      price_per_unit: ppu,
      cost_price: cost,
      gst_rate,
      taxable_amount: taxable,
      ...gstCalc,
      total_amount: lineTotal,
    });
  }

  totalTaxable = round2(totalTaxable);
  totalGST = round2(totalGST);
  grandTotal = round2(grandTotal);
  totalCost = round2(totalCost);
  const paid = round2(payment_type === 'credit' ? Number(amount_paid) : grandTotal);
  const grossProfit = round2(totalTaxable - totalCost);
  const firstItem = resolvedItems[0];
  const uniqueRates = [...new Set(resolvedItems.map((item) => Number(item.gst_rate || 0)))];

  return {
    itemNames: resolvedItems.map((item) => item.product_name),
    resolvedItems,
    data: {
      shop: shop._id,
      items: resolvedItems,
      product: firstItem.product,
      product_name: firstItem.product_name,
      hsn_code: firstItem.hsn_code,
      quantity: firstItem.quantity,
      price_per_unit: firstItem.price_per_unit,
      cost_price: firstItem.cost_price,
      gst_rate: uniqueRates.length === 1 ? firstItem.gst_rate : 0,
      gst_type: firstItem.gst_type,
      invoice_type,
      invoice_number: invoiceNumber || await generateInvoiceNumber(shop._id),
      taxable_amount: totalTaxable,
      cgst_amount: round2(totalCGST),
      sgst_amount: round2(totalSGST),
      igst_amount: round2(totalIGST),
      total_gst: totalGST,
      total_amount: grandTotal,
      total_cost: totalCost,
      gross_profit: grossProfit,
      payment_type,
      amount_paid: paid,
      buyer_name: buyer_name || (invoice_type === 'B2C' ? 'Walk-in Customer' : ''),
      buyer_phone,
      buyer_gstin,
      buyer_address,
      buyer_state: buyer_state || '',
      notes,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL SALES
// ─────────────────────────────────────────────────────────────────────────────

const getSales = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const { payment_type, from, to } = req.query;

    const filter = { shop: shop._id };
    if (payment_type) filter.payment_type = payment_type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const sales = await Sale.find(filter)
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });

    const summary = sales.reduce((acc, s) => {
      acc.totalRevenue += s.total_amount  || 0;
      acc.totalGST     += s.total_gst     || 0;
      acc.totalCOGS    += s.total_cost    || 0;
      acc.totalProfit  += s.gross_profit  || 0;
      return acc;
    }, { totalRevenue: 0, totalGST: 0, totalCOGS: 0, totalProfit: 0 });

    res.json({ sales, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SALE
// ─────────────────────────────────────────────────────────────────────────────

const createSale = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const invoiceNumber = await generateInvoiceNumber(shop._id);
    const { data, itemNames } = await buildSaleRecordData({
      shop,
      payload: req.body,
      invoiceNumber,
    });

    await syncSaleStock(null, data.items);

    const createdSale = await Sale.create({
      ...data,
      shop: shop._id,
    });

    await syncCustomerLedgerForSale(shop._id, createdSale, itemNames);
    const hydratedSale = await Sale.findById(createdSale._id).populate('customer', 'name phone gstin');
    return res.status(201).json(hydratedSale);

    const {
      items,
      product_id, quantity, price_per_unit,
      buyer_name, buyer_phone, buyer_gstin,
      buyer_address, buyer_state,
      payment_type = 'cash',
      amount_paid = 0,
      notes,
    } = req.body;

    if (payment_type === 'credit' && !buyer_name) {
      return res.status(400).json({ message: 'Credit sale ke liye customer ka naam zaroori hai!' });
    }

    const rawItems = items && items.length > 0
      ? items
      : [{ product_id, quantity, price_per_unit }];

    let totalTaxable = 0, totalCGST = 0, totalSGST = 0;
    let totalIGST = 0, totalGST = 0, grandTotal = 0;
    let totalCost = 0;

    const invoice_type   = (buyer_gstin && buyer_gstin.trim() !== '') ? 'B2B' : 'B2C';
    const invoice_number = await generateInvoiceNumber(shop._id);
    const resolvedItems  = [];

    for (const item of rawItems) {
      const product = await Product.findById(item.product_id);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.product_id}` });
      }

      const qty      = Number(item.quantity);
      const ppu      = Number(item.price_per_unit);
      const cost     = product.cost_price || 0;
      const gst_rate = product.gst_rate   || 0;

      const taxable   = parseFloat((qty * ppu).toFixed(2));
      const gstCalc   = calculateGST(taxable, gst_rate, shop.state, buyer_state);
      const lineTotal = parseFloat((taxable + gstCalc.total_gst).toFixed(2));
      const lineCost  = parseFloat((cost * qty).toFixed(2));

      totalTaxable += taxable;
      totalCGST    += gstCalc.cgst_amount;
      totalSGST    += gstCalc.sgst_amount;
      totalIGST    += gstCalc.igst_amount;
      totalGST     += gstCalc.total_gst;
      grandTotal   += lineTotal;
      totalCost    += lineCost;

      resolvedItems.push({
        product:        product._id,
        product_name:   product.name,
        hsn_code:       product.hsn_code,
        quantity:       qty,
        price_per_unit: ppu,
        cost_price:     cost,
        gst_rate,
        taxable_amount: taxable,
        ...gstCalc,
        total_amount:   lineTotal,
      });

      await Product.findByIdAndUpdate(product._id, { $inc: { quantity: -qty } });
    }

    totalTaxable = parseFloat(totalTaxable.toFixed(2));
    totalGST     = parseFloat(totalGST.toFixed(2));
    grandTotal   = parseFloat(grandTotal.toFixed(2));
    totalCost    = parseFloat(totalCost.toFixed(2));
    const paid = parseFloat(Number(amount_paid).toFixed(2));

    const grossProfit = parseFloat((totalTaxable - totalCost).toFixed(2));
    const firstItem   = resolvedItems[0];
    const uniqueRates = [...new Set(resolvedItems.map((item) => Number(item.gst_rate || 0)))];

    const sale = await Sale.create({
      shop:     shop._id,
      items:    resolvedItems,

      product:        firstItem.product,
      product_name:   firstItem.product_name,
      hsn_code:       firstItem.hsn_code,
      quantity:       firstItem.quantity,
      price_per_unit: firstItem.price_per_unit,
      cost_price:     firstItem.cost_price,
      gst_rate:       uniqueRates.length === 1 ? firstItem.gst_rate : 0,
      gst_type:       firstItem.gst_type,

      invoice_type,
      invoice_number,

      taxable_amount: totalTaxable,
      cgst_amount:    parseFloat(totalCGST.toFixed(2)),
      sgst_amount:    parseFloat(totalSGST.toFixed(2)),
      igst_amount:    parseFloat(totalIGST.toFixed(2)),
      total_gst:      totalGST,
      total_amount:   grandTotal,
      total_cost:     totalCost,
      gross_profit:   grossProfit,

      payment_type,
      amount_paid: payment_type === 'credit' ? paid : grandTotal,
      buyer_name:    buyer_name || (invoice_type === 'B2C' ? 'Walk-in Customer' : ''),
      buyer_phone,
      buyer_gstin,
      buyer_address,
      buyer_state: buyer_state || '',
      notes,
    });

    if (payment_type === 'credit' && buyer_name) {
      let customer = await Customer.findOne({
        shop: shop._id,
        $or: [
          { name:  { $regex: new RegExp(`^${buyer_name}$`, 'i') } },
          ...(buyer_phone ? [{ phone: buyer_phone }] : []),
        ],
      });

      if (!customer) {
        customer = await Customer.create({
          shop: shop._id,
          name: buyer_name, phone: buyer_phone || '',
          gstin: buyer_gstin || '', address: buyer_address || '',
          totalSales: 0, totalPaid: 0, totalUdhaar: 0,
        });
      }

      customer.totalSales  = parseFloat((customer.totalSales + grandTotal).toFixed(2));
      customer.totalPaid   = parseFloat((customer.totalPaid + paid).toFixed(2));
      customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
      await customer.save();
      await Sale.findByIdAndUpdate(sale._id, { customer: customer._id });

      await Udhaar.create({
        shop:            shop._id,
        customer:        customer._id,
        type:            'debit',
        amount:          grandTotal,
        running_balance: customer.totalUdhaar,
        note:            `Credit Sale — ${resolvedItems.map(i => i.product_name).join(', ')} (${invoice_number})`,
        date:            new Date(),
        reference_id:    invoice_number,
        reference_type:  'sale',
      });

      if (paid > 0) {
        await Udhaar.create({
          shop:            shop._id,
          customer:        customer._id,
          type:            'credit',
          amount:          paid,
          running_balance: customer.totalUdhaar,
          note:            `Advance payment at time of sale (${invoice_number})`,
          date:            new Date(),
          reference_id:    invoice_number,
          reference_type:  'sale',
        });
      }
    }

    res.status(201).json(sale);
  } catch (err) {
    console.error('createSale error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const updateSale = async (req, res) => {
  try {
    const shop = await getOrCreateShop(req.user.id);
    const sale = await Sale.findOne({ _id: req.params.id, shop: shop._id });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const { data, itemNames } = await buildSaleRecordData({
      shop,
      payload: req.body,
      existingSale: sale,
      invoiceNumber: sale.invoice_number,
    });

    await reverseCustomerLedgerForSale(sale);
    await syncSaleStock(sale, data.items);

    Object.assign(sale, data, { customer: null });
    await sale.save();
    await syncCustomerLedgerForSale(shop._id, sale, itemNames);

    const hydratedSale = await Sale.findById(sale._id).populate('customer', 'name phone gstin');
    res.json(hydratedSale);
  } catch (err) {
    console.error('updateSale error:', err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE SALE
// ─────────────────────────────────────────────────────────────────────────────

const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
      }
    } else if (sale.product) {
      await Product.findByIdAndUpdate(sale.product, { $inc: { quantity: sale.quantity } });
    }

    if (sale.payment_type === 'credit') {
      const customerId = sale.customer;
      const customer   = customerId
        ? await Customer.findById(customerId)
        : await Customer.findOne({
            shop: sale.shop,
            name: { $regex: new RegExp(`^${sale.buyer_name}$`, 'i') },
          });

      if (customer) {
        customer.totalSales  = Math.max(0, customer.totalSales - sale.total_amount);
        customer.totalPaid   = Math.max(0, customer.totalPaid - (sale.amount_paid || 0));
        customer.totalUdhaar = parseFloat((customer.totalSales - customer.totalPaid).toFixed(2));
        await customer.save();
        await Udhaar.deleteMany({ reference_id: sale.invoice_number, reference_type: 'sale' });
      }
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted and stock reversed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFIT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const getProfitSummary = async (req, res) => {
  try {
    const shop         = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;
    const filter       = { shop: shop._id };

    if (month && year) {
      filter.createdAt = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const [salesAgg] = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id:                null,
          totalRevenue:       { $sum: '$total_amount'  },
          totalTaxable:       { $sum: '$taxable_amount' },
          totalGSTCollected:  { $sum: '$total_gst'     },
          totalCOGS:          { $sum: '$total_cost'    },
          totalGrossProfit:   { $sum: '$gross_profit'  },
          salesCount:         { $sum: 1                },
        },
      },
    ]);

    const [purchasesAgg] = await Purchase.aggregate([
      { $match: { shop: shop._id, ...(filter.createdAt ? { createdAt: filter.createdAt } : {}) } },
      {
        $group: {
          _id:             null,
          totalSpent:      { $sum: '$total_amount' },
          totalITC:        { $sum: '$total_gst'    },
          purchasesCount:  { $sum: 1               },
        },
      },
    ]);

    const s = salesAgg    || { totalRevenue: 0, totalTaxable: 0, totalGSTCollected: 0, totalCOGS: 0, totalGrossProfit: 0, salesCount: 0 };
    const p = purchasesAgg || { totalSpent: 0, totalITC: 0, purchasesCount: 0 };

    const netGSTPayable = parseFloat((s.totalGSTCollected - p.totalITC).toFixed(2));

    res.json({
      totalRevenue:   parseFloat(s.totalRevenue.toFixed(2)),
      totalTaxable:   parseFloat(s.totalTaxable.toFixed(2)),
      salesCount:     s.salesCount,
      totalCOGS:      parseFloat(s.totalCOGS.toFixed(2)),
      grossProfit:    parseFloat(s.totalGrossProfit.toFixed(2)),
      netProfit:      parseFloat(s.totalGrossProfit.toFixed(2)),
      gstCollected:   parseFloat(s.totalGSTCollected.toFixed(2)),
      gstITC:         parseFloat(p.totalITC.toFixed(2)),
      netGSTPayable,
      totalSpent:     parseFloat(p.totalSpent.toFixed(2)),
      purchasesCount: p.purchasesCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GST SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const getGSTSummary = async (req, res) => {
  try {
    const shop           = await getOrCreateShop(req.user.id);
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);

    const sales     = await Sale.find({ shop: shop._id, createdAt: { $gte: startDate, $lte: endDate } });
    const purchases = await Purchase.find({ shop: shop._id, createdAt: { $gte: startDate, $lte: endDate } });

    const b2b = sales.filter(s => s.invoice_type === 'B2B');
    const b2c = sales.filter(s => s.invoice_type === 'B2C');

    const salesTaxHeads = sumTaxHeads(sales);
    const purchaseTaxHeads = sumTaxHeads(purchases);
    const gstr3b = calculateGSTR3BSummary(sales, purchases);

    const summary = {
      month:     parseInt(month),
      year:      parseInt(year),
      sales: {
        total:          sales.length,
        taxable_amount: parseFloat(sales.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        total_gst:      parseFloat(sales.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
        cgst:           salesTaxHeads.cgst,
        sgst:           salesTaxHeads.sgst,
        igst:           salesTaxHeads.igst,
        total_amount:   parseFloat(sales.reduce((s, x) => s + (x.total_amount   || 0), 0).toFixed(2)),
        b2b_count:      b2b.length,
        b2c_count:      b2c.length,
        b2b_taxable:    parseFloat(b2b.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        b2c_taxable:    parseFloat(b2c.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
      },
      purchases: {
        total:          purchases.length,
        taxable_amount: parseFloat(purchases.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
        total_gst:      parseFloat(purchases.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
        cgst:           purchaseTaxHeads.cgst,
        sgst:           purchaseTaxHeads.sgst,
        igst:           purchaseTaxHeads.igst,
      },
      gstr1: {
        b2b_invoices: b2b.map(s => ({
          invoice_number: s.invoice_number,
          date:           s.createdAt,
          buyer_name:     s.buyer_name,
          buyer_gstin:    s.buyer_gstin,
          taxable_amount: s.taxable_amount,
          gst_rate:       s.items?.length
            ? [...new Set(s.items.map((item) => item.gst_rate))].join('/')
            : s.gst_rate,
          cgst:           s.cgst_amount,
          sgst:           s.sgst_amount,
          igst:           s.igst_amount,
          total:          s.total_amount,
          gst_type:       s.gst_type,
        })),
        b2c_summary: {
          count:          b2c.length,
          taxable_amount: parseFloat(b2c.reduce((s, x) => s + (x.taxable_amount || 0), 0).toFixed(2)),
          total_gst:      parseFloat(b2c.reduce((s, x) => s + (x.total_gst      || 0), 0).toFixed(2)),
          total_amount:   parseFloat(b2c.reduce((s, x) => s + (x.total_amount   || 0), 0).toFixed(2)),
        },
      },
      gstr3b,
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getSales,
  createSale,
  updateSale,
  deleteSale,
  getGSTSummary,
  getProfitSummary,
};
