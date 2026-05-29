'use client';
import { useState, useEffect, useCallback } from 'react';
import { invApi, invFetch, expiryStatus, formatExpiryDate } from '../lib/inventoryBehavior';

const INP = 'h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

function BatchBadge({ batch, alertDays = 30 }) {
  const exp = expiryStatus(batch.expiry_date, alertDays);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${exp.cls}`}>
      {exp.label || 'No Expiry'}
    </span>
  );
}

const emptyForm = { batch_number: '', expiry_date: '', manufacture_date: '', quantity: '', mrp: '', cost_price: '', manufacturer: '', notes: '' };

/**
 * BatchInventoryPanel
 * Shows list of batches for a product, with add/edit/delete.
 * Mounted in product/page.js when inventoryBehavior.trackBatches = true.
 *
 * Props:
 *   productId    – string product _id
 *   inv          – inventoryBehavior config object
 *   onStockChange – () => void — called after batch mutation to refresh parent stock
 */
export default function BatchInventoryPanel({ productId, inv, onStockChange }) {
  const [batches,   setBatches]  = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [form,      setForm]     = useState(emptyForm);
  const [editId,    setEditId]   = useState(null);
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState('');
  const [showForm,  setShowForm] = useState(false);

  const alertDays = inv.expiryAlertDays ?? 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invFetch(invApi.getBatches(productId));
      setBatches(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = (b) => {
    setForm({
      batch_number:    b.batch_number || '',
      expiry_date:     b.expiry_date ? b.expiry_date.slice(0, 10) : '',
      manufacture_date:b.manufacture_date ? b.manufacture_date.slice(0, 10) : '',
      quantity:        String(b.quantity ?? ''),
      mrp:             String(b.mrp ?? ''),
      cost_price:      String(b.cost_price ?? ''),
      manufacturer:    b.manufacturer || '',
      notes:           b.notes || '',
    });
    setEditId(b._id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    if (!form.batch_number.trim()) { setError('Batch number required'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('Quantity must be > 0'); return; }
    setSaving(true);
    try {
      if (editId) {
        await invFetch(invApi.updateBatch(editId, { ...form, quantity: Number(form.quantity) }));
      } else {
        await invFetch(invApi.addBatch(productId, { ...form, quantity: Number(form.quantity) }));
      }
      setShowForm(false);
      await load();
      onStockChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    if (!confirm(`Delete batch ${b.batch_number}? Stock will be reduced by ${b.quantity}.`)) return;
    try {
      await invFetch(invApi.deleteBatch(b._id));
      await load();
      onStockChange?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const field = (k, label, type = 'text', extra = {}) => (
    <div key={k}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <input
        className={INP}
        type={type}
        value={form[k]}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        {...extra}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          {inv.batchLabel || 'Batches'} ({batches.length})
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-[12px] font-semibold hover:bg-green-700 transition-colors"
        >
          + Add Batch
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-2xl border-2 border-green-200 bg-green-50/60 p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-700">
            {editId ? 'Edit Batch' : 'Add New Batch'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {field('batch_number', 'Batch Number *', 'text',    { placeholder: 'e.g. BT2024001' })}
            {field('expiry_date',  inv.expiryLabel || 'Expiry Date', 'date')}
            {field('manufacture_date', 'Manufacture Date', 'date')}
            {field('quantity',     'Quantity *',   'number',  { placeholder: '0', min: '0' })}
            {field('mrp',          'MRP (₹)',      'number',  { placeholder: '0.00', step: '0.01' })}
            {field('cost_price',   'Cost Price (₹)','number', { placeholder: '0.00', step: '0.01' })}
          </div>
          {field('manufacturer', 'Manufacturer',  'text', { placeholder: 'Company name' })}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
            <textarea
              className={`${INP} h-16 py-2 resize-none`}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-green-600 text-white text-[13px] font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : (editId ? 'Update Batch' : 'Add Batch')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 h-10 rounded-xl border-2 border-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Batch list */}
      {loading ? (
        <p className="text-center text-[12px] text-slate-400 py-4">Loading batches…</p>
      ) : batches.length === 0 ? (
        <p className="text-center text-[12px] text-slate-400 py-6">
          No batches yet. Add your first batch to start tracking inventory by batch.
        </p>
      ) : (
        <div className="space-y-2">
          {batches.map(b => {
            const exp = expiryStatus(b.expiry_date, alertDays);
            return (
              <div
                key={b._id}
                className={`rounded-xl border-2 p-3 ${
                  exp.status === 'expired'  ? 'border-rose-200 bg-rose-50/40' :
                  exp.status === 'expiring' ? 'border-amber-200 bg-amber-50/40' :
                  'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-slate-900">{b.batch_number}</span>
                      <BatchBadge batch={b} alertDays={alertDays} />
                      {b.is_depleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Depleted
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <span className="text-[12px] text-slate-600">
                        <span className="text-slate-400">Qty:</span> <span className="font-semibold">{b.quantity}</span>
                      </span>
                      {b.mrp != null && (
                        <span className="text-[12px] text-slate-600">
                          <span className="text-slate-400">MRP:</span> <span className="font-semibold">₹{b.mrp}</span>
                        </span>
                      )}
                      {b.cost_price > 0 && (
                        <span className="text-[12px] text-slate-600">
                          <span className="text-slate-400">Cost:</span> <span className="font-semibold">₹{b.cost_price}</span>
                        </span>
                      )}
                      {b.manufacturer && (
                        <span className="text-[12px] text-slate-500">{b.manufacturer}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(b)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-green-400 hover:text-green-700 text-[13px] transition-colors"
                    >✏</button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-rose-400 hover:text-rose-600 text-[13px] transition-colors"
                    >✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
