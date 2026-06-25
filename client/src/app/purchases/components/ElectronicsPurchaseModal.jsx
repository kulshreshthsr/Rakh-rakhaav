'use client';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_TRACKING, CATEGORY_WARRANTY_MONTHS } from '../hooks/useElectronicsPurchaseForm';
import { fmt } from '../../../lib/constants';

/* ── Shared CSS ─────────────────────────────────────────────────────────────── */
const INP  = 'h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';
const INP_SM = 'h-9 rounded-xl border-2 border-slate-200 bg-white px-3 text-[12px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';
const SEL  = 'h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none';
const LBL  = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';
const BTN  = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-all';

/* ── Brand suggestions by category ──────────────────────────────────────────── */
const BRAND_SUGGESTIONS = {
  'Mobiles & Gadgets':    ['Samsung', 'Apple', 'Xiaomi', 'Realme', 'OPPO', 'Vivo', 'OnePlus', 'Nothing', 'iQOO', 'Motorola'],
  'Computing':            ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Apple', 'MSI', 'Samsung', 'LG'],
  'Home Appliances':      ['LG', 'Samsung', 'Whirlpool', 'Godrej', 'Voltas', 'Blue Star', 'Haier', 'Panasonic', 'Bosch', 'IFB'],
  'Audio / Visual':       ['Sony', 'Samsung', 'LG', 'TCL', 'Mi', 'OnePlus', 'Vu', 'Hisense', 'Philips'],
  'Accessories & Spares': ['Boat', 'JBL', 'Zebronics', 'Ambrane', 'Belkin', 'Anker', 'boAt', 'Portronics'],
};

const WARRANTY_BY_OPTIONS = ['Manufacturer', 'Seller', 'Brand Authorized', 'None'];
const WARRANTY_MONTH_OPTIONS = [0, 3, 6, 9, 12, 18, 24, 36];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
];
const GST_RATES = [0, 5, 12, 18, 28];

/* ── IMEI validator ─────────────────────────────────────────────────────────── */
function validateIMEI(v) {
  if (!/^\d{15}$/.test(v)) return 'IMEI must be exactly 15 digits';
  // Luhn check
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(v[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if (sum % 10 !== 0) return 'Invalid IMEI (checksum failed)';
  return null;
}

/* ── ChipInput ──────────────────────────────────────────────────────────────── */
function ChipInput({ chips, onAdd, onRemove, validate, placeholder, maxChips, color = 'blue' }) {
  const [val, setVal]   = useState('');
  const [err, setErr]   = useState('');
  const inputRef        = useRef(null);

  const colorMap = {
    blue:   { chip: 'bg-blue-100 text-blue-800 border border-blue-200',   x: 'text-blue-400 hover:text-blue-700' },
    green:  { chip: 'bg-green-100 text-green-800 border border-green-200', x: 'text-green-400 hover:text-green-700' },
    amber:  { chip: 'bg-amber-100 text-amber-800 border border-amber-200', x: 'text-amber-400 hover:text-amber-700' },
    rose:   { chip: 'bg-rose-100 text-rose-800 border border-rose-200',    x: 'text-rose-400 hover:text-rose-700' },
  };
  const c = colorMap[color] || colorMap.blue;

  function tryAdd(raw) {
    const v = raw.trim();
    if (!v) return;
    if (validate) {
      const e = validate(v);
      if (e) { setErr(e); return; }
    }
    if (chips.includes(v)) { setErr('Already added'); return; }
    if (maxChips && chips.length >= maxChips) return;
    onAdd(v);
    setVal('');
    setErr('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tryAdd(val); }
    if (e.key === 'Backspace' && !val && chips.length > 0) onRemove(chips[chips.length - 1]);
  }

  function handlePaste(e) {
    e.preventDefault();
    const text  = e.clipboardData.getData('text');
    const parts = text.split(/[\n,\t]+/).map(s => s.trim()).filter(Boolean);
    parts.forEach(p => tryAdd(p));
  }

  const atMax = maxChips && chips.length >= maxChips;

  return (
    <div>
      <div
        className="border-2 border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5 min-h-[42px] bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map(chip => (
          <span key={chip} className={`flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-lg text-[12px] font-semibold ${c.chip}`}>
            {chip}
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(chip); }} className={`text-[14px] leading-none ${c.x}`}>×</button>
          </span>
        ))}
        {!atMax && (
          <input
            ref={inputRef}
            type="text"
            value={val}
            onChange={e => { setVal(e.target.value); setErr(''); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={chips.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] outline-none text-[13px] bg-transparent py-0.5"
          />
        )}
      </div>
      {err && <p className="mt-1 text-[11px] text-rose-600">{err}</p>}
    </div>
  );
}

