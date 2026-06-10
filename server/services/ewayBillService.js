/**
 * E-Way Bill service — NIC GST EWB API (sandbox + production)
 *
 * NIC API docs: https://ewaybillgst.gov.in/apidocs/
 * Auth: GSTIN-based OAuth2, token expires every 6 hours.
 *
 * ENV vars required:
 *   EWB_BASE_URL     = https://sandboxeinvoice.nic.in/eivital/v1   (sandbox)
 *                    = https://einvoice1-prod.nic.in/eivital/v1    (prod)
 *   EWB_CLIENT_ID    = NIC issued client_id
 *   EWB_CLIENT_SECRET= NIC issued client_secret
 *   EWB_GSTIN        = Shop's GSTIN (registered with NIC)
 *   EWB_USERNAME     = NIC portal login username
 *   EWB_PASSWORD     = NIC portal login password (encrypted via NIC public key)
 */

const https = require('https');
const logger = require('../utils/logger');

const BASE_URL    = process.env.EWB_BASE_URL     || 'https://sandboxeinvoice.nic.in/eivital/v1';
const CLIENT_ID   = process.env.EWB_CLIENT_ID    || '';
const CLIENT_SECRET = process.env.EWB_CLIENT_SECRET || '';
const GSTIN       = process.env.EWB_GSTIN         || '';
const EWB_USER    = process.env.EWB_USERNAME      || '';
const EWB_PASS    = process.env.EWB_PASSWORD      || '';

let _token = null;
let _tokenExpiry = 0;

// ── Token management ──────────────────────────────────────────────────────────

async function fetchToken() {
  const payload = JSON.stringify({
    action: 'ACCESSTOKEN',
    clientid: CLIENT_ID,
    clientsecret: CLIENT_SECRET,
    gstin: GSTIN,
    username: EWB_USER,
    password: EWB_PASS,
  });
  const res = await httpPost(`${BASE_URL}/auth`, payload);
  if (res.status !== '1') {
    throw new Error(`EWB auth failed: ${res.error || JSON.stringify(res)}`);
  }
  _token      = res.authToken;
  _tokenExpiry = Date.now() + 5.5 * 60 * 60 * 1000; // 5.5h — expires before 6h NIC limit
  return _token;
}

