'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmtNum  = (n) => Number(n || 0).toLocaleString('en-IN');

async function apiFetch(path, opts = {}) {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// ── Small components ──────────────────────────────────────────────────────────

function Badge({ children, color = 'slate' }) {
  const colors = {
    slate:  'bg-slate-100 text-slate-600',
    blue:   'bg-blue-50 text-blue-700 border border-blue-200',
    green:  'bg-green-50 text-green-700 border border-green-200',
    amber:  'bg-amber-50 text-amber-700 border border-amber-200',
    red:    'bg-red-50 text-red-700 border border-red-200',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold ${colors[color]}`}>{children}</span>;
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />;
}

// ── Warehouse Card ────────────────────────────────────────────────────────────

function WarehouseCard({ wh, onEdit, onViewStock }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-colors">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[16px] font-black text-slate-900 truncate">{wh.name}</p>
              {wh.code && <span className="font-mono text-[11px] text-slate-400 font-bold">[{wh.code}]</span>}
              {wh.is_default && <Badge color="blue">Default</Badge>}
            </div>
            {wh.address && <p className="text-[12px] text-slate-400 mt-0.5 truncate">{wh.address}</p>}
          </div>
          <button
            onClick={() => onEdit(wh)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[14px] transition-colors"
          >
            ✏️
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Products</p>
            <p className="text-[20px] font-black text-slate-900">{fmtNum(wh.product_count)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units</p>
            <p className="text-[20px] font-black text-slate-900">{fmtNum(wh.total_units)}</p>
          </div>
        </div>

        <button
          onClick={() => onViewStock(wh)}
          className="w-full h-9 rounded-xl bg-slate-900 text-white text-[13px] font-black hover:bg-slate-800 transition-colors"
        >
          View Stock
        </button>
      </div>
    </div>
  );
}

// ── Warehouse Form Modal ──────────────────────────────────────────────────────

function WarehouseModal({ warehouse, warehouses, onClose, onSaved }) {
  const isEdit = !!warehouse?._id;
  const [form, setForm]     = useState({ name: warehouse?.name || '', code: warehouse?.code || '', address: warehouse?.address || '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setErr('Warehouse name is required'); return; }
    setSaving(true); setErr('');
    try {
      const result = isEdit
        ? await apiFetch(`/api/warehouses/${warehouse._id}`, { method: 'PUT', body: JSON.stringify(form) })
        : await apiFetch('/api/warehouses', { method: 'POST', body: JSON.stringify(form) });
      onSaved(result, isEdit);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const deactivate = async () => {
    if (!confirm(`Remove warehouse "${warehouse.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await apiFetch(`/api/warehouses/${warehouse._id}`, { method: 'DELETE' });
      onSaved(null, true, true);
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const setDefault = async () => {
    setSaving(true); setErr('');
    try {
      const result = await apiFetch(`/api/warehouses/${warehouse._id}`, { method: 'PUT', body: JSON.stringify({ is_default: true }) });
      onSaved(result, true);
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-[17px] font-black text-slate-900">{isEdit ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 text-[14px]">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {err && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">{err}</div>}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Warehouse Name *</label>
            <input
              className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[15px] text-slate-900"
              placeholder="e.g. Main Godown, Branch Store"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Short Code</label>
              <input
                className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[15px] font-mono text-slate-900 uppercase"
                placeholder="WH1"
                maxLength={6}
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
              <input
                className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[15px] text-slate-900"
                placeholder="Address / area"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-slate-900 text-white font-black text-[14px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Spinner /> : (isEdit ? 'Save Changes' : 'Add Warehouse')}
          </button>

          {isEdit && !warehouse.is_default && (
            <div className="flex gap-2">
              <button
                onClick={setDefault}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-[13px] border border-blue-200 disabled:opacity-50"
              >
                Set as Default
              </button>
              <button
                onClick={deactivate}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-red-50 text-red-700 font-bold text-[13px] border border-red-200 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stock Sheet ───────────────────────────────────────────────────────────────

function StockSheet({ warehouse, onClose }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch(`/api/warehouses/${warehouse._id}/stock`)
      .then(setData)
      .catch(() => setData({ warehouse, products: [] }))
      .finally(() => setLoading(false));
  }, [warehouse._id]);

  const products = data?.products || [];
  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-100 shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 text-[16px] shrink-0">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] font-black text-slate-900 truncate">{warehouse.name}</h2>
          <p className="text-[12px] text-slate-500">{fmtNum(warehouse.product_count)} products · {fmtNum(warehouse.total_units)} units</p>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <input
          className="w-full h-10 px-4 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[32px] mb-2">📦</p>
            <p className="text-[14px] font-black text-slate-600">{search ? 'No matching products' : 'No stock here yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <div key={p._id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-900 truncate">{p.name}</p>
                  {p.sku && <p className="text-[11px] text-slate-400 font-mono">{p.sku}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[15px] font-black text-slate-900">{fmtNum(p.quantity)}</p>
                  <p className="text-[11px] text-slate-400">{p.unit || 'pcs'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transfer Sheet ────────────────────────────────────────────────────────────

function TransferSheet({ warehouses, onClose, onDone }) {
  const [step, setStep]         = useState('form'); // form | preview | done
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [notes, setNotes]       = useState('');
  const [items, setItems]       = useState([{ product_id: '', name: '', qty: 1, unit: 'pcs', available: 0 }]);
  const [stockCache, setStockCache] = useState({});
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [draftId, setDraftId]   = useState(null);

  const loadFromStock = useCallback(async (whId) => {
    if (!whId || stockCache[whId]) return;
    try {
      const data = await apiFetch(`/api/warehouses/${whId}/stock`);
      setStockCache((c) => ({ ...c, [whId]: data.products || [] }));
    } catch {}
  }, [stockCache]);

  useEffect(() => { if (from) loadFromStock(from); }, [from, loadFromStock]);

  const fromProducts = stockCache[from] || [];

  const setItem = (idx, field, val) => setItems((prev) => {
    const next = [...prev];
    next[idx] = { ...next[idx], [field]: val };
    if (field === 'product_id' && val) {
      const p = fromProducts.find((x) => x._id === val);
      if (p) next[idx] = { ...next[idx], name: p.name, unit: p.unit || 'pcs', available: p.quantity, qty: Math.min(next[idx].qty, p.quantity) };
    }
    return next;
  });

  const addItem = () => setItems((prev) => [...prev, { product_id: '', name: '', qty: 1, unit: 'pcs', available: 0 }]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    if (!from) return 'Select source warehouse';
    if (!to) return 'Select destination warehouse';
    if (from === to) return 'Source and destination cannot be the same';
    for (const item of items) {
      if (!item.product_id) return 'Select a product for each item';
      if (!item.qty || item.qty < 0.01) return 'Quantity must be positive';
      if (item.qty > item.available) return `Insufficient stock for "${item.name}"`;
    }
    return null;
  };

  const createDraft = async () => {
    const e = validate();
    if (e) { setErr(e); return; }
    setErr(''); setSaving(true);
    try {
      const payload = {
        from_warehouse: from,
        to_warehouse: to,
        notes,
        items: items.map((i) => ({ product: i.product_id, quantity: i.qty })),
      };
      const draft = await apiFetch('/api/warehouses/transfers', { method: 'POST', body: JSON.stringify(payload) });
      setDraftId(draft._id);
      setStep('preview');
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  const confirm = async () => {
    setSaving(true); setErr('');
    try {
      await apiFetch(`/api/warehouses/transfers/${draftId}/confirm`, { method: 'POST' });
      setStep('done');
    } catch (ex) { setErr(ex.message); setSaving(false); }
  };

  const fromWh = warehouses.find((w) => w._id === from);
  const toWh   = warehouses.find((w) => w._id === to);

  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6">
        <p className="text-[56px] mb-4">✅</p>
        <p className="text-[20px] font-black text-slate-900">Transfer Confirmed!</p>
        <p className="text-[13px] text-slate-500 mt-1 text-center">
          Stock moved from {fromWh?.name} → {toWh?.name}
        </p>
        <button
          onClick={() => { onDone(); onClose(); }}
          className="mt-8 h-12 px-8 rounded-2xl bg-slate-900 text-white font-black text-[14px]"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-100 shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 text-[16px] shrink-0">
          {step === 'preview' ? '←' : '✕'}
        </button>
        <h2 className="text-[17px] font-black text-slate-900">
          {step === 'form' ? 'New Stock Transfer' : 'Confirm Transfer'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-4 py-4 space-y-4">
        {err && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">{err}</div>}

        {step === 'form' ? (
          <>
            {/* From / To */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">From *</label>
                <select
                  className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[14px] text-slate-900 bg-white"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); setItems([{ product_id: '', name: '', qty: 1, unit: 'pcs', available: 0 }]); }}
                >
                  <option value="">Select</option>
                  {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">To *</label>
                <select
                  className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[14px] text-slate-900 bg-white"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                >
                  <option value="">Select</option>
                  {warehouses.filter((w) => w._id !== from).map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Items</p>
              {items.map((item, idx) => (
                <div key={idx} className="rounded-2xl border-2 border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      className="flex-1 h-10 px-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[13px] text-slate-900 bg-white"
                      value={item.product_id}
                      onChange={(e) => setItem(idx, 'product_id', e.target.value)}
                      disabled={!from}
                    >
                      <option value="">{from ? 'Select product…' : 'Select source first'}</option>
                      {fromProducts.map((p) => (
                        <option key={p._id} value={p._id}>{p.name} ({fmtNum(p.quantity)} {p.unit || 'pcs'})</option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-500 text-[13px] shrink-0">✕</button>
                    )}
                  </div>
                  {item.product_id && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          max={item.available}
                          step="any"
                          className="w-full h-9 px-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[14px] font-bold text-slate-900"
                          value={item.qty}
                          onChange={(e) => setItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-4">{item.unit} / max {fmtNum(item.available)}</div>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addItem}
                disabled={!from}
                className="w-full h-9 rounded-xl border-2 border-dashed border-slate-300 text-[13px] font-bold text-slate-500 hover:border-slate-400 disabled:opacity-40"
              >
                + Add another item
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
              <input
                className="w-full h-10 px-3.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-[14px] text-slate-900"
                placeholder="Reason for transfer…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        ) : (
          /* Preview step */
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3 text-[14px] font-bold text-slate-800">
                <span>{fromWh?.name}</span>
                <span className="text-slate-400">→</span>
                <span>{toWh?.name}</span>
              </div>
              {notes && <p className="text-[12px] text-slate-500">"{notes}"</p>}
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[14px] font-bold text-slate-800">{item.name}</p>
                  <p className="text-[14px] font-black text-slate-900">{fmtNum(item.qty)} {item.unit}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[12px] font-bold text-amber-800">⚠️ This action will immediately move stock between warehouses and cannot be undone.</p>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-4">
        {step === 'form' ? (
          <button
            onClick={createDraft}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black text-[14px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Spinner /> : 'Review Transfer →'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setStep('form')}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-700 font-black text-[14px] disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={confirm}
              disabled={saving}
              className="flex-[2] h-12 rounded-2xl bg-green-600 text-white font-black text-[14px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Spinner /> : '✓ Confirm Transfer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transfer History ──────────────────────────────────────────────────────────

const STATUS_COLORS = { draft: 'amber', confirmed: 'green', cancelled: 'red' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function TransferRow({ t, warehouses, onCancel }) {
  const [open, setOpen] = useState(false);
  const fromName = t.from_warehouse?.name || warehouses.find((w) => w._id === t.from_warehouse)?.name || '—';
  const toName   = t.to_warehouse?.name   || warehouses.find((w) => w._id === t.to_warehouse)?.name   || '—';

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button className="w-full text-left px-4 py-3" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-bold text-slate-900">{fromName} → {toName}</p>
            <p className="text-[11px] text-slate-400 font-mono">{t.transfer_number} · {fmtDate(t.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge color={STATUS_COLORS[t.status] || 'slate'}>{t.status}</Badge>
            <span className="text-slate-300 text-[12px]">{open ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {t.items?.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-[13px]">
              <span className="text-slate-600">{item.product_name}</span>
              <span className="font-bold text-slate-800">{fmtNum(item.quantity)} {item.unit}</span>
            </div>
          ))}
          {t.notes && <p className="text-[12px] text-slate-400 italic">"{t.notes}"</p>}
          {t.status === 'draft' && (
            <button
              onClick={() => onCancel(t._id)}
              className="mt-1 h-8 px-3 rounded-lg bg-red-50 text-red-700 text-[12px] font-bold border border-red-200"
            >
              Cancel Transfer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [transfers, setTransfers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('warehouses'); // warehouses | transfers
  const [editTarget, setEditTarget] = useState(null);   // null | {} (new) | {_id, ...} (edit)
  const [stockTarget, setStockTarget] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [loadingTransfers, setLoadingTransfers] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try { setWarehouses(await apiFetch('/api/warehouses')); }
    catch {}
    finally { setLoading(false); }
  }, []);

  const loadTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try { const d = await apiFetch('/api/warehouses/transfers'); setTransfers(d.transfers || []); }
    catch {}
    finally { setLoadingTransfers(false); }
  }, []);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);
  useEffect(() => { if (tab === 'transfers') loadTransfers(); }, [tab, loadTransfers]);

  const handleSaved = (result, isEdit, removed = false) => {
    if (removed) {
      setWarehouses((prev) => prev.filter((w) => w._id !== editTarget._id));
    } else if (isEdit) {
      setWarehouses((prev) => prev.map((w) => (w._id === result._id ? { ...w, ...result } : w)));
    } else {
      setWarehouses((prev) => [...prev, { ...result, product_count: 0, total_units: 0 }]);
    }
    setEditTarget(null);
  };

  const cancelTransfer = async (id) => {
    if (!confirm('Cancel this transfer?')) return;
    try {
      await apiFetch(`/api/warehouses/transfers/${id}/cancel`, { method: 'POST' });
      setTransfers((prev) => prev.map((t) => (t._id === id ? { ...t, status: 'cancelled' } : t)));
    } catch (e) { alert(e.message); }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-black text-slate-900">Warehouses</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Multi-godown stock management</p>
          </div>
          <button
            onClick={() => setEditTarget({})}
            className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-black hover:bg-slate-800 transition-colors"
          >
            + Add
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-5">
          {['warehouses', 'transfers'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-xl text-[13px] font-black transition-colors capitalize ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'warehouses' ? '🏭 Warehouses' : '🔄 Transfers'}
            </button>
          ))}
        </div>

        {/* Warehouses tab */}
        {tab === 'warehouses' && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(2)].map((_, i) => <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : warehouses.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[48px] mb-3">🏭</p>
                <p className="text-[16px] font-black text-slate-700">No warehouses yet</p>
                <p className="text-[13px] text-slate-400 mt-1 mb-6">Add your first godown or store location</p>
                <button
                  onClick={() => setEditTarget({})}
                  className="h-11 px-6 rounded-2xl bg-slate-900 text-white font-black text-[14px]"
                >
                  + Add Warehouse
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {warehouses.map((wh) => (
                    <WarehouseCard
                      key={wh._id}
                      wh={wh}
                      onEdit={setEditTarget}
                      onViewStock={setStockTarget}
                    />
                  ))}
                </div>

                <div className="mt-5">
                  <button
                    onClick={() => setShowTransfer(true)}
                    className="w-full h-12 rounded-2xl border-2 border-slate-200 text-slate-700 font-black text-[14px] hover:border-slate-300 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    🔄 Move Stock Between Warehouses
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Transfers tab */}
        {tab === 'transfers' && (
          <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-[13px] font-bold text-slate-600">Transfer History</p>
              {warehouses.length >= 2 && (
                <button
                  onClick={() => setShowTransfer(true)}
                  className="h-8 px-3 rounded-xl bg-slate-900 text-white text-[12px] font-bold"
                >
                  + New Transfer
                </button>
              )}
            </div>

            {loadingTransfers ? (
              <div className="flex items-center justify-center h-32"><Spinner /></div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[28px] mb-2">🔄</p>
                <p className="text-[13px] font-bold text-slate-500">No transfers yet</p>
              </div>
            ) : (
              transfers.map((t) => (
                <TransferRow key={t._id} t={t} warehouses={warehouses} onCancel={cancelTransfer} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {editTarget !== null && (
        <WarehouseModal
          warehouse={editTarget._id ? editTarget : null}
          warehouses={warehouses}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {stockTarget && (
        <StockSheet
          warehouse={stockTarget}
          onClose={() => setStockTarget(null)}
        />
      )}

      {showTransfer && (
        <TransferSheet
          warehouses={warehouses}
          onClose={() => setShowTransfer(false)}
          onDone={() => { loadWarehouses(); if (tab === 'transfers') loadTransfers(); }}
        />
      )}
    </Layout>
  );
}
