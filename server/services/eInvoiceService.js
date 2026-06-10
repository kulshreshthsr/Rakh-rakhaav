/**
 * E-Invoice (IRN) Service — NIC IRP API v1.1
 *
 * NIC sandbox : https://einvoice1-sandbox.nic.in
 * NIC prod    : https://einvoice1-prod.nic.in  (set via E_INVOICE_API_URL)
 *
 * ENV vars:
 *   E_INVOICE_API_URL  = base URL (default: NIC sandbox)
 *   E_INVOICE_API_KEY  = Bearer token issued by NIC / GSP
 *   E_INVOICE_GSTIN    = Supplier GSTIN (must match shop.gstin)
 */

const https = require('https');
const logger = require('../utils/logger');

const BASE_URL = process.env.E_INVOICE_API_URL || 'https://einvoice1-sandbox.nic.in/eicore/v1.03';
const API_KEY  = process.env.E_INVOICE_API_KEY  || '';

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port:     url.port || 443,
      path:     url.pathname + url.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'user_name':      process.env.E_INVOICE_USER || '',
        'password':       process.env.E_INVOICE_PASS || '',
        'gstin':          process.env.E_INVOICE_GSTIN || '',
        'Authorization':  `Bearer ${API_KEY}`,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Invalid JSON from IRP: ${raw.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Build IRP payload (schema v1.1) ───────────────────────────────────────────

function buildEInvoicePayload(sale, shop) {
  const docDate = new Date(sale.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/'); // DD/MM/YYYY

  const items = (sale.items || []).map((item, i) => ({
    SlNo:        String(i + 1),
    PrdDesc:     item.product_name || '',
    IsServc:     'N',
    HsnCd:       item.hsn_code || '0',
    Qty:         item.quantity || 1,
    Unit:        (item.unit_of_measurement || 'NOS').toUpperCase(),
    UnitPrice:   item.price_per_unit || 0,
    TotAmt:      item.taxable_amount || 0,
    Discount:    0,
    PreTaxVal:   item.taxable_amount || 0,
    AssAmt:      item.taxable_amount || 0,
    GstRt:       item.gst_rate || 0,
    IgstAmt:     item.igst_amount  || 0,
    CgstAmt:     item.cgst_amount  || 0,
    SgstAmt:     item.sgst_amount  || 0,
    CesRt:       0,
    CesAmt:      0,
    CesNonAdvlAmt: 0,
    StateCesRt:  0,
    StateCesAmt: 0,
    StateCesNonAdvlAmt: 0,
    OthChrg:     0,
    TotItemVal:  item.total_amount || 0,
  }));

  const sellerState = shop.state_code || (shop.gstin ? shop.gstin.slice(0, 2) : '07');

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch:   'GST',
      SupTyp:   sale.supply_type === 'inter_state' ? 'EXPWOP' : 'B2B',
      RegRev:   sale.is_reverse_charge ? 'Y' : 'N',
      EcmGstin: null,
    },
    DocDtls: {
      Typ:  'INV',
      No:   sale.invoice_number,
      Dt:   docDate,
    },
    SellerDtls: {
      Gstin: shop.gstin || '',
      LglNm: shop.legal_name || shop.name || '',
      TrdNm: shop.name || '',
      Addr1: (shop.address || '').slice(0, 100),
      Addr2: '',
      Loc:   shop.city || '',
      Pin:   Number(shop.pincode) || 110001,
      Stcd:  sellerState,
      Ph:    shop.phone || '',
      Em:    shop.email || '',
    },
    BuyerDtls: {
      Gstin: sale.buyer_gstin || 'URP',
      LglNm: sale.buyer_name  || '',
      TrdNm: sale.buyer_name  || '',
      Pos:   sale.buyer_state_code || sale.place_of_supply || sellerState,
      Addr1: (sale.buyer_address || '').slice(0, 100),
      Addr2: '',
      Loc:   '',
      Pin:   110001,
      Stcd:  sale.buyer_state_code || sale.place_of_supply || sellerState,
      Ph:    sale.buyer_phone || '',
      Em:    '',
    },
    ValDtls: {
      AssVal:   sale.taxable_amount || 0,
      CgstVal:  sale.cgst_amount    || 0,
      SgstVal:  sale.sgst_amount    || 0,
      IgstVal:  sale.igst_amount    || 0,
      CesVal:   0,
      StCesVal: 0,
      Discount: sale.discount_amount || 0,
      OthChrg:  0,
      RndOffAmt:0,
      TotInvVal:sale.total_amount    || 0,
    },
    ItemList: items,
  };
}

// ── Generate IRN ──────────────────────────────────────────────────────────────

async function generateIRN(sale, shop) {
  if (!API_KEY) {
    throw new Error('E-invoice API key not configured. Set E_INVOICE_API_KEY in environment.');
  }

  const payload = buildEInvoicePayload(sale, shop);
  logger.info(`[eInvoiceService] generating IRN for invoice ${sale.invoice_number}`);

  const result = await httpPost('/Invoice', payload);

  if (!result.AckNo && !result.Irn) {
    const errMsg = result.ErrorDetails?.[0]?.ErrorMessage || result.message || JSON.stringify(result).slice(0, 200);
    throw new Error(`IRN generation failed: ${errMsg}`);
  }

  return {
    irn:             result.Irn            || result.irn || null,
    ack_no:          String(result.AckNo   || result.ack_no || ''),
    ack_date:        result.AckDt ? new Date(result.AckDt) : new Date(),
    signed_qr_code:  result.SignedQRCode   || result.signed_qr_code || null,
    signed_invoice:  result.SignedInvoice  || null,
  };
}

// ── Cancel IRN ────────────────────────────────────────────────────────────────

async function cancelIRN(irn, reason = '2', remarks = '') {
  if (!API_KEY) throw new Error('E-invoice API key not configured.');
  const result = await httpPost('/Invoice/Cancel', {
    Irn:       irn,
    CnlRsn:    reason,  // 1=Duplicate, 2=Data Entry Error, 3=Order Cancelled, 4=Others
    CnlRem:    remarks || 'Cancelled',
  });
  if (!result.CancelDate) {
    throw new Error(result.message || `IRN cancellation failed: ${JSON.stringify(result).slice(0, 200)}`);
  }
  return { cancelled: true, irn };
}

module.exports = { generateIRN, cancelIRN };
