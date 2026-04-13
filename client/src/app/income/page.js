'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

/* ── Constants & helpers (UNCHANGED) ── */
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const getTodayInputValue = () => new Date().toISOString().slice(0, 10);
const CATEGORY_OPTIONS = ['other_income', 'interest', 'commission', 'rent', 'discount'];
const MODE_OPTIONS     = ['cash', 'upi', 'bank'];
const getEmptyForm = () => ({
  source: '', category: 'other_income', amount: '',
  payment_mode: 'bank', date: getTodayInputValue(), reference_id: '', note: '',
});

const CAT_EMOJI  = { other_income: '💰', interest: '🏦', commission: '🤝', rent: '🏠', discount: '🏷️' };
const MODE_COLOR = { cash: 'bg-amber-100 text-amber-800', upi: 'bg-cyan-100 text-cyan-800', bank: 'bg-blue-100 text-blue-800' };
const INP = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all';

export default function IncomePage() {
  const router = useRouter();
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingId,  setEditingId]  = useState('');
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [search,         setSearch]        = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modeFilter,     setModeFilter]     = useState('all');
  const [form, setForm] = useState(getEmptyForm);

  /* ── All logic (100% UNCHANGED) ── */
  const fetchIncome = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const res = await fetch(apiUrl('/api/income'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch { setError('Income entries load nahi ho paayi.'); }
    finally   { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchIncome(); }, [fetchIncome]);

  useEffect(() => {
    if (!success) return undefined;
    const id = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(id);
  }, [success]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter !== 'all' && e.category     !== categoryFilter) return false;
      if (modeFilter     !== 'all' && e.payment_mode !== modeFilter)     return false;
      if (!q) return true;
      return [e.source, e.category, e.note, e.reference_id].join(' ').toLowerCase().includes(q);
    });
  }, [categoryFilter, entries, modeFilter, search]);

  const totalIncome = filteredEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const cashIncome  = filteredEntries.filter((e) => e.payment_mode === 'cash').reduce((s, e) => s + Number(e.amount || 0), 0);
  const bankIncome  = filteredEntries.filter((e) => ['bank','upi'].includes(e.payment_mode)).reduce((s, e) => s + Number(e.amount || 0), 0);

  const resetForm = () => { setEditingId(''); setForm(getEmptyForm()); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source.trim())                        { setError('Income source required hai.'); return; }
    if (!form.amount || Number(form.amount) <= 0)   { setError('Valid amount enter karo.');    return; }
    try {
      setSaving(true); setError('');
      const endpoint = editingId ? `/api/income/${editingId}` : '/api/income';
      const res = await fetch(apiUrl(endpoint), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ source: form.source, category: form.category, amount: Number(form.amount), payment_mode: form.payment_mode, date: form.date, reference_id: form.reference_id, note: form.note }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Income save nahi hui.'); return; }
      if (editingId) { setEntries((c) => c.map((en) => (en._id === editingId ? data : en))); setSuccess('Income updated successfully.'); }
      else           { setEntries((c) => [data, ...c]); setSuccess('Income saved successfully.'); }
      resetForm();
    } catch { setError('Income save nahi hui.'); }
    finally   { setSaving(false); }
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setForm({ source: entry.source || '', category: entry.category || 'other_income', amount: String(entry.amount || ''), payment_mode: entry.payment_mode || 'bank', date: new Date(entry.date || entry.createdAt).toISOString().slice(0, 10), reference_id: entry.reference_id || '', note: entry.note || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Is income entry ko delete karna hai?')) return;
    try {
      setDeletingId(id);
      const res = await fetch(apiUrl(`/api/income/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Income delete nahi hui.'); return; }
      setEntries((c) => c.filter((en) => en._id !== id));
      if (editingId === id) resetForm();
      setSuccess('Income deleted.');
    } catch { setError('Income delete nahi hui.'); }
    finally   { setDeletingId(''); }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-emerald-50/40 to-cyan-50/30 border border-slate-200 p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              💰 Other Income
            </span>
            <h1 className="mt-2.5 text-[22px] font-black text-slate-900 leading-tight">Income / आमदनी</h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Interest, commission, rent और extra receipts को अलग register में रखो।
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[{ href: '/expenses', label: '💸 Expenses' }, { href: '/bank-entries', label: '🏦 Bank' }, { href: '/reports', label: '📊 Reports' }].map((l) => (
                <Link key={l.href} href={l.href}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:-translate-y-px transition-all shadow-sm"
                >{l.label}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'कुल आमदनी',  value: `₹${fmtShort(totalIncome)}`, sub: `${filteredEntries.length} entries`, bg: 'bg-emerald-50 border-emerald-200', vc: 'text-emerald-700' },
            { label: 'Cash Income', value: `₹${fmtShort(cashIncome)}`,  sub: 'cash inflow',                       bg: 'bg-cyan-50 border-cyan-200',       vc: 'text-cyan-700'   },
            { label: 'Bank / UPI',  value: `₹${fmtShort(bankIncome)}`,  sub: 'digital inflow',                    bg: 'bg-blue-50 border-blue-200',        vc: 'text-blue-700'   },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} border rounded-2xl p-3 shadow-sm`}>
              <p className={`text-[18px] font-black leading-none ${k.vc}`}>{k.value}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide leading-tight">{k.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Alert ── */}
        {(error || success) && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-semibold ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {error ? '⚠️' : '✅'} {error || success}
          </div>
        )}

        {/* ── Add / Edit form ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`h-1 ${editingId ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-500'}`} />
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{editingId ? 'Edit income' : 'New income'}</p>
              <h2 className="text-[15px] font-black text-slate-900 mt-0.5">{editingId ? 'Income Update करो' : 'Income Add करो'}</h2>
            </div>
            {editingId && <button onClick={resetForm} className="px-3 py-1.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>}
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            {/* Source */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Source *</p>
              <input className={INP} placeholder="Interest, commission, rent..." value={form.source} onChange={(e) => setForm((c) => ({ ...c, source: e.target.value }))} required />
            </div>

            {/* Category pills */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Category</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button key={cat} type="button" onClick={() => setForm((c) => ({ ...c, category: cat }))}
                    className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${form.category === cat ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    <span>{CAT_EMOJI[cat] || '💰'}</span>
                    <span className="truncate">{cat}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount (₹)</p>
              <input className={INP} type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} required />
            </div>

            {/* Payment mode */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Mode</p>
              <div className="flex gap-2">
                {MODE_OPTIONS.map((mode) => (
                  <button key={mode} type="button" onClick={() => setForm((c) => ({ ...c, payment_mode: mode }))}
                    className={`flex-1 py-2.5 rounded-xl border text-[12px] font-black transition-all ${form.payment_mode === mode ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >{mode.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date</p>
                <input className={INP} type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} required />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Reference</p>
                <input className={INP} placeholder="Voucher / note ref" value={form.reference_id} onChange={(e) => setForm((c) => ({ ...c, reference_id: e.target.value }))} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Narration</p>
              <input className={INP} placeholder="Extra details..." value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} />
            </div>

            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 transition-all"
            >
              {saving ? '⏳ Saving...' : editingId ? '✏️ Update Income' : '💾 Save Income'}
            </button>
          </form>
        </div>

        {/* ── Transaction history ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-600 to-blue-600" />
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Income Register</p>
            <h3 className="text-[14px] font-black text-slate-900 mt-0.5">Transaction History</h3>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-slate-50 space-y-2">
            <input className="h-10 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              placeholder="🔍 Search source, note or reference..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
              <select className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none transition-all"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none transition-all"
                value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                <option value="all">All Modes</option>
                {MODE_OPTIONS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-2">💰</div>
              <p className="text-[13px] font-bold text-slate-600">No income found</p>
              <p className="text-[11px] text-slate-400 mt-1">Filter बदलो या नई income add करो</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredEntries.slice().sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).map((entry) => (
                <div key={entry._id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
                    {CAT_EMOJI[entry.category] || '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold text-slate-900 truncate">{entry.source}</p>
                      <p className="text-[15px] font-black text-emerald-600 flex-shrink-0">₹{fmt(entry.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">{entry.category}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${MODE_COLOR[entry.payment_mode] || 'bg-slate-100 text-slate-600'}`}>
                        {(entry.payment_mode || '').toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-400">{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    {(entry.note || entry.reference_id) && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">{[entry.note, entry.reference_id].filter(Boolean).join(' · ')}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => startEdit(entry)}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                      >✏️ Edit</button>
                      <button onClick={() => handleDelete(entry._id)} disabled={deletingId === entry._id}
                        className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                      >{deletingId === entry._id ? 'Deleting...' : '🗑️ Delete'}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}