/* ── SupplierPicker ─────────────────────────────────────────────────────────── */
function SupplierPicker({ suppliers, form, updateForm, fillSupplier, loadSuppliers }) {
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const [focused,  setFocused]  = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (focused && !suppliers.length) loadSuppliers();
  }, [focused, suppliers.length, loadSuppliers]);

  useEffect(() => {
    function handle(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = !query
    ? suppliers.slice(0, 8)
    : suppliers.filter(s =>
        s.name?.toLowerCase().includes(query.toLowerCase()) ||
        s.phone?.includes(query)
      ).slice(0, 8);

  function select(s) {
    fillSupplier(s);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <label className={LBL}>Supplier Search</label>
      <input
        className={INP}
        value={open ? query : (form.supplier_name || '')}
        placeholder="Search supplier by name or phone…"
        autoComplete="off"
        onFocus={() => { setFocused(true); setQuery(''); setOpen(true); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-slate-400">No supplier found — fill manually below</p>
          ) : (
            filtered.map(s => (
              <button
                key={s._id}
                type="button"
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0"
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">{s.name}</p>
                    <p className="text-[11px] text-slate-500">{s.phone || ''}{s.gstin ? ` • ${s.gstin}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {Number(s.balance || 0) > 0 && (
                      <p className="text-[11px] font-bold text-rose-600">Due ₹{fmt(s.balance)}</p>
                    )}
                    {s.last_purchase_date && (
                      <p className="text-[10px] text-slate-400">Last: {new Date(s.last_purchase_date).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── ItemCard ─────────────────────────────────────────────────────────────────  */
function ItemCard({ item, products, form, updateItem, removeItem, onProductSelect, index }) {
  const [productSearch, setProductSearch] = useState('');
  const [showProdDrop,  setShowProdDrop]  = useState(false);
  const prodRef = useRef(null);

  useEffect(() => {
    function handle(e) { if (prodRef.current && !prodRef.current.contains(e.target)) setShowProdDrop(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filteredProds = !productSearch
    ? products.slice(0, 10)
    : products.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode?.includes(productSearch) ||
        p.sku?.includes(productSearch)
      ).slice(0, 10);

  function selectProduct(p) {
    onProductSelect(item._rowId, p);
    setProductSearch('');
    setShowProdDrop(false);
  }

  const qty    = Number(item.quantity     || 0);
  const cost   = Number(item.price_per_unit || 0);
  const disc   = Number(item.discount     || 0);
  const gstR   = Number(item.gst_rate     || 0);
  const lineNet = qty * cost * (1 - disc / 100);
  const lineGst = lineNet * gstR / 100;
  const lineTotal = lineNet + lineGst;

  const category     = item._product?.category || '';
  const brandSuggest = BRAND_SUGGESTIONS[category] || [];
  const trackMode    = item.tracking_mode;

  const primaryCount = trackMode === 'imei' ? item.imeis.filter(Boolean).length : item.serials.filter(Boolean).length;
  const trackFull    = qty > 0 && primaryCount === qty;
  const trackPartial = primaryCount > 0 && primaryCount < qty;

  const warrantyExpiry = (() => {
    if (!form.purchase_date || !Number(item.warranty_months)) return '';
    const d = new Date(form.purchase_date);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + Number(item.warranty_months));
    return d.toLocaleDateString('en-IN');
  })();

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Item {index + 1}</span>
          {category && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide">
              {category}
            </span>
          )}
          {item.brand && (
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold">
              {item.brand}
            </span>
          )}
        </div>
        <button type="button" onClick={() => removeItem(item._rowId)}
          className="text-slate-300 hover:text-rose-500 transition-colors text-[18px] leading-none font-light">
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Product search */}
        <div ref={prodRef} className="relative">
          <label className={LBL}>Product *</label>
          <input
            className={INP + (item.product_id ? ' border-green-300 bg-green-50/30' : '')}
            value={showProdDrop ? productSearch : (item.product_name || '')}
            placeholder="Search product by name, SKU or barcode…"
            autoComplete="off"
            onFocus={() => { setProductSearch(''); setShowProdDrop(true); }}
            onChange={e => { setProductSearch(e.target.value); setShowProdDrop(true); }}
            onBlur={() => setTimeout(() => setShowProdDrop(false), 150)}
          />
          {showProdDrop && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
              {filteredProds.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-slate-400">No products found</p>
              ) : (
                filteredProds.map(p => (
                  <button key={p._id} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0"
                    onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900">{p.name}</p>
                        <p className="text-[11px] text-slate-400">{p.category || ''}{p.sku ? ` · ${p.sku}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-slate-700">₹{fmt(p.price || 0)}</p>
                        <p className="text-[10px] text-slate-400">Stock: {p.quantity || 0}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Brand / Model row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className={LBL}>Brand</label>
            <input
              list={`brands-${item._rowId}`}
              className={INP_SM + ' w-full'}
              value={item.brand}
              placeholder="e.g. Samsung"
              onChange={e => updateItem(item._rowId, { brand: e.target.value })}
            />
            <datalist id={`brands-${item._rowId}`}>
              {brandSuggest.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div>
            <label className={LBL}>Model / Part No.</label>
            <input
              className={INP_SM + ' w-full'}
              value={item.model_no}
              placeholder="e.g. Galaxy A54 5G"
              onChange={e => updateItem(item._rowId, { model_no: e.target.value })}
            />
          </div>
        </div>

        {/* Pricing row */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={LBL}>Qty *</label>
            <input type="number" min="1" className={INP_SM + ' w-full'} value={item.quantity}
              onChange={e => updateItem(item._rowId, { quantity: e.target.value })} />
          </div>
          <div>
            <label className={LBL}>Cost / Unit *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 font-semibold">₹</span>
              <input type="number" min="0" className={INP_SM + ' w-full pl-6'} value={item.price_per_unit}
                placeholder="0"
                onChange={e => updateItem(item._rowId, { price_per_unit: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={LBL}>Disc %</label>
            <input type="number" min="0" max="100" className={INP_SM + ' w-full'} value={item.discount || ''}
              placeholder="0"
              onChange={e => updateItem(item._rowId, { discount: e.target.value })} />
          </div>
          <div>
            <label className={LBL}>GST %</label>
            <select className={SEL + ' h-9 text-[12px]'} value={item.gst_rate}
              onChange={e => updateItem(item._rowId, { gst_rate: Number(e.target.value) })}>
              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
        </div>

        {/* Live line total */}
        {qty > 0 && cost > 0 && (
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-2 text-[12px]">
            <span className="text-slate-500">Net: <strong className="text-slate-900">₹{fmt(lineNet)}</strong></span>
            <span className="text-slate-500">GST: <strong className="text-slate-900">₹{fmt(lineGst)}</strong></span>
            <span className="ml-auto text-[14px] font-black text-blue-700">₹{fmt(lineTotal)}</span>
          </div>
        )}

        {/* Tracking mode selector */}
        {item.product_id && (
          <div>
            <label className={LBL}>Tracking Mode</label>
            <div className="flex gap-2">
              {(['imei', 'serial', 'optional', 'none']).map(mode => (
                <button key={mode} type="button"
                  onClick={() => updateItem(item._rowId, { tracking_mode: mode, serials: [], imeis: [], imeis2: [] })}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-all ${
                    item.tracking_mode === mode
                      ? mode === 'imei'     ? 'bg-purple-600 text-white border-purple-600'
                      : mode === 'serial'   ? 'bg-blue-600 text-white border-blue-600'
                      : mode === 'optional' ? 'bg-slate-600 text-white border-slate-600'
                      :                       'bg-slate-200 text-slate-600 border-slate-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {mode === 'imei'     ? '📱 IMEI'
                  : mode === 'serial'  ? '🔢 Serial'
                  : mode === 'optional'? '○ Optional'
                  : '— None'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* IMEI Entry */}
        {trackMode === 'imei' && (
          <div className="bg-purple-50 border-2 border-purple-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">IMEI Numbers</label>
              <span className={`text-[11px] font-bold ${trackFull ? 'text-green-600' : trackPartial ? 'text-amber-600' : 'text-slate-400'}`}>
                {primaryCount}/{qty} {trackFull ? '✓' : trackPartial ? '⚠ incomplete' : 'entered'}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-purple-500 mb-1">Primary IMEI (15 digits) — Enter, comma, or paste</p>
              <ChipInput
                chips={item.imeis}
                onAdd={v => updateItem(item._rowId, { imeis: [...item.imeis, v] })}
                onRemove={v => updateItem(item._rowId, { imeis: item.imeis.filter(i => i !== v) })}
                validate={validateIMEI}
                placeholder="Type IMEI and press Enter…"
                maxChips={qty || undefined}
                color="blue"
              />
            </div>
            <div>
              <p className="text-[10px] text-purple-400 mb-1">Secondary IMEI / IMEI2 (dual-SIM, optional)</p>
              <ChipInput
                chips={item.imeis2}
                onAdd={v => updateItem(item._rowId, { imeis2: [...item.imeis2, v] })}
                onRemove={v => updateItem(item._rowId, { imeis2: item.imeis2.filter(i => i !== v) })}
                validate={validateIMEI}
                placeholder="IMEI2 (optional)…"
                maxChips={qty || undefined}
                color="amber"
              />
            </div>
          </div>
        )}

        {/* Serial Number Entry */}
        {(trackMode === 'serial' || trackMode === 'optional') && (
          <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Serial Numbers {trackMode === 'optional' ? '(Optional)' : ''}
              </label>
              {trackMode === 'serial' && (
                <span className={`text-[11px] font-bold ${trackFull ? 'text-green-600' : trackPartial ? 'text-amber-600' : 'text-slate-400'}`}>
                  {item.serials.filter(Boolean).length}/{qty} {trackFull ? '✓' : trackPartial ? '⚠ incomplete' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-blue-400">Enter one serial per chip — press Enter, comma, or paste a list</p>
            <ChipInput
              chips={item.serials}
              onAdd={v => updateItem(item._rowId, { serials: [...item.serials, v] })}
              onRemove={v => updateItem(item._rowId, { serials: item.serials.filter(s => s !== v) })}
              placeholder="Type serial number and press Enter…"
              maxChips={trackMode === 'serial' ? (qty || undefined) : undefined}
              color="green"
            />
          </div>
        )}

        {/* Warranty */}
        {item.product_id && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LBL}>Warranty</label>
              <select className={SEL + ' h-9 text-[12px]'} value={item.warranty_months}
                onChange={e => updateItem(item._rowId, { warranty_months: Number(e.target.value) })}>
                {WARRANTY_MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>{m === 0 ? 'No warranty' : `${m} months`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LBL}>Warranty By</label>
              <select className={SEL + ' h-9 text-[12px]'} value={item.warranty_by}
                onChange={e => updateItem(item._rowId, { warranty_by: e.target.value })}>
                {WARRANTY_BY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Expires On</label>
              <div className="h-9 flex items-center px-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[12px] text-slate-600 font-semibold">
                {warrantyExpiry || (Number(item.warranty_months) === 0 ? '—' : 'Set date above')}
              </div>
            </div>
          </div>
        )}

        {/* Device Specs (collapsible) */}
        {item.product_id && (
          <details className="group">
            <summary className="cursor-pointer text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 select-none list-none flex items-center gap-1">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              Device Specs (color, storage, RAM)
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <label className={LBL}>Color</label>
                <input className={INP_SM + ' w-full'} value={item.color} placeholder="e.g. Midnight Black"
                  onChange={e => updateItem(item._rowId, { color: e.target.value })} />
              </div>
              <div>
                <label className={LBL}>Storage</label>
                <input className={INP_SM + ' w-full'} value={item.storage} placeholder="e.g. 128GB"
                  onChange={e => updateItem(item._rowId, { storage: e.target.value })} />
              </div>
              <div>
                <label className={LBL}>RAM</label>
                <input className={INP_SM + ' w-full'} value={item.ram} placeholder="e.g. 8GB"
                  onChange={e => updateItem(item._rowId, { ram: e.target.value })} />
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/* ── TotalsPanel ────────────────────────────────────────────────────────────── */
function TotalsPanel({ billTotals, form, updateForm, submitting, handleSubmit, editingPurchaseId, error }) {
  const amountPaidNum = Number(form.amount_paid || 0);
  const isCash    = form.payment_type === 'cash';
  const isCredit  = form.payment_type === 'credit';
  const balanceDue = isCredit
    ? Math.max(0, billTotals.total - amountPaidNum)
    : 0;

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Bill Summary</h3>
        <div className="flex justify-between text-[13px] text-slate-600">
          <span>Taxable Amount</span>
          <span className="font-semibold text-slate-900">₹{fmt(billTotals.taxable)}</span>
        </div>
        <div className="flex justify-between text-[13px] text-slate-600">
          <span>GST / ITC</span>
          <span className="font-semibold text-slate-900">₹{fmt(billTotals.gst)}</span>
        </div>
        <div className="border-t border-slate-200 pt-2 flex justify-between text-[15px] font-black text-slate-900">
          <span>Total</span>
          <span>₹{fmt(billTotals.total)}</span>
        </div>
        {isCredit && balanceDue > 0 && (
          <div className="flex justify-between text-[13px] font-bold text-rose-600">
            <span>Balance Due</span>
            <span>₹{fmt(balanceDue)}</span>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment</h3>
        <div>
          <label className={LBL}>Mode</label>
          <select className={SEL} value={form.payment_type} onChange={e => updateForm({ payment_type: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="credit">Credit (Pay Later)</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
        {(isCredit || form.payment_type === 'upi' || form.payment_type === 'bank') && (
          <div>
            <label className={LBL}>{isCredit ? 'Amount Paid Now' : 'Amount'}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 font-semibold">₹</span>
              <input type="number" min="0" className={INP + ' pl-6'}
                value={form.amount_paid}
                placeholder={`0 (max ₹${fmt(billTotals.total)})`}
                onChange={e => updateForm({ amount_paid: e.target.value })} />
            </div>
          </div>
        )}
        {isCredit && (
          <div>
            <label className={LBL}>Due Date</label>
            <input type="date" className={INP} value={form.due_date}
              onChange={e => updateForm({ due_date: e.target.value })} />
          </div>
        )}
      </div>

      {/* ITC toggles */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">GST / ITC</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded"
            checked={form.itc_eligible}
            onChange={e => updateForm({ itc_eligible: e.target.checked })} />
          <span className="text-[12px] text-slate-700 font-medium">ITC Eligible</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded"
            checked={form.is_reverse_charge}
            onChange={e => updateForm({ is_reverse_charge: e.target.checked })} />
          <span className="text-[12px] text-slate-700 font-medium">Reverse Charge (RCM)</span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl px-4 py-3 text-[13px] text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Save */}
      <button type="submit" disabled={submitting}
        className="w-full py-3.5 rounded-xl text-[15px] font-black text-white bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:pointer-events-none transition-all">
        {submitting ? 'Saving…' : editingPurchaseId ? '✓ Update Purchase' : '✓ Save Purchase Bill'}
      </button>
    </div>
  );
}

/* ── Main Modal ─────────────────────────────────────────────────────────────── */
export default function ElectronicsPurchaseModal({
  showModal,
  resetModal,
  editingPurchaseId,
  submitting,
  error,
  setError,
  form,
  updateForm,
  items,
  updateItem,
  addItem,
  removeItem,
  suppliers,
  loadSuppliers,
  fillSupplier,
  onProductSelect,
  billTotals,
  handleSubmit,
  products,
  isOnline,
}) {
  /* Close on Escape */
  useEffect(() => {
    if (!showModal) return;
    const handle = (e) => { if (e.key === 'Escape') resetModal(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [showModal, resetModal]);

  /* Load suppliers when modal opens */
  useEffect(() => {
    if (showModal) loadSuppliers();
  }, [showModal, loadSuppliers]);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={resetModal} />

      {/* Dialog */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[1200px] mx-auto my-4 sm:my-8 bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ minHeight: 'calc(100vh - 32px)', maxHeight: 'calc(100vh - 32px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-white border-b-2 border-slate-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[18px] font-black text-slate-900">
                {editingPurchaseId ? 'Edit Purchase' : 'New Electronics Purchase'}
              </h2>
              <p className="text-[12px] text-slate-500 font-medium mt-0.5">Serial tracking · IMEI · Warranty</p>
            </div>
            {/* Document type indicator */}
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold uppercase tracking-wide">
              📋 Purchase Invoice
            </span>
            {!isOnline && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                ⚡ Offline
              </span>
            )}
          </div>
          <button type="button" onClick={resetModal}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors text-[22px] leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: scrollable form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

            {/* Purchase meta */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Purchase Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={LBL}>Purchase Date</label>
                  <input type="date" className={INP} value={form.purchase_date}
                    onChange={e => updateForm({ purchase_date: e.target.value })} />
                </div>
                <div>
                  <label className={LBL}>Supplier Invoice #</label>
                  <input className={INP} value={form.supplier_invoice_no} placeholder="Inv-001"
                    onChange={e => updateForm({ supplier_invoice_no: e.target.value })} />
                </div>
                <div>
                  <label className={LBL}>Invoice Date</label>
                  <input type="date" className={INP} value={form.supplier_invoice_date}
                    onChange={e => updateForm({ supplier_invoice_date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Supplier */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Supplier</h3>
              <SupplierPicker
                suppliers={suppliers}
                form={form}
                updateForm={updateForm}
                fillSupplier={fillSupplier}
                loadSuppliers={loadSuppliers}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className={LBL}>Name</label>
                  <input className={INP} value={form.supplier_name} placeholder="Supplier name"
                    onChange={e => updateForm({ supplier_name: e.target.value })} />
                </div>
                <div>
                  <label className={LBL}>Phone</label>
                  <input className={INP} value={form.supplier_phone} placeholder="10-digit mobile"
                    onChange={e => updateForm({ supplier_phone: e.target.value })} />
                </div>
                <div>
                  <label className={LBL}>GSTIN</label>
                  <input className={INP} value={form.supplier_gstin} placeholder="22AAAAA0000A1Z5"
                    onChange={e => updateForm({ supplier_gstin: e.target.value.toUpperCase() })} />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <label className={LBL}>Address</label>
                  <input className={INP} value={form.supplier_address} placeholder="Street, City"
                    onChange={e => updateForm({ supplier_address: e.target.value })} />
                </div>
                <div>
                  <label className={LBL}>State</label>
                  <select className={SEL} value={form.supplier_state}
                    onChange={e => updateForm({ supplier_state: e.target.value })}>
                    <option value="">— State —</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Products ({items.length} item{items.length !== 1 ? 's' : ''})
                </h3>
              </div>

              {items.map((item, idx) => (
                <ItemCard
                  key={item._rowId}
                  item={item}
                  index={idx}
                  products={products}
                  form={form}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  onProductSelect={onProductSelect}
                />
              ))}

              <button type="button" onClick={addItem}
                className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-[13px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all">
                + Add Another Product
              </button>
            </div>

            {/* Notes */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4">
              <label className={LBL}>Notes (optional)</label>
              <textarea className="w-full h-16 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all"
                value={form.notes} placeholder="Internal note about this purchase…"
                onChange={e => updateForm({ notes: e.target.value })} />
            </div>
          </div>

          {/* RIGHT: sticky totals panel (desktop only) */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0 bg-slate-100/80 border-l-2 border-slate-200 overflow-y-auto p-4">
            <TotalsPanel
              billTotals={billTotals}
              form={form}
              updateForm={updateForm}
              submitting={submitting}
              handleSubmit={handleSubmit}
              editingPurchaseId={editingPurchaseId}
              error={error}
            />
          </div>
        </div>

        {/* Mobile sticky footer */}
        <div className="lg:hidden bg-white border-t-2 border-slate-200 px-4 py-3 shrink-0">
          {error && (
            <p className="text-[12px] text-rose-600 font-medium mb-2">{error}</p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total</p>
              <p className="text-[18px] font-black text-blue-700">₹{fmt(billTotals.total)}</p>
            </div>
            {/* Payment mode quick select */}
            <select className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-[12px] text-slate-700 focus:outline-none focus:border-blue-500 transition-all"
              value={form.payment_type} onChange={e => updateForm({ payment_type: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
            </select>
            <button type="submit" disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all">
              {submitting ? '…' : editingPurchaseId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