async function getToken() {
  if (!_token || Date.now() > _tokenExpiry) {
    await fetchToken();
  }
  return _token;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpPost(url, body, authToken) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(authToken ? { 'authtoken': authToken } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Invalid JSON from EWB API: ${raw.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Build EWB payload from Sale document ─────────────────────────────────────

function buildEwbPayload(sale, shop) {
  const items = (sale.items || []).map((item, idx) => ({
    itemNo:         idx + 1,
    productName:    item.product_name || '',
    productDesc:    item.product_name || '',
    hsnCode:        item.hsn_code || '0',
    quantity:       item.quantity,
    qtyUnit:        (item.unit_of_measurement || 'NOS').toUpperCase(),
    cgstRate:       item.cgst_rate  || 0,
    sgstRate:       item.sgst_rate  || 0,
    igstRate:       item.igst_rate  || 0,
    cessRate:       0,
    taxableAmount:  item.taxable_amount || 0,
    cgstAmount:     item.cgst_amount  || 0,
    sgstAmount:     item.sgst_amount  || 0,
    igstAmount:     item.igst_amount  || 0,
    cessAmount:     0,
  }));

  return {
    supplyType:    sale.supply_type === 'inter_state' ? 'O' : 'I',  // O=outward, I=inward — always O for sales
    subSupplyType: '1',  // 1=Supply
    docType:       'INV',
    docNo:         sale.invoice_number,
    docDate:       new Date(sale.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/'), // DD/MM/YYYY
    fromGstin:     shop.gstin || GSTIN,
    fromTrdName:   shop.name  || '',
    fromAddr1:     shop.address || '',
    fromAddr2:     '',
    fromPlace:     shop.city  || '',
    fromPincode:   shop.pincode || 100001,
    fromStateCode: shop.state_code || '07',
    toGstin:       sale.buyer_gstin || 'URP',  // URP = unregistered person
    toTrdName:     sale.buyer_name  || '',
    toAddr1:       sale.buyer_address || sale.deliver_to || '',
    toAddr2:       '',
    toPlace:       '',
    toPincode:     100001,
    toStateCode:   sale.buyer_state_code || sale.place_of_supply || '07',
    totalValue:    sale.total_amount,
    cgstValue:     sale.cgst_amount  || 0,
    sgstValue:     sale.sgst_amount  || 0,
    igstValue:     sale.igst_amount  || 0,
    cessValue:     0,
    transporterGSTIN: '',
    transporterName:  sale.transport_name   || '',
    transDocNo:       sale.lr_number        || '',
    transMode:        '1',  // 1=Road, 2=Rail, 3=Air, 4=Ship
    transDistance:    '0',
    vehicleNo:        (sale.vehicle_number || '').replace(/\s/g, ''),
    vehicleType:      'R', // R=Regular
    itemList: items,
  };
}

// ── Generate EWB ──────────────────────────────────────────────────────────────

async function generateEWB(sale, shop) {
  if (!CLIENT_ID || !GSTIN) {
    throw new Error('EWB API credentials not configured. Set EWB_CLIENT_ID, EWB_GSTIN in environment.');
  }

  const token   = await getToken();
  const payload = buildEwbPayload(sale, shop);
  const body    = JSON.stringify({ action: 'GENEWAYBILL', ...payload });

  logger.info(`[ewayBillService] generating EWB for invoice ${sale.invoice_number}`);
  const res = await httpPost(`${BASE_URL}/ewayapi`, body, token);

  if (res.status !== '1') {
    throw new Error(res.error || `EWB generation failed: ${JSON.stringify(res)}`);
  }

  const ewbNo      = res.ewbNo || res.EWBNo;
  const validUntil = res.validUpto ? new Date(res.validUpto) : new Date(Date.now() + 24 * 60 * 60 * 1000);

  return { ewb_number: String(ewbNo), ewb_valid_until: validUntil };
}

// ── Cancel EWB ────────────────────────────────────────────────────────────────

async function cancelEWB(ewbNumber, reason = 'Others', remarks = '') {
  if (!CLIENT_ID || !GSTIN) {
    throw new Error('EWB API credentials not configured.');
  }
  const token = await getToken();
  const body  = JSON.stringify({
    action:  'CANEWB',
    ewbNo:   ewbNumber,
    cancelRsnCode: reasonCode(reason),
    cancelRmrk: remarks || reason,
  });

  const res = await httpPost(`${BASE_URL}/ewayapi`, body, token);
  if (res.status !== '1') {
    throw new Error(res.error || `EWB cancellation failed: ${JSON.stringify(res)}`);
  }
  return { cancelled: true, ewbNo: ewbNumber };
}

// ── Get EWB Status ────────────────────────────────────────────────────────────

async function getEWBStatus(ewbNumber) {
  if (!CLIENT_ID || !GSTIN) {
    throw new Error('EWB API credentials not configured.');
  }
  const token = await getToken();
  const body  = JSON.stringify({ action: 'GETEWBSTATUS', ewbNo: ewbNumber });
  const res   = await httpPost(`${BASE_URL}/ewayapi`, body, token);
  if (res.status !== '1') {
    throw new Error(res.error || `EWB status check failed: ${JSON.stringify(res)}`);
  }
  return res;
}

function reasonCode(reason) {
  const map = { 'Duplicate': 1, 'Order Cancelled': 2, 'Data Entry Mistake': 3, 'Others': 4 };
  return map[reason] || 4;
}

module.exports = { generateEWB, cancelEWB, getEWBStatus };
