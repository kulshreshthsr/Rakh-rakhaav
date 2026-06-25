'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import DynamicFormSection, { validateSections } from './DynamicFormSection';

/* ─── Unit catalogue ───────────────────────────────────────────────────────── */
const ALL_UNITS = [
  'Piece', 'Pcs', 'Kg', 'Gram', 'Metre', 'Feet', 'Inch',
  'Litre', 'ML', 'Bag', 'Bundle', 'Coil', 'Roll',
  'Sheet', 'Set', 'Pair', 'Dozen', 'Packet',
  'Carton', 'Box', 'Drum',
];

const PACK_UNITS = ['Box', 'Carton', 'Bag', 'Bundle', 'Case', 'Drum', 'Pallet', 'Pack'];
const LOOSE_UNITS = ['Piece', 'Metre', 'Kg', 'Gram', 'Litre', 'Feet', 'Inch', 'ML'];

const GST_OPTIONS = [
  { value: 0,  label: '0% — Exempt / No GST' },
  { value: 5,  label: '5% GST' },
  { value: 12, label: '12% GST' },
  { value: 18, label: '18% GST' },
  { value: 28, label: '28% GST' },
];

/* ─── Category intelligence ────────────────────────────────────────────────── */
// When a category is selected, we pre-fill unit, HSN, GST and suggest material types.
// All suggestions are non-destructive — they only apply if the field is still at default.
const CATEGORY_INTEL = {
  'Paints & Finishes':    { unit: 'Litre',  gst: 18, hsn: '3210', materialTypes: ['Water Based', 'Oil Based', 'Enamel', 'Primer', 'Distemper', 'Putty', 'Texture Paint'] },
  'Plumbing & Sanitary':  { unit: 'Piece',  gst: 18, hsn: '3917', materialTypes: ['PVC', 'CPVC', 'GI', 'UPVC', 'Cast Iron', 'PPR', 'Brass'] },
  'Electrical':           { unit: 'Piece',  gst: 18, hsn: '8536', materialTypes: ['Copper', 'Aluminium', 'PVC Insulated', 'Armoured', 'FR', 'FRLS'] },
  'Building Materials':   { unit: 'Bag',    gst: 28, hsn: '2523', materialTypes: ['Cement', 'AAC Block', 'Red Brick', 'Fly Ash Brick', 'Stone', 'Sand', 'Aggregate'] },
  'Tools & Power Tools':  { unit: 'Piece',  gst: 18, hsn: '8467', materialTypes: ['Steel', 'Alloy Steel', 'HSS', 'Carbide Tipped', 'Chrome Vanadium'] },
  'Fasteners & Fittings': { unit: 'Piece',  gst: 18, hsn: '7318', materialTypes: ['MS', 'SS304', 'GI', 'Nylon', 'Brass', 'Hex', 'Self Drilling'] },
  'Other':                { unit: 'Piece',  gst: 18, hsn: '',     materialTypes: [] },
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const normalizeBarcode = (v = '') => String(v).replace(/\s+/g, '').trim();

function generateSKU(categoryName, productCount) {
  const prefix = categoryName
    ? categoryName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3)
    : 'MAT';
  return `${prefix}-${String((productCount || 0) + 1).padStart(4, '0')}`;
}

function generateBarcode() {
  // EAN-13 style: starts with 8 (private range), 11 random digits, 1 check digit
  const digits = [8, ...Array.from({ length: 11 }, () => Math.floor(Math.random() * 10))];
  let sum = 0;
  digits.forEach((d, i) => { sum += i % 2 === 0 ? d : d * 3; });
  digits.push((10 - (sum % 10)) % 10);
  return digits.join('');
}

/* ─── Shared CSS ───────────────────────────────────────────────────────────── */
const INP = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';
const INP_SM = 'h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';
const SEL = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';
const LBL = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

/* ─── Sub-components ───────────────────────────────────────────────────────── */

/**
 * Searchable dropdown — keyboard navigable, closes on outside click.
 * Falls back gracefully when options list is empty.
 */
