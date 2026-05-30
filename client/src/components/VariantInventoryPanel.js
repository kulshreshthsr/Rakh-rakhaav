'use client';
import { useState, useEffect, useCallback } from 'react';
import { invApi, invFetch } from '../lib/inventoryBehavior';

/**
 * VariantInventoryPanel
 * Shows a matrix of size × color variants with per-variant stock editing.
 * Supports saving a full variant matrix in one call.
 *
 * Props:
 *   productId     – string product _id
 *   basePrice     – number (product's default selling price)
 *   inv           – inventoryBehavior config object
 *   onStockChange – () => void — called after variant save
 */
export default function VariantInventoryPanel({ productId, basePrice = 0, inv, onStockChange }) {
  const [variants,  setVariants]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  // Matrix building state
  const [selSizes,  setSelSizes]  = useState([]);
  const [selColors, setSelColors] = useState([]);
  const [showMatrix,setShowMatrix]= useState(false);

  const sizeOpts  = inv.sizeOptions  || [];
  const colorOpts = inv.colorOptions || [];
  const dims      = inv.variantDimensions || ['size', 'color'];
  const hasSize   = dims.includes('size');
  const hasColor  = dims.includes('color');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invFetch(invApi.getVariants(productId));
      setVariants(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  // Build editable matrix cells from loaded variants
  const [cells, setCells] = useState({});  // key: `${size}__${color}` → { qty, price, barcode, _id }

  useEffect(() => {
    const map = {};
    for (const v of variants) {
      const key = `${v.size || ''}__${v.color || ''}`;
      map[key] = { qty: v.quantity, price: v.price ?? '', barcode: v.barcode || '', _id: v._id };
    }
    setCells(map);
  }, [variants]);

  const cellKey = (s, c) => `${s}__${c}`;
  const getCell = (s, c) => cells[cellKey(s, c)] || { qty: 0, price: '', barcode: '' };
  const setCell = (s, c, field, val) => {
    const k = cellKey(s, c);
    setCells(prev => ({ ...prev, [k]: { ...getCell(s, c), [k]: prev[k], [field]: val } }));
  };

  // Expanded: list of size × color combos to show
  const rows = hasSize  ? (selSizes.length  ? selSizes  : (sizeOpts.length  ? sizeOpts  : ['Default'])) : [''];
  const cols = hasColor ? (selColors.length ? selColors : (colorOpts.length ? colorOpts : [''])) : [''];
  const useSingleAxis = !hasSize || !hasColor;

  const handleSave = async () => {
    setError(''); setSuccess('');
    const payload = [];
    for (const row of rows) {
      for (const col of cols) {
        const k = cellKey(row, col);
        const c = cells[k] || {};
        const qty = Number(c.qty) || 0;
        if (qty > 0 || (c._id)) {
          payload.push({
            _id:     c._id,
            size:    hasSize  ? row : undefined,
            color:   hasColor ? col : undefined,
            quantity: qty,
            price:   c.price !== '' ? Number(c.price) : undefined,
            barcode: c.barcode || undefined,
          });
        }
      }
    }
    if (!payload.length) { setError('At least one variant with quantity > 0 required'); return; }
    setSaving(true);
    try {
      await invFetch(invApi.saveVariants(productId, payload));
      await load();
      onStockChange?.();
      setSuccess('Variants saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalStock = variants.reduce((s, v) => s + (v.quantity || 0), 0);

  const printBarcodeLabels = () => {
    const rows = variants.filter(v => v.barcode);
    if (!rows.length) { alert('No barcodes assigned yet. Add barcodes and save first.'); return; }
    const labelHtml = rows.map(v => `
      <div style="display:inline-block;border:1px solid #ccc;border-radius:6px;padding:10px 14px;margin:8px;text-align:center;font-family:monospace;min-width:130px;">
        <div style="font-size:14px;font-weight:bold;letter-spacing:2px;">${v.barcode}</div>
        <div style="font-size:11px;color:#555;margin-top:4px;">${[v.size, v.color].filter(Boolean).join(' / ')}</div>
      </div>`).join('');
    const win = window.open('', '_blank', 'width=700,height=500');
    win.document.write(`<html><head><title>Barcode Labels</title><style>body{margin:16px;font-family:sans-serif}@media print{button{display:none}}</style></head><body><h3 style="margin-bottom:12px">Barcode Labels</h3><div>${labelHtml}</div><br><button onclick="window.print()">Print</button></body></html>`);
    win.document.close();
  };

  const generateBarcode = (row, col, index) => {
    const pid = productId ? productId.slice(-4) : 'xxxx';
    const code = `${pid}-${String(index).padStart(2, '0')}-${Date.now().toString(36).slice(-4)}`;
    setCell(row, col, 'barcode', code);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          {inv.variantLabel || 'Variants'} — {variants.length} combinations, {totalStock} total
        </p>
        <div className="flex gap-2">
          {variants.some(v => v.barcode) && (
            <button
              onClick={printBarcodeLabels}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-200 text-slate-600 text-[12px] font-semibold hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >🏷️ Print Labels</button>
          )}
          {sizeOpts.length > 0 && (
            <button
              onClick={() => setShowMatrix(m => !m)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-200 text-slate-600 text-[12px] font-semibold hover:border-green-400 hover:text-green-700 transition-colors"
            >
              {showMatrix ? 'Hide Matrix' : 'Size Matrix'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700 font-medium">{error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-700 font-semibold">{success}</div>}

      {/* Size/Color selector (optional pre-filter) */}
      {showMatrix && sizeOpts.length > 0 && (
        <div className="rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-3 space-y-2">
          {hasSize && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sizes to show</p>
              <div className="flex flex-wrap gap-1.5">
                {sizeOpts.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      selSizes.includes(s) || selSizes.length === 0
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-slate-200 text-slate-500 bg-white'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variant grid / table */}
      {loading ? (
        <p className="text-center text-[12px] text-slate-400 py-4">Loading variants…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b-2 border-slate-100">
                {hasSize  && <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</th>}
                {hasColor && <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</th>}
                <th className="text-center py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Stock</th>
                <th className="text-center py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">Price (₹)</th>
                <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-32">Barcode</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row, rIdx) =>
                cols.map((col, cIdx) => {
                  const k   = cellKey(row, col);
                  const c   = cells[k] || {};
                  const qty = c.qty ?? 0;
                  const variantIdx = rIdx * cols.length + cIdx;
                  return (
                    <tr key={k} className="border-b border-slate-50 hover:bg-slate-50/50">
                      {hasSize  && <td className="py-1.5 pr-3 font-semibold text-slate-700">{row || '—'}</td>}
                      {hasColor && <td className="py-1.5 pr-3 text-slate-600">{col || '—'}</td>}
                      <td className="py-1.5 pr-3">
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={e => setCell(row, col, 'qty', e.target.value)}
                          className={`h-8 w-full rounded-lg border-2 px-2 text-center text-[13px] font-semibold transition-all
                            ${Number(qty) > 0
                              ? 'border-green-200 bg-green-50 text-green-800'
                              : 'border-slate-200 bg-white text-slate-400'}
                            focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600`}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={String(basePrice)}
                          value={c.price ?? ''}
                          onChange={e => setCell(row, col, 'price', e.target.value)}
                          className="h-8 w-full rounded-lg border-2 border-slate-200 bg-white px-2 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
                        />
                      </td>
                      <td className="py-1.5">
                        {c.barcode ? (
                          <input
                            type="text"
                            value={c.barcode}
                            onChange={e => setCell(row, col, 'barcode', e.target.value)}
                            className="h-8 w-full rounded-lg border-2 border-indigo-200 bg-indigo-50 px-2 text-[12px] text-indigo-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => generateBarcode(row, col, variantIdx)}
                            className="h-8 w-full rounded-lg border-2 border-dashed border-slate-300 text-[11px] font-semibold text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                          >+ Generate</button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add custom variant row */}
      <details className="rounded-xl border border-slate-200">
        <summary className="px-3 py-2 text-[12px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700">
          + Add custom variant
        </summary>
        <AddCustomVariant productId={productId} onAdded={() => { load(); onStockChange?.(); }} inv={inv} />
      </details>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-11 rounded-xl bg-green-600 text-white text-[14px] font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save All Variants'}
      </button>
    </div>
  );
}

function AddCustomVariant({ productId, inv, onAdded }) {
  const [f, setF] = useState({ size: '', color: '', quantity: '', price: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const dims = inv.variantDimensions || ['size', 'color'];

  const handleAdd = async () => {
    setErr('');
    if (!f.quantity || Number(f.quantity) < 0) { setErr('Quantity required'); return; }
    setSaving(true);
    try {
      await invFetch(invApi.saveVariants(productId, [{
        size:  dims.includes('size')  ? f.size  : undefined,
        color: dims.includes('color') ? f.color : undefined,
        quantity: Number(f.quantity),
        price:    f.price ? Number(f.price) : undefined,
      }]));
      setF({ size: '', color: '', quantity: '', price: '' });
      onAdded();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="px-3 pb-3 space-y-2">
      {err && <p className="text-[11px] text-rose-600">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        {dims.includes('size')  && (
          <input className="h-9 rounded-xl border-2 border-slate-200 px-3 text-[13px] text-slate-900 focus:outline-none focus:border-green-600" placeholder="Size" value={f.size} onChange={e => setF(p => ({ ...p, size: e.target.value }))} />
        )}
        {dims.includes('color') && (
          <input className="h-9 rounded-xl border-2 border-slate-200 px-3 text-[13px] text-slate-900 focus:outline-none focus:border-green-600" placeholder="Color" value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} />
        )}
        <input type="number" className="h-9 rounded-xl border-2 border-slate-200 px-3 text-[13px] text-slate-900 focus:outline-none focus:border-green-600" placeholder="Qty" min="0" value={f.quantity} onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} />
        <input type="number" className="h-9 rounded-xl border-2 border-slate-200 px-3 text-[13px] text-slate-900 focus:outline-none focus:border-green-600" placeholder="Price (₹)" min="0" step="0.01" value={f.price} onChange={e => setF(p => ({ ...p, price: e.target.value }))} />
      </div>
      <button onClick={handleAdd} disabled={saving} className="w-full h-9 rounded-xl bg-green-600 text-white text-[13px] font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
        {saving ? 'Adding…' : 'Add Variant'}
      </button>
    </div>
  );
}
