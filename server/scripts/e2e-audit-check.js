require('dotenv').config();

const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/userModel');
const Shop = require('../models/shopModel');
const Product = require('../models/productModel');
const Sale = require('../models/salesModel');
const Purchase = require('../models/purchaseModel');
const Customer = require('../models/customerModel');
const Supplier = require('../models/supplierModel');
const Udhaar = require('../models/udhaarModel');
const SupplierUdhaar = require('../models/supplierUdhaarModel');
const DocumentSequence = require('../models/documentSequenceModel');

const SERVER_DIR = path.resolve(__dirname, '..');
const PORT = 5055;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RUN_ID = `audit-${Date.now()}`;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const request = async (method, pathname, token, body) => {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
};

const waitForHealth = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Server health check timed out');
};

const cleanup = async () => {
  const users = await User.find({ username: { $regex: `^${RUN_ID}` } }).select('_id').lean();
  const userIds = users.map((user) => user._id);
  const shops = await Shop.find({ owner: { $in: userIds } }).select('_id').lean();
  const shopIds = shops.map((shop) => shop._id);

  await Promise.all([
    Udhaar.deleteMany({ shop: { $in: shopIds } }),
    SupplierUdhaar.deleteMany({ shop: { $in: shopIds } }),
    Sale.deleteMany({ shop: { $in: shopIds } }),
    Purchase.deleteMany({ shop: { $in: shopIds } }),
    Product.deleteMany({ shop: { $in: shopIds } }),
    Customer.deleteMany({ shop: { $in: shopIds } }),
    Supplier.deleteMany({ shop: { $in: shopIds } }),
    DocumentSequence.deleteMany({ shop: { $in: shopIds } }),
    Shop.deleteMany({ _id: { $in: shopIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
};

const main = async () => {
  process.env.PORT = String(PORT);
  process.chdir(SERVER_DIR);
  require('../app');

  try {
    await waitForHealth();

    const registerA = await request('POST', '/api/auth/register', null, {
      name: 'Audit User A',
      username: `${RUN_ID}-a`,
      password: 'Pass@1234',
    });
    assert(registerA.response.status === 201, `register user A failed: ${JSON.stringify(registerA.data)}`);

    const registerB = await request('POST', '/api/auth/register', null, {
      name: 'Audit User B',
      username: `${RUN_ID}-b`,
      password: 'Pass@1234',
    });
    assert(registerB.response.status === 201, `register user B failed: ${JSON.stringify(registerB.data)}`);

    const tokenA = registerA.data.token;
    const tokenB = registerB.data.token;
    assert(tokenA && tokenB, 'tokens were not returned after registration');

    const shopUpdate = await request('PUT', '/api/auth/shop', tokenA, {
      name: 'Audit Shop',
      state: 'Delhi',
      gstin: '07ABCDE1234F1Z5',
      phone: '9999999999',
    });
    assert(shopUpdate.response.ok, `shop update failed: ${JSON.stringify(shopUpdate.data)}`);

    const productCreate = await request('POST', '/api/products', tokenA, {
      name: `Audit Product ${RUN_ID}`,
      price: 1000,
      cost_price: 400,
      quantity: 10,
      unit: 'pcs',
      hsn_code: '8471',
      gst_rate: 18,
      low_stock_threshold: 2,
    });
    assert(productCreate.response.status === 201, `product creation failed: ${JSON.stringify(productCreate.data)}`);
    const productId = productCreate.data._id;

    const saleCreate = await request('POST', '/api/sales', tokenA, {
      items: [{ product_id: productId, quantity: 2, price_per_unit: 1000 }],
      payment_type: 'credit',
      amount_paid: 500,
      buyer_name: `Audit Buyer ${RUN_ID}`,
      buyer_phone: '8888888888',
      buyer_gstin: '07AAACB2894G1ZP',
      buyer_address: 'Delhi',
      buyer_state: 'Delhi',
      notes: 'Audit sale',
    });
    assert(saleCreate.response.status === 201, `sale creation failed: ${JSON.stringify(saleCreate.data)}`);
    assert(/^INV\//.test(saleCreate.data.invoice_number), 'sale invoice number format is invalid');
    assert(Number(saleCreate.data.total_amount) === 2360, `unexpected sale total: ${saleCreate.data.total_amount}`);
    assert(Number(saleCreate.data.balance_due) === 1860, `unexpected sale balance due: ${saleCreate.data.balance_due}`);
    const saleId = saleCreate.data._id;
    const customerId = saleCreate.data.customer?._id;
    assert(customerId, 'credit sale customer link was not populated');

    const purchaseCreate = await request('POST', '/api/purchases', tokenA, {
      items: [{ product_id: productId, quantity: 3, price_per_unit: 500 }],
      payment_type: 'credit',
      amount_paid: 200,
      supplier_name: `Audit Supplier ${RUN_ID}`,
      supplier_phone: '7777777777',
      supplier_gstin: '27ABCDE1234F1Z5',
      supplier_address: 'Mumbai',
      supplier_state: 'Maharashtra',
      notes: 'Audit purchase',
    });
    assert(purchaseCreate.response.status === 201, `purchase creation failed: ${JSON.stringify(purchaseCreate.data)}`);
    assert(/^PUR\//.test(purchaseCreate.data.invoice_number), 'purchase invoice number format is invalid');
    assert(Number(purchaseCreate.data.total_amount) === 1770, `unexpected purchase total: ${purchaseCreate.data.total_amount}`);
    assert(Number(purchaseCreate.data.balance_due) === 1570, `unexpected purchase balance due: ${purchaseCreate.data.balance_due}`);
    const purchaseId = purchaseCreate.data._id;
    const supplierId = purchaseCreate.data.supplier?._id;
    assert(supplierId, 'credit purchase supplier link was not populated');

    const productsAfterFlows = await request('GET', '/api/products', tokenA);
    assert(productsAfterFlows.response.ok, 'product fetch failed after sale/purchase flow');
    const productAfterFlows = productsAfterFlows.data.find((product) => product._id === productId);
    assert(productAfterFlows, 'created product missing after flows');
    assert(Number(productAfterFlows.quantity) === 11, `unexpected stock quantity after sale/purchase: ${productAfterFlows.quantity}`);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const gstSummary = await request('GET', `/api/sales/gst-summary?month=${month}&year=${year}`, tokenA);
    assert(gstSummary.response.ok, `gst summary failed: ${JSON.stringify(gstSummary.data)}`);
    assert(Number(gstSummary.data.gstr3b.payable_total) === 90, `unexpected GST payable total: ${gstSummary.data.gstr3b.payable_total}`);

    const profitSummary = await request('GET', `/api/sales/profit-summary?from=${encodeURIComponent(monthStart)}&to=${encodeURIComponent(monthEnd)}`, tokenA);
    assert(profitSummary.response.ok, `profit summary failed: ${JSON.stringify(profitSummary.data)}`);
    assert(Number(profitSummary.data.netGSTPayable) === Number(gstSummary.data.gstr3b.payable_total), 'profit summary GST payable does not match GST summary');

    const customerLedger = await request('GET', `/api/customers/${customerId}/udhaar`, tokenA);
    assert(customerLedger.response.ok, `customer ledger fetch failed: ${JSON.stringify(customerLedger.data)}`);
    assert(customerLedger.data.entries.length === 2, `unexpected customer ledger entry count: ${customerLedger.data.entries.length}`);

    const settleCustomer = await request('POST', `/api/customers/${customerId}/settle`, tokenA, {
      amount: 300,
      note: 'Audit settlement',
    });
    assert(settleCustomer.response.ok, `customer settle failed: ${JSON.stringify(settleCustomer.data)}`);
    assert(Number(settleCustomer.data.balanceDue) === 1560, `unexpected customer balance after settlement: ${settleCustomer.data.balanceDue}`);

    const supplierLedger = await request('GET', `/api/suppliers/${supplierId}/udhaar`, tokenA);
    assert(supplierLedger.response.ok, `supplier ledger fetch failed: ${JSON.stringify(supplierLedger.data)}`);
    assert(supplierLedger.data.ledger.length === 2, `unexpected supplier ledger entry count: ${supplierLedger.data.ledger.length}`);

    const crossCustomerLedger = await request('GET', `/api/customers/${customerId}/udhaar`, tokenB);
    assert(crossCustomerLedger.response.status === 404, `cross-tenant customer ledger should fail, got ${crossCustomerLedger.response.status}`);

    const crossSupplierLedger = await request('GET', `/api/suppliers/${supplierId}/udhaar`, tokenB);
    assert(crossSupplierLedger.response.status === 404, `cross-tenant supplier ledger should fail, got ${crossSupplierLedger.response.status}`);

    const crossDeleteSale = await request('DELETE', `/api/sales/${saleId}`, tokenB);
    assert(crossDeleteSale.response.status === 404, `cross-tenant sale delete should fail, got ${crossDeleteSale.response.status}`);

    const crossDeletePurchase = await request('DELETE', `/api/purchases/${purchaseId}`, tokenB);
    assert(crossDeletePurchase.response.status === 404, `cross-tenant purchase delete should fail, got ${crossDeletePurchase.response.status}`);

    console.log(JSON.stringify({
      ok: true,
      runId: RUN_ID,
      saleInvoice: saleCreate.data.invoice_number,
      purchaseInvoice: purchaseCreate.data.invoice_number,
      gstPayable: gstSummary.data.gstr3b.payable_total,
      finalCustomerDue: settleCustomer.data.balanceDue,
      stockAfterFlows: productAfterFlows.quantity,
    }, null, 2));
  } finally {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    await cleanup();
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit();
});