function SearchableDropdown({ options = [], value, onChange, placeholder, id, required }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function select(opt) {
    onChange(opt);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); setHighlighted(0); } return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Escape')     { setOpen(false); }
    if (e.key === 'Enter' && filtered[highlighted]) { e.preventDefault(); select(filtered[highlighted]); }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        className={INP}
        value={open ? query : value}
        placeholder={placeholder || 'Type to search…'}
        autoComplete="off"
        required={required}
        onFocus={() => { setOpen(true); setQuery(''); setHighlighted(0); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        role="combobox"
      />
      {/* Chevron */}
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-2xl max-h-52 overflow-y-auto"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-slate-400">No matches — type to add custom</p>
          ) : filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={value === opt}
              onMouseDown={e => { e.preventDefault(); select(opt); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                i === highlighted ? 'bg-green-50 text-green-700' : 'text-slate-700 hover:bg-slate-50'
              } ${value === opt ? 'font-bold' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Live margin/profit/markup card. Green for profit, rose for loss.
 */
function MarginCard({ cost, selling }) {
  const c = parseFloat(cost) || 0;
  const s = parseFloat(selling) || 0;
  if (!c || !s) return null;

  const profit  = s - c;
  const margin  = ((profit / s) * 100).toFixed(1);   // on selling price
  const markup  = ((profit / c) * 100).toFixed(1);   // on cost price
  const isGood  = profit >= 0;

  return (
    <div className={`rounded-2xl border-2 p-4 transition-colors ${isGood ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
        {isGood ? '📈 Margin Analysis' : '⚠️ Loss Alert — Selling Below Cost'}
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Profit / Unit', val: `₹${Math.abs(profit).toFixed(2)}` },
          { label: 'Margin',        val: `${Math.abs(margin)}%` },
          { label: 'Markup',        val: `${Math.abs(markup)}%` },
        ].map(({ label, val }) => (
          <div key={label} className={`rounded-xl py-2.5 ${isGood ? 'bg-emerald-100/60' : 'bg-rose-100/60'}`}>
            <p className={`text-[18px] font-black leading-none ${isGood ? 'text-emerald-700' : 'text-rose-700'}`}>{val}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Collapsible section within Advanced Details.
 */
function AdvSection({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-600">
          <span>{icon}</span>
          <span>{title}</span>
        </span>
        <span className={`text-slate-400 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 bg-white animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Price field with ₹ prefix ────────────────────────────────────────────── */
function PriceField({ label, required, value, onChange, placeholder, error, hint, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className={LBL}>
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[14px]">₹</span>
        <input
          id={id}
          className={`${INP} pl-8 ${error ? 'border-rose-400 focus:border-rose-500' : ''}`}
          type="number"
          step="0.01"
          min="0"
          placeholder={placeholder || '0.00'}
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode="decimal"
          required={required}
        />
      </div>
      {error && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{error}</p>}
      {hint && !error && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function AddMaterialModal({
  config        = {},
  term          = (k, fb) => fb,
  onSave,                      // async (formData, metadata) => void — throws on error
  onClose,
  editProduct   = null,
  products      = [],          // used for SKU sequence
  isOnline      = true,
}) {
  const pSchema    = config.productFormSchema || {};
  const trackQty   = pSchema.trackQuantity !== false;
  const unitOpts   = Array.isArray(pSchema.unitOptions) ? pSchema.unitOptions : ALL_UNITS;
  const nameLabel  = pSchema.nameLabel || (term('product', 'Material') + ' Name');
  const categories = config.categoryConfig?.categories || [];
  const defaultUnit = unitOpts[0] || 'Piece';

  /* ── Form state ── */
  const initForm = useCallback(() => {
    if (editProduct) {
      return {
        name:                   editProduct.name              || '',
        category:               editProduct.category          || '',
        sub_category:           editProduct.sub_category      || '',
        barcode:                editProduct.barcode           || '',
        cost_price:             editProduct.cost_price        || '',
        price:                  editProduct.price             || '',
        quantity:               editProduct.quantity          ?? '',
        unit:                   editProduct.unit              || defaultUnit,
        mrp:                    editProduct.mrp               || '',
        dealer_price:           editProduct.dealer_price      || '',
        project_price:          editProduct.project_price     || '',
        sku:                    editProduct.sku               || '',
        hsn_code:               editProduct.hsn_code          || '',
        gst_rate:               editProduct.gst_rate          ?? 0,
        low_stock_threshold:    editProduct.low_stock_threshold ?? 5,
        description:            editProduct.description       || '',
        pack_size:              editProduct.pack_size         || '',
        pack_unit:              editProduct.pack_unit         || '',
        loose_unit:             editProduct.loose_unit        || '',
        sold_in_loose:          !!editProduct.sold_in_loose,
        loose_price:            editProduct.loose_price       || '',
        batch_tracking_enabled: !!editProduct.batch_tracking_enabled,
      };
    }
    return {
      name: '', category: '', sub_category: '', barcode: '',
      cost_price: '', price: '', quantity: '', unit: defaultUnit,
      mrp: '', dealer_price: '', project_price: '',
      sku: '', hsn_code: '', gst_rate: 0, low_stock_threshold: 5,
      description: '', pack_size: '', pack_unit: '',
      loose_unit: '', sold_in_loose: false, loose_price: '',
      batch_tracking_enabled: false,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editProduct, defaultUnit]);

  const [form,         setForm]         = useState(initForm);
  const [metadata,     setMetadata]     = useState(editProduct?.metadata ? { ...editProduct.metadata } : {});
  const [metaErrors,   setMetaErrors]   = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [showScanner,  setShowScanner]  = useState(false);
  const [lastScanned,  setLastScanned]  = useState('');
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [catIntel,     setCatIntel]     = useState(null); // category intelligence context

  const nameRef = useRef(null);

  /* ── Auto-focus name on open ── */
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape' && !showScanner) { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('amm-btn-save')?.click();
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById('amm-btn-save-another')?.click();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showScanner]);

  /* ── Field setter ── */
  const set = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);
  const setMeta = useCallback((key, val) => {
    setMetadata(m => ({ ...m, [key]: val }));
    setMetaErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  /* ── Category intelligence ── */
  function applyCategory(cat) {
    const intel = CATEGORY_INTEL[cat];
    setCatIntel(intel || null);
    setForm(f => ({
      ...f,
      category:    cat,
      sub_category: '',
      // Only overwrite unit/hsn/gst if still at defaults (non-destructive)
      unit:     (!f.unit || f.unit === defaultUnit)                  ? (intel?.unit    || f.unit)     : f.unit,
      hsn_code: !f.hsn_code                                          ? (intel?.hsn     || '')         : f.hsn_code,
      gst_rate: f.gst_rate === 0                                     ? (intel?.gst     ?? 0)          : f.gst_rate,
    }));
  }

  /* ── Computed values ── */
  const costPrice   = parseFloat(form.cost_price) || 0;
  const sellPrice   = parseFloat(form.price)      || 0;
  const retailPrice = parseFloat(form.mrp)        || 0;
  const dealerPrice = parseFloat(form.dealer_price) || 0;

  const mrpViolation     = retailPrice > 0 && sellPrice > retailPrice;
  const belowCost        = costPrice > 0 && sellPrice > 0 && sellPrice < costPrice;
  const dealerAboveRetail = dealerPrice > 0 && retailPrice > 0 && dealerPrice > retailPrice;

  const categorySubcategories = form.category
    ? (config.categoryConfig?.subCategories?.[form.category] || [])
    : [];

  const attrSections = config.productAttributeSections || [];

  /* ── Reset for Save & Add Another ── */
  function resetForNext() {
    const prevCategory = form.category;
    const prevUnit     = form.unit;
    const prevGst      = form.gst_rate;
    const prevHsn      = form.hsn_code;
    setForm({
      name: '', category: prevCategory, sub_category: '', barcode: '',
      cost_price: '', price: '', quantity: '', unit: prevUnit,
      mrp: '', dealer_price: '', project_price: '',
      sku: '', hsn_code: prevHsn, gst_rate: prevGst,
      low_stock_threshold: 5, description: '',
      pack_size: '', pack_unit: '', loose_unit: '', sold_in_loose: false,
      loose_price: '', batch_tracking_enabled: false,
    });
    setMetadata({});
    setMetaErrors({});
    setLastScanned('');
    setError('');
    setSaveSuccess(true);
    setTimeout(() => { setSaveSuccess(false); nameRef.current?.focus(); }, 1800);
  }

  /* ── Save ── */
  async function handleSave(mode = 'save') {
    setError('');

    // Client validations
    if (!form.name.trim()) {
      setError(`${nameLabel} is required.`);
      nameRef.current?.focus();
      return;
    }
    if (form.price === '' || parseFloat(form.price) < 0) {
      setError('Selling price is required and cannot be negative.');
      return;
    }
    if (form.quantity !== '' && parseFloat(form.quantity) < 0) {
      setError('Opening stock cannot be negative.');
      return;
    }

    // Dynamic field validation
    const attrErrs = validateSections(attrSections, metadata);
    if (Object.keys(attrErrs).length > 0) {
      setMetaErrors(attrErrs);
      setShowAdvanced(true);
      setError('Please fill required fields in Advanced Details.');
      return;
    }
    setMetaErrors({});

    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          gst_rate: parseInt(form.gst_rate, 10),
          quantity: form.quantity === '' ? 0 : parseFloat(form.quantity),
          low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
        },
        metadata,
      );

      if (mode === 'save-another') {
        resetForNext();
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-label={editProduct ? `Edit ${term('product', 'Material')}` : `Add ${term('product', 'Material')}`}
      >
        {/* ── Modal shell ── */}
        <div className="w-full sm:max-w-[960px] max-h-[96dvh] sm:max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">

          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* ── HEADER ── */}
          <div className="flex-shrink-0 border-b border-slate-100 px-5 sm:px-7 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {editProduct ? `Edit ${term('product', 'Material')}` : `New ${term('product', 'Material')}`}
              </p>
              <h3 className="text-[18px] font-black text-slate-900 mt-0.5 leading-tight">
                {editProduct ? editProduct.name : `${term('product', 'Material')} जोड़ो`}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Keyboard hints — desktop only */}
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <kbd className="text-[9px] font-mono text-slate-400 bg-white border border-slate-200 rounded px-1 py-0.5">Ctrl+↵</kbd>
                <span className="text-[9px] text-slate-400">Save</span>
                <span className="text-slate-300 mx-0.5">·</span>
                <kbd className="text-[9px] font-mono text-slate-400 bg-white border border-slate-200 rounded px-1 py-0.5">ESC</kbd>
                <span className="text-[9px] text-slate-400">Close</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
                aria-label="Close"
              >✕</button>
            </div>
          </div>

          {/* ── BODY ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 sm:px-7 py-5 space-y-4">

              {/* Success flash */}
              {saveSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-300 text-[13px] font-bold text-emerald-700 animate-pulse">
                  ✓ Saved! Add the next item.
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700" role="alert">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* ════════════════════════════════════════════
                  LAYER 1 — QUICK ADD
              ════════════════════════════════════════════ */}

              {/* Row: Name + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="amm-name" className={LBL}>
                    {nameLabel} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={nameRef}
                    id="amm-name"
                    className={INP}
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. OPC Cement 50Kg"
                    autoComplete="off"
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="amm-category" className={LBL}>
                    Category <span className="text-rose-500">*</span>
                  </label>
                  {categories.length > 0 ? (
                    <select
                      id="amm-category"
                      className={SEL}
                      value={form.category}
                      onChange={e => applyCategory(e.target.value)}
                      required
                      aria-required="true"
                    >
                      <option value="">— Select Category —</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      id="amm-category"
                      className={INP}
                      value={form.category}
                      onChange={e => set('category', e.target.value)}
                      placeholder="Category"
                    />
                  )}
                  {catIntel && form.category && (
                    <p className="text-[10px] text-green-600 mt-1 font-semibold">
                      ✓ Smart defaults applied — unit, HSN &amp; GST pre-filled
                    </p>
                  )}
                </div>
              </div>

              {/* Subcategory — conditional */}
              {categorySubcategories.length > 0 && (
                <div>
                  <label htmlFor="amm-subcat" className={LBL}>Sub-Category</label>
                  <select
                    id="amm-subcat"
                    className={SEL}
                    value={form.sub_category}
                    onChange={e => set('sub_category', e.target.value)}
                  >
                    <option value="">— All Sub-categories —</option>
                    {categorySubcategories.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                </div>
              )}

              {/* Barcode */}
              <div>
                <label className={LBL}>Barcode</label>
                <div className="flex gap-2">
                  <input
                    className={`${INP} flex-1 font-mono tracking-wider`}
                    placeholder="Scan, generate, or type manually"
                    value={form.barcode}
                    onChange={e => { const nb = normalizeBarcode(e.target.value); set('barcode', nb); }}
                    inputMode="numeric"
                    aria-label="Barcode"
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-white text-xl hover:bg-slate-50 flex-shrink-0 transition-colors"
                    title="Scan barcode with camera"
                    aria-label="Scan barcode"
                  >📷</button>
                  <button
                    type="button"
                    onClick={() => { set('barcode', generateBarcode()); setLastScanned(''); }}
                    className="h-11 px-3 rounded-xl border-2 border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex-shrink-0 transition-colors whitespace-nowrap"
                    title="Auto-generate EAN-13 barcode"
                  >⚡ Generate</button>
                </div>
                {lastScanned && (
                  <p className="text-[10px] mt-1 text-emerald-600 font-semibold">✓ Scanned: <span className="font-mono">{lastScanned}</span></p>
                )}
              </div>

              {/* Row: Cost Price + Selling Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PriceField
                  id="amm-cost"
                  label="Cost Price"
                  placeholder="Your purchase cost"
                  value={form.cost_price}
                  onChange={v => set('cost_price', v)}
                />
                <PriceField
                  id="amm-price"
                  label="Selling Price"
                  required
                  placeholder="Customer pays"
                  value={form.price}
                  onChange={v => set('price', v)}
                  error={
                    mrpViolation  ? '⚠️ Above retail price — possible DPCO violation' :
                    belowCost     ? '⚠️ Below cost price — selling at a loss' :
                    null
                  }
                  hint={
                    form.mrp && !mrpViolation
                      ? `Retail: ₹${form.mrp}`
                      : null
                  }
                />
              </div>

              {/* Row: Opening Stock + Unit */}
              {trackQty && (
                <div className="grid grid-cols-2 sm:grid-cols-[1fr,180px] gap-3">
                  <div>
                    <label htmlFor="amm-qty" className={LBL}>Opening Stock</label>
                    <input
                      id="amm-qty"
                      className={INP}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={form.quantity}
                      onChange={e => set('quantity', e.target.value)}
                      disabled={!!editProduct}
                      inputMode="decimal"
                      aria-label="Opening stock quantity"
                    />
                    {editProduct && (
                      <p className="text-[10px] text-slate-400 mt-1">Use Stock action to adjust</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="amm-unit" className={LBL}>Unit</label>
                    <SearchableDropdown
                      id="amm-unit"
                      options={unitOpts}
                      value={form.unit}
                      onChange={val => set('unit', val)}
                      placeholder="Select unit…"
                    />
                  </div>
                </div>
              )}

              {/* Live Margin Card */}
              {costPrice > 0 && sellPrice > 0 && (
                <MarginCard cost={costPrice} selling={sellPrice} />
              )}

              {/* Price Tiers */}
              <div>
                <p className={LBL}>
                  Additional Price Tiers
                  <span className="text-slate-300 font-normal normal-case tracking-normal ml-1">(optional)</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <PriceField
                    id="amm-retail"
                    label="Retail Price"
                    placeholder="—"
                    value={form.mrp}
                    onChange={v => set('mrp', v)}
                  />
                  <PriceField
                    id="amm-dealer"
                    label="Dealer Price"
                    placeholder="—"
                    value={form.dealer_price}
                    onChange={v => set('dealer_price', v)}
                    error={dealerAboveRetail ? 'Above retail' : null}
                  />
                  <PriceField
                    id="amm-project"
                    label="Project Price"
                    placeholder="—"
                    value={form.project_price}
                    onChange={v => set('project_price', v)}
                  />
                </div>
              </div>

              {/* ════════════════════════════════════════════
                  ADVANCED DETAILS TOGGLE
              ════════════════════════════════════════════ */}
              <button
                type="button"
                onClick={() => setShowAdvanced(a => !a)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-dashed transition-all ${
                  showAdvanced
                    ? 'border-green-400 bg-green-50/50 text-green-700'
                    : 'border-slate-300 hover:border-green-400 hover:bg-green-50/30 text-slate-600'
                }`}
              >
                <span className="text-[13px] font-black">
                  {showAdvanced ? '▲' : '▼'} Advanced Details
                </span>
                <span className="text-[11px] text-slate-400">
                  {showAdvanced ? 'Collapse' : 'GST · SKU · Pack · Batch · Brand · More'}
                </span>
              </button>

              {/* ════════════════════════════════════════════
                  LAYER 2 — ADVANCED DETAILS
              ════════════════════════════════════════════ */}
              {showAdvanced && (
                <div className="space-y-3">

                  {/* GST & Tax */}
                  <AdvSection title="GST & Tax" icon="📋" defaultOpen>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="amm-hsn" className={LBL}>HSN / SAC Code</label>
                        <input
                          id="amm-hsn"
                          className={INP}
                          placeholder="e.g. 3210, 7318"
                          value={form.hsn_code}
                          onChange={e => set('hsn_code', e.target.value.replace(/\D/g, '').slice(0, 8))}
                          maxLength={8}
                          inputMode="numeric"
                          aria-label="HSN or SAC code"
                        />
                        {catIntel?.hsn && form.hsn_code === catIntel.hsn && (
                          <p className="text-[10px] text-green-600 mt-1">✓ Suggested from category</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="amm-gst" className={LBL}>GST Rate</label>
                        <select
                          id="amm-gst"
                          className={SEL}
                          value={form.gst_rate}
                          onChange={e => set('gst_rate', parseInt(e.target.value, 10))}
                        >
                          {GST_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {form.price && form.gst_rate > 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-[12px]">
                        <span className="text-slate-500">GST-inclusive customer price</span>
                        <span className="font-bold text-green-700">
                          ₹{parseFloat(form.price || 0).toFixed(2)} + {form.gst_rate}% = <strong>₹{(parseFloat(form.price || 0) * (1 + form.gst_rate / 100)).toFixed(2)}</strong>
                        </span>
                      </div>
                    )}
                  </AdvSection>

                  {/* Tracking & Identifiers */}
                  <AdvSection title="Tracking & Identifiers" icon="🔖" defaultOpen>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label htmlFor="amm-sku" className={LBL}>SKU</label>
                        <input
                          id="amm-sku"
                          className={`${INP} font-mono tracking-wider`}
                          placeholder="Auto-generated or custom"
                          value={form.sku}
                          onChange={e => set('sku', e.target.value)}
                          aria-label="Stock-keeping unit code"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => set('sku', generateSKU(form.category, products.length))}
                        className="h-11 px-4 rounded-xl border-2 border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex-shrink-0 transition-colors whitespace-nowrap"
                        title="Auto-generate SKU from category"
                      >⚡ Generate</button>
                    </div>

                    <div className="flex items-center gap-3 py-1">
                      <input
                        id="amm-batch"
                        type="checkbox"
                        className="w-4 h-4 accent-green-600 rounded"
                        checked={!!form.batch_tracking_enabled}
                        onChange={e => set('batch_tracking_enabled', e.target.checked)}
                      />
                      <label htmlFor="amm-batch" className="text-[13px] font-semibold text-slate-700 select-none cursor-pointer">
                        Enable Batch / Lot Tracking
                      </label>
                    </div>

                    {form.batch_tracking_enabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 pl-7 border-l-2 border-indigo-200">
                        <div>
                          <label htmlFor="amm-batchno" className={LBL}>Batch / Lot Number</label>
                          <input id="amm-batchno" className={INP} placeholder="e.g. BT-2024-01" value={metadata.batch_number || ''} onChange={e => setMeta('batch_number', e.target.value)} />
                        </div>
                        <div>
                          <label htmlFor="amm-mfgdate" className={LBL}>Mfg. Date</label>
                          <input id="amm-mfgdate" className={INP} type="date" value={metadata.mfg_date || ''} onChange={e => setMeta('mfg_date', e.target.value)} />
                        </div>
                        <div>
                          <label htmlFor="amm-expdate" className={LBL}>Expiry Date</label>
                          <input id="amm-expdate" className={INP} type="date" value={metadata.expiry_date || ''} onChange={e => setMeta('expiry_date', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </AdvSection>

                  {/* Inventory Details */}
                  <AdvSection title="Inventory Details" icon="📦">
                    {/* Low Stock Alert — phrased conversationally */}
                    <div>
                      <label className={LBL}>Low Stock Alert</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] text-slate-600 whitespace-nowrap">Notify me when stock falls below</span>
                        <input
                          className={`${INP_SM} w-20 text-center`}
                          type="number"
                          min="0"
                          value={form.low_stock_threshold}
                          onChange={e => set('low_stock_threshold', e.target.value)}
                          inputMode="numeric"
                          aria-label="Low stock threshold"
                        />
                        <span className="text-[13px] text-slate-600">{form.unit || 'pcs'}</span>
                      </div>
                    </div>

                    {/* Pack Config */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="amm-packsize" className={LBL}>Pack Size</label>
                        <input id="amm-packsize" className={INP} type="number" step="0.01" min="0" placeholder="e.g. 12" value={form.pack_size} onChange={e => set('pack_size', e.target.value)} inputMode="decimal" />
                        <p className="text-[10px] text-slate-400 mt-1">Units per pack/box</p>
                      </div>
                      <div>
                        <label htmlFor="amm-packunit" className={LBL}>Pack Unit</label>
                        <SearchableDropdown
                          id="amm-packunit"
                          options={PACK_UNITS}
                          value={form.pack_unit}
                          onChange={val => set('pack_unit', val)}
                          placeholder="e.g. Box, Carton"
                        />
                      </div>
                    </div>

                    {/* Loose */}
                    <div className="flex items-center gap-3 py-1">
                      <input
                        id="amm-loose"
                        type="checkbox"
                        className="w-4 h-4 accent-green-600"
                        checked={!!form.sold_in_loose}
                        onChange={e => set('sold_in_loose', e.target.checked)}
                      />
                      <label htmlFor="amm-loose" className="text-[13px] font-semibold text-slate-700 select-none cursor-pointer">
                        Sold in Loose Quantity
                      </label>
                    </div>

                    {form.sold_in_loose && (
                      <div className="grid grid-cols-2 gap-3 pt-1 pl-7 border-l-2 border-slate-200">
                        <div>
                          <label htmlFor="amm-looseunit" className={LBL}>Loose Unit</label>
                          <SearchableDropdown
                            id="amm-looseunit"
                            options={LOOSE_UNITS}
                            value={form.loose_unit}
                            onChange={val => set('loose_unit', val)}
                            placeholder="e.g. Metre, Piece"
                          />
                        </div>
                        <div>
                          <label htmlFor="amm-looseprice" className={LBL}>Loose Price</label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[13px]">₹</span>
                            <input id="amm-looseprice" className={`${INP} pl-8`} type="number" step="0.01" placeholder="Per loose unit" value={form.loose_price} onChange={e => set('loose_price', e.target.value)} inputMode="decimal" />
                          </div>
                        </div>
                      </div>
                    )}
                  </AdvSection>

                  {/* Product Details — brand, spec, description */}
                  <AdvSection title="Product Details" icon="🏷️">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="amm-brand" className={LBL}>Brand</label>
                        <input
                          id="amm-brand"
                          className={INP}
                          placeholder="e.g. Tata, Asian Paints, Havells"
                          value={metadata.brand || ''}
                          onChange={e => setMeta('brand', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="amm-material" className={LBL}>Material Type</label>
                        <SearchableDropdown
                          id="amm-material"
                          options={catIntel?.materialTypes?.length ? catIntel.materialTypes : ['Steel', 'Iron', 'PVC', 'Copper', 'Brass', 'GI', 'SS304', 'Aluminium', 'Cement', 'Nylon']}
                          value={metadata.material || ''}
                          onChange={val => setMeta('material', val)}
                          placeholder="e.g. PVC, MS, SS304"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="amm-spec" className={LBL}>Size / Specification</label>
                      <input
                        id="amm-spec"
                        className={INP}
                        placeholder="e.g. 1 inch, 4mm, 10ft, 500ml"
                        value={metadata.size_spec || ''}
                        onChange={e => setMeta('size_spec', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="amm-desc" className={LBL}>Description / Notes</label>
                      <textarea
                        id="amm-desc"
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all resize-none"
                        rows={3}
                        placeholder="Optional — specifications, notes, usage instructions"
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                      />
                    </div>
                  </AdvSection>

                  {/* Industry-specific dynamic attribute sections from config */}
                  {attrSections
                    .filter(section => !section.visibleWhenCategory || section.visibleWhenCategory === form.category)
                    .filter(section => !['Item Details'].includes(section.title)) // skip if already rendered above
                    .map(section => (
                      <DynamicFormSection
                        key={section.title}
                        section={section}
                        values={metadata}
                        onChange={setMeta}
                        errors={metaErrors}
                      />
                    ))}

                </div>
              )}
            </div>
          </div>

          {/* ── FOOTER (sticky) ── */}
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 sm:px-7 py-4">
            {!isOnline && (
              <p className="text-[11px] text-amber-700 font-semibold mb-2.5">
                📶 Offline — save is disabled until connection returns.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                id="amm-btn-save"
                type="button"
                disabled={saving || !isOnline}
                onClick={() => handleSave('save')}
                className="flex-1 py-3.5 rounded-2xl text-[14px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><span className="animate-spin">⏳</span> Saving…</>
                ) : (
                  <>{editProduct ? '✓ Update Material' : '+ Save Material'}</>
                )}
                <kbd className="hidden sm:inline text-[9px] font-mono opacity-50 bg-white/20 px-1 py-0.5 rounded">Ctrl+↵</kbd>
              </button>

              {!editProduct && (
                <button
                  id="amm-btn-save-another"
                  type="button"
                  disabled={saving || !isOnline}
                  onClick={() => handleSave('save-another')}
                  className="flex-1 sm:flex-none sm:px-5 py-3.5 rounded-2xl border-2 border-green-600 text-[14px] font-black text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  + Save &amp; Add Another
                  <kbd className="hidden sm:inline text-[9px] font-mono opacity-50 border border-current px-1 py-0.5 rounded">Alt+S</kbd>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="py-3.5 sm:px-5 rounded-2xl border border-slate-200 text-[14px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner overlay */}
      {showScanner && (
        <CameraBarcodeScanner
          onDetected={code => {
            const nb = normalizeBarcode(code);
            set('barcode', nb);
            setLastScanned(nb);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
