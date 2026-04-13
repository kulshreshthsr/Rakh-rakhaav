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
const CATEGORY_OPTIONS = ['rent', 'salary', 'transport', 'utility', 'maintenance', 'misc'];
const MODE_OPTIONS     = ['cash', 'upi', 'bank'];
const getEmptyForm = () => ({
  category: 'rent', amount: '', payment_mode: 'cash',
  date: getTodayInputValue(), reference_id: '', note: '',
});

/* ── Category emoji map ── */
const CAT_EMOJI = { rent: '🏠', salary: '👷', transport: '🚛', utility: '💡', maintenance: '🔧', misc: '📦' };
const MODE_COLOR = { cash: 'bg-amber-100 text-amber-800', upi: 'bg-cyan-100 text-cyan-800', bank: 'bg-blue-100 text-blue-800' };

/* ── Shared input class ── */
const INP = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all';

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses,   setExpenses]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingId,  setEditingId]  = useState('');
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [search,          setSearch]         = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('all');
  const [modeFilter,      setModeFilter]      = useState('all');
  const [form, setForm] = useState(getEmptyForm);

  /* ── All logic (100% UNCHANGED) ── */
  const fetchExpenses = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const res = await fetch(apiUrl('/api/expenses'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch { setError('Expenses load nahi ho paaye.'); }
    finally   { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    if (!success) return undefined;
    const id = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(id);
  }, [success]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (modeFilter     !== 'all' && e.payment_mode !== modeFilter) return false;
      if (!q) return true;
      return [e.category, e.note, e.reference_id].join(' ').toLowerCase().includes(q);
    });
  }, [categoryFilter, expenses, modeFilter, search]);

  const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const cashExpense  = filteredExpenses.filter((e) => e.payment_mode === 'cash').reduce((s, e) => s + Number(e.amount || 0), 0);
  const bankExpense  = filteredExpenses.filter((e) => ['bank','upi'].includes(e.payment_mode)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const categorySummary = [...filteredExpenses].reduce((map, e) => {
    const key = e.category || 'misc';
    map.set(key, Number(map.get(key) || 0) + Number(e.amount || 0));
    return map;
  }, new Map());
  const topCategories = Array.from(categorySummary.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  const resetForm = () => { setEditingId(''); setForm(getEmptyForm()); };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setError('Valid amount enter karo.'); return; }
    try {
      setSaving(true); setError('');
      const endpoint = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
      const res = await fetch(apiUrl(endpoint), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ category: form.category, amount: Number(form.amount), payment_mode: form.payment_mode, date: form.date, reference_id: form.reference_id, note: form.note }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Expense save nahi hua.'); return; }
      if (editingId) { setExpenses((c) => c.map((ex) => (ex._id === editingId ? data : ex))); setSuccess('Expense updated successfully.'); }
      else           { setExpenses((c) => [data, ...c]); setSuccess('Expense saved successfully.'); }
      resetForm();
    } catch { setError('Expense save nahi hua.'); }
    finally   { setSaving(false); }
  };

  const startEditExpense = (expense) => {
    setEditingId(expense._id); setError(''); setSuccess('');
    setForm({ category: expense.category || 'rent', amount: String(expense.amount || ''), payment_mode: expense.payment_mode || 'cash', date: new Date(expense.date || expense.createdAt).toISOString().slice(0, 10), reference_id: expense.reference_id || '', note: expense.note || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Is expense entry ko delete karna hai?')) return;
    try {
      setDeletingId(expenseId); setError('');
      const res = await fetch(apiUrl(`/api/expenses/${expenseId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Expense delete nahi hua.'); return; }
      setExpenses((c) => c.filter((ex) => ex._id !== expenseId));
      if (editingId === expenseId) resetForm();
      setSuccess('Expense deleted.');
    } catch { setError('Expense delete nahi hua.'); }
    finally   { setDeletingId(''); }
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-rose-50/40 to-orange-50/30 border border-slate-200 p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-rose-200/30 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold uppercase tracking-widest text-rose-700">
              💸 Expense Management
            </span>
            <h1 className="mt-2.5 text-[22px] font-black text-slate-900 leading-tight">Expenses / खर्च</h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Daily खर्च को category, payment mode और reference के साथ track करो।
            </p>
            {/* Nav links */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[{ href: '/income', label: '📈 Income' }, { href: '/bank-entries', label: '🏦 Bank' }, { href: '/reports', label: '📊 Reports' }, { href: '/gst', label: '🧾 GST' }].map((l) => (
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
            { label: 'कुल खर्च',   value: `₹${fmtShort(totalExpense)}`, sub: `${filteredExpenses.length} entries`, bg: 'bg-rose-50 border-rose-200',   vc: 'text-rose-700'   },
            { label: 'Cash खर्च',  value: `₹${fmtShort(cashExpense)}`,  sub: 'cash outflow',                       bg: 'bg-amber-50 border-amber-200', vc: 'text-amber-700'  },
            { label: 'Bank / UPI', value: `₹${fmtShort(bankExpense)}`,  sub: 'digital outflow',                    bg: 'bg-cyan-50 border-cyan-200',   vc: 'text-cyan-700'   },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} border rounded-2xl p-3 shadow-sm`}>
              <p className={`text-[18px] font-black leading-none ${k.vc}`}>{k.value}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide leading-tight">{k.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Alert / success banner ── */}
        {(error || success) && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-semibold ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {error ? '⚠️' : '✅'} {error || success}
          </div>
        )}

        {/* ── Add / Edit form ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`h-1 ${editingId ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-orange-500'}`} />
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{editingId ? 'Edit expense' : 'New expense'}</p>
              <h2 className="text-[15px] font-black text-slate-900 mt-0.5">{editingId ? 'Expense Update करो' : 'Expense Add करो'}</h2>
            </div>
            {editingId && (
              <button onClick={resetForm} className="px-3 py-1.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleCreateExpense} className="p-5 space-y-3">
            {/* Category pills */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Category</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button key={cat} type="button" onClick={() => setForm((c) => ({ ...c, category: cat }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-bold transition-all ${form.category === cat ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    <span>{CAT_EMOJI[cat] || '📦'}</span> {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount (₹)</p>
              <input className={INP} type="number" step="0.01" min="0.01" placeholder="0.00"
                value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} required
              />
            </div>

            {/* Payment mode */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Mode</p>
              <div className="flex gap-2">
                {MODE_OPTIONS.map((mode) => (
                  <button key={mode} type="button" onClick={() => setForm((c) => ({ ...c, payment_mode: mode }))}
                    className={`flex-1 py-2.5 rounded-xl border text-[12px] font-black transition-all ${form.payment_mode === mode ? 'border-rose-400 bg-rose-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
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
                <input className={INP} placeholder="Bill / cheque ref" value={form.reference_id} onChange={(e) => setForm((c) => ({ ...c, reference_id: e.target.value }))} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Narration</p>
              <input className={INP} placeholder="Rent for April, delivery van, repair, etc." value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} />
            </div>

            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-rose-500 to-orange-500 shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 transition-all"
            >
              {saving ? '⏳ Saving...' : editingId ? '✏️ Update Expense' : '💾 Save Expense'}
            </button>
          </form>
        </div>

        {/* ── Top categories ── */}
        {topCategories.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Spend Split</p>
              <h3 className="text-[14px] font-black text-slate-900 mt-0.5">Top Categories</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {topCategories.map((item) => (
                <div key={item.category} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-lg flex-shrink-0">
                    {CAT_EMOJI[item.category] || '📦'}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-slate-900">{item.category}</p>
                    <p className="text-[11px] text-slate-400">category total</p>
                  </div>
                  <p className="text-[15px] font-black text-rose-600">₹{fmtShort(item.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transaction history ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-slate-700 to-rose-600" />
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expense Register</p>
            <h3 className="text-[14px] font-black text-slate-900 mt-0.5">Transaction History</h3>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-slate-50 space-y-2">
            <input className="h-10 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
              placeholder="🔍 Search note, category or reference..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
              <select className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                <option value="all">All Modes</option>
                {MODE_OPTIONS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-2">💸</div>
              <p className="text-[13px] font-bold text-slate-600">No expenses found</p>
              <p className="text-[11px] text-slate-400 mt-1">Filter बदलो या नया expense add करो</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredExpenses
                .slice().sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                .map((expense) => (
                  <div key={expense._id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
                      {CAT_EMOJI[expense.category] || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-bold text-slate-900">{expense.category}</p>
                        <p className="text-[15px] font-black text-rose-600 flex-shrink-0">₹{fmt(expense.amount)}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${MODE_COLOR[expense.payment_mode] || 'bg-slate-100 text-slate-600'}`}>
                          {(expense.payment_mode || '').toUpperCase()}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(expense.date || expense.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      {(expense.note || expense.reference_id) && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          {[expense.note, expense.reference_id].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => startEditExpense(expense)}
                          className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >✏️ Edit</button>
                        <button onClick={() => handleDeleteExpense(expense._id)} disabled={deletingId === expense._id}
                          className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                        >{deletingId === expense._id ? 'Deleting...' : '🗑️ Delete'}</button>
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