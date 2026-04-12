'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const getTodayInputValue = () => new Date().toISOString().slice(0, 10);
const CATEGORY_OPTIONS = ['other_income', 'interest', 'commission', 'rent', 'discount'];
const MODE_OPTIONS = ['cash', 'upi', 'bank'];

const getEmptyForm = () => ({
  source: '',
  category: 'other_income',
  amount: '',
  payment_mode: 'bank',
  date: getTodayInputValue(),
  reference_id: '',
  note: '',
});

function StatCard({ label, value, note, tone }) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-[26px] font-black leading-none">Rs {value}</p>
      <p className="mt-2 text-[11px] font-semibold opacity-75">{note}</p>
    </div>
  );
}

export default function IncomePage() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [form, setForm] = useState(getEmptyForm);

  const fetchIncome = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const res = await fetch(apiUrl('/api/income'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setError('Income entries load nahi ho paayi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  useEffect(() => {
    if (!success) return undefined;
    const timeoutId = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(timeoutId);
  }, [success]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (modeFilter !== 'all' && entry.payment_mode !== modeFilter) return false;
      if (!normalizedSearch) return true;
      return [entry.source, entry.category, entry.note, entry.reference_id].join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [categoryFilter, entries, modeFilter, search]);

  const totalIncome = filteredEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const cashIncome = filteredEntries.filter((entry) => entry.payment_mode === 'cash').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const bankIncome = filteredEntries.filter((entry) => ['bank', 'upi'].includes(entry.payment_mode)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const resetForm = () => {
    setEditingId('');
    setForm(getEmptyForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source.trim()) { setError('Income source required hai.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Valid amount enter karo.'); return; }

    try {
      setSaving(true);
      setError('');
      const endpoint = editingId ? `/api/income/${editingId}` : '/api/income';
      const res = await fetch(apiUrl(endpoint), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          source: form.source,
          category: form.category,
          amount: Number(form.amount),
          payment_mode: form.payment_mode,
          date: form.date,
          reference_id: form.reference_id,
          note: form.note,
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Income save nahi hui.'); return; }
      if (editingId) {
        setEntries((current) => current.map((entry) => (entry._id === editingId ? data : entry)));
        setSuccess('Income updated successfully.');
      } else {
        setEntries((current) => [data, ...current]);
        setSuccess('Income saved successfully.');
      }
      resetForm();
    } catch {
      setError('Income save nahi hui.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      source: entry.source || '',
      category: entry.category || 'other_income',
      amount: String(entry.amount || ''),
      payment_mode: entry.payment_mode || 'bank',
      date: new Date(entry.date || entry.createdAt).toISOString().slice(0, 10),
      reference_id: entry.reference_id || '',
      note: entry.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Is income entry ko delete karna hai?');
    if (!confirmed) return;
    try {
      setDeletingId(id);
      const res = await fetch(apiUrl(`/api/income/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Income delete nahi hui.'); return; }
      setEntries((current) => current.filter((entry) => entry._id !== id));
      if (editingId === id) resetForm();
      setSuccess('Income deleted.');
    } catch {
      setError('Income delete nahi hui.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <Layout>
      <div className="page-shell reports-shell">
        <div className="hero-panel reports-hero" style={{ marginBottom: 18 }}>
          <div className="reports-hero-header">
            <div className="reports-hero-copy">
              <p className="rr-page-eyebrow">Other income</p>
              <h1 className="page-title reports-hero-title">Income / Aamdani</h1>
              <p className="reports-hero-subtitle">Interest, commission, rent aur extra receipts ko alag register me rakho.</p>
            </div>
            <div className="reports-filter-pills">
              <Link href="/expenses" className="filter-pill">Expenses</Link>
              <Link href="/bank-entries" className="filter-pill">Bank</Link>
              <Link href="/reports" className="filter-pill">Reports</Link>
            </div>
          </div>
          <div className="reports-hero-summary">
            <div className="reports-hero-summary-card"><span className="reports-hero-summary-label">Entries</span><strong className="reports-hero-summary-value">{fmtShort(filteredEntries.length)}</strong><span className="reports-hero-summary-note">visible rows</span></div>
            <div className="reports-hero-summary-card"><span className="reports-hero-summary-label">Cash Income</span><strong className="reports-hero-summary-value is-emerald">Rs {fmtShort(cashIncome)}</strong><span className="reports-hero-summary-note">cash inflow</span></div>
            <div className="reports-hero-summary-card"><span className="reports-hero-summary-label">Bank / UPI</span><strong className="reports-hero-summary-value is-amber">Rs {fmtShort(bankIncome)}</strong><span className="reports-hero-summary-note">digital inflow</span></div>
          </div>
        </div>

        {(error || success) && <div className={error ? 'rr-banner-warn' : 'rr-banner-ok'} role="status" style={{ marginBottom: 16, background: error ? '#fff1f2' : '#ecfdf5', borderColor: error ? '#fecdd3' : '#bbf7d0', color: error ? '#be123c' : '#166534' }}><strong>{error ? 'Issue' : 'Saved'}</strong>{` · ${error || success}`}</div>}

        <div className="reports-two-col reports-split-grid" style={{ alignItems: 'start' }}>
          <div className="card reports-section-card">
            <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#2563eb,#0ea5e9)' }} />
            <div className="reports-section-head">
              <div><p className="rr-page-eyebrow reports-section-eyebrow">{editingId ? 'Edit income' : 'New income'}</p><h2 className="section-title reports-section-title">{editingId ? 'Update Income' : 'Add Income'}</h2></div>
              {editingId ? <button type="button" className="btn-ghost" onClick={resetForm}>Cancel Edit</button> : null}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" style={{ padding: 20 }}>
              <div className="reports-breakdown-grid">
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Source</p><input className="form-input" value={form.source} onChange={(e) => setForm((current) => ({ ...current, source: e.target.value }))} placeholder="Interest, commission, rent..." required /></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Category</p><select className="form-input" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}>{CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Amount</p><input className="form-input" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} placeholder="0.00" required /></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Payment Mode</p><select className="form-input" value={form.payment_mode} onChange={(e) => setForm((current) => ({ ...current, payment_mode: e.target.value }))}>{MODE_OPTIONS.map((mode) => <option key={mode} value={mode}>{mode.toUpperCase()}</option>)}</select></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Date</p><input className="form-input" type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} required /></div>
              </div>
              <div className="reports-breakdown-grid">
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Reference ID</p><input className="form-input" value={form.reference_id} onChange={(e) => setForm((current) => ({ ...current, reference_id: e.target.value }))} placeholder="Voucher / note ref" /></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc', gridColumn: 'span 2' }}><p className="reports-breakdown-label">Narration</p><input className="form-input" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="Extra details" /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', minHeight: 46 }}>{saving ? 'Saving...' : editingId ? 'Update Income' : 'Save Income'}</button>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <StatCard label="Total Income" value={fmtShort(totalIncome)} note={`${filteredEntries.length} filtered entries`} tone="emerald" />
            <StatCard label="Cash Received" value={fmtShort(cashIncome)} note="cash inflow" tone="cyan" />
            <StatCard label="Bank / UPI" value={fmtShort(bankIncome)} note="digital inflow" tone="blue" />
          </div>
        </div>

        <div className="card reports-section-card" style={{ marginTop: 18 }}>
          <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#0f766e,#2563eb)' }} />
          <div className="reports-section-head"><div><p className="rr-page-eyebrow reports-section-eyebrow">Income register</p><h2 className="section-title reports-section-title">Transaction History</h2></div></div>
          <div style={{ padding: 16 }}>
            <div className="reports-section-actions" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search source, note or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="reports-section-actions" style={{ gap: 10, flexWrap: 'wrap' }}>
                <select className="form-input" style={{ minWidth: 150 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All Categories</option>{CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                <select className="form-input" style={{ minWidth: 130 }} value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}><option value="all">All Modes</option>{MODE_OPTIONS.map((mode) => <option key={mode} value={mode}>{mode.toUpperCase()}</option>)}</select>
              </div>
            </div>
            {loading ? <div className="reports-stack-list">{[...Array(5)].map((_, index) => <div key={index} className="skeleton" style={{ height: 72, borderRadius: 16 }} />)}</div> : filteredEntries.length === 0 ? <div className="empty-state" style={{ padding: '42px 16px' }}><div className="empty-state-icon">+</div><p style={{ fontWeight: 700, color: '#334155' }}>No income found</p></div> : (
              <div className="reports-stack-list">
                {filteredEntries.slice().sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).map((entry) => (
                  <div key={entry._id} className="dashboard-top-card stack-row reports-stack-row">
                    <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)' }}>+</div>
                    <div className="reports-stack-copy">
                      <p className="reports-stack-title">{entry.source}</p>
                      <p className="reports-stack-meta">{entry.category} · {(entry.payment_mode || '').toUpperCase()} · {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</p>
                      {(entry.note || entry.reference_id) ? <p className="page-subtitle" style={{ marginTop: 4 }}>{[entry.note, entry.reference_id].filter(Boolean).join(' · ')}</p> : null}
                    </div>
                    <div className="reports-stack-metrics">
                      <p className="reports-stack-value">Rs {fmt(entry.amount)}</p>
                      <div className="reports-section-actions" style={{ marginTop: 8, gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => startEdit(entry)} className="btn-ghost" style={{ minHeight: 34, padding: '0 12px', borderRadius: 10 }}>Edit</button>
                        <button type="button" onClick={() => handleDelete(entry._id)} className="btn-ghost" disabled={deletingId === entry._id} style={{ minHeight: 34, padding: '0 12px', borderRadius: 10 }}>{deletingId === entry._id ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
