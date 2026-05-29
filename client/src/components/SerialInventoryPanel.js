'use client';
import { useState, useEffect, useCallback } from 'react';
import { invApi, invFetch } from '../lib/inventoryBehavior';

const INP = 'h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

const STATUS_COLORS = {
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sold:     'bg-slate-100 text-slate-500 border-slate-200',
  returned: 'bg-amber-50 text-amber-700 border-amber-200',
  damaged:  'bg-rose-50 text-rose-700 border-rose-200',
};

/**
 * SerialInventoryPanel
 * Lists and manages per-unit serials / IMEI numbers.
 * Props:
 *   productId    – string product _id
 *   inv          – inventoryBehavior config
 *   onStockChange – () => void
 */
export default function SerialInventoryPanel({ productId, inv, onStockChange }) {
  const [serials,  setSerials]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [filter,   setFilter]   = useState('in_stock');

  const [showAdd,  setShowAdd]  = useState(false);
  const [bulk,     setBulk]     = useState('');
  const [saving,   setSaving]   = useState(false);

  const label = inv.serialLabel || 'Serial No.';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invFetch(invApi.getSerials(productId, filter === 'all' ? '' : filter));
      setSerials(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId, filter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setError(''); setSuccess('');
    const lines = bulk.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) { setError('Enter at least one serial number'); return; }
    setSaving(true);
    try {
      await invFetch(invApi.addSerials(productId, { serial_numbers: lines }));
      setBulk(''); setShowAdd(false);
      await load();
      onStockChange?.();
      setSuccess(`${lines.length} serial(s) added`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Remove serial ${s.serial_number}? Stock will decrease by 1.`)) return;
    try {
      await invFetch(invApi.deleteSerial(s._id));
      await load();
      onStockChange?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const counts = serials.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  const inStockCount = counts['in_stock'] || 0;

  const TABS = [
    { key: 'in_stock', label: `In Stock (${inStockCount})` },
    { key: 'sold',     label: 'Sold' },
    { key: 'returned', label: 'Returned' },
    { key: 'all',      label: 'All' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          {label}s — {inStockCount} in stock
        </p>
        <button
          onClick={() => { setShowAdd(v => !v); setError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-[12px] font-semibold hover:bg-green-700 transition-colors"
        >+ Add {label}s</button>
      </div>

      {error   && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700 font-medium">{error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-700 font-semibold">{success}</div>}

      {/* Add form */}
      {showAdd && (
        <div className="rounded-2xl border-2 border-green-200 bg-green-50/60 p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Add {label}s (one per line or comma-separated)</p>
          <textarea
            className={`${INP} h-24 py-2 resize-none font-mono`}
            placeholder={`e.g.\nIMEI12345678\nIMEI87654321`}
            value={bulk}
            onChange={e => setBulk(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 h-9 rounded-xl bg-green-600 text-white text-[13px] font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >{saving ? 'Adding…' : 'Add to Stock'}</button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 h-9 rounded-xl border-2 border-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition-colors"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
              filter === t.key ? 'bg-green-600 border-green-600 text-white' : 'border-slate-200 text-slate-500 bg-white hover:border-green-300'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Serial list */}
      {loading ? (
        <p className="text-center text-[12px] text-slate-400 py-4">Loading…</p>
      ) : serials.length === 0 ? (
        <p className="text-center text-[12px] text-slate-400 py-6">
          {filter === 'in_stock' ? `No ${label}s in stock. Add some above.` : `No ${label}s with this status.`}
        </p>
      ) : (
        <div className="space-y-1.5">
          {serials.map(s => (
            <div key={s._id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-mono font-semibold text-slate-800 truncate">{s.serial_number}</p>
                {s.imei_number && (
                  <p className="text-[11px] text-slate-400 font-mono">IMEI: {s.imei_number}</p>
                )}
                {s.color && <p className="text-[11px] text-slate-400">{[s.color, s.storage, s.ram].filter(Boolean).join(' · ')}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[s.status] || ''}`}>
                {s.status.replace('_', ' ')}
              </span>
              {s.status === 'in_stock' && (
                <button onClick={() => handleDelete(s)}
                  className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 text-[14px] transition-colors flex-shrink-0"
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
