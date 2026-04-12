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
const ENTRY_TYPES = ['deposit', 'withdrawal', 'charge', 'interest', 'transfer_in', 'transfer_out'];

const getEmptyForm = () => ({
  entry_type: 'deposit',
  amount: '',
  date: getTodayInputValue(),
  reference_id: '',
  note: '',
});

function StatCard({ label, value, note, tone }) {
  const toneClass = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-[26px] font-black leading-none">Rs {value}</p>
      <p className="mt-2 text-[11px] font-semibold opacity-75">{note}</p>
    </div>
  );
}

export default function BankEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState(getEmptyForm);

  const fetchEntries = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const res = await fetch(apiUrl('/api/bank-entries'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setError('Bank entries load nahi ho paayi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!success) return undefined;
    const timeoutId = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(timeoutId);
  }, [success]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.entry_type !== typeFilter) return false;
      if (!normalizedSearch) return true;
      return [entry.entry_type, entry.note, entry.reference_id].join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [entries, search, typeFilter]);

  const totalInflow = filteredEntries.filter((entry) => ['deposit', 'interest', 'transfer_in'].includes(entry.entry_type)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalOutflow = filteredEntries.filter((entry) => ['withdrawal', 'charge', 'transfer_out'].includes(entry.entry_type)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const netMovement = totalInflow - totalOutflow;

  const resetForm = () => {
    setEditingId('');
    setForm(getEmptyForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setError('Valid amount enter karo.'); return; }
    try {
      setSaving(true);
      setError('');
      const endpoint = editingId ? `/api/bank-entries/${editingId}` : '/api/bank-entries';
      const res = await fetch(apiUrl(endpoint), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          entry_type: form.entry_type,
          amount: Number(form.amount),
          date: form.date,
          reference_id: form.reference_id,
          note: form.note,
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Bank entry save nahi hui.'); return; }
      if (editingId) {
        setEntries((current) => current.map((entry) => (entry._id === editingId ? data : entry)));
        setSuccess('Bank entry updated successfully.');
      } else {
        setEntries((current) => [data, ...current]);
        setSuccess('Bank entry saved successfully.');
      }
      resetForm();
    } catch {
      setError('Bank entry save nahi hui.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      entry_type: entry.entry_type || 'deposit',
      amount: String(entry.amount || ''),
      date: new Date(entry.date || entry.createdAt).toISOString().slice(0, 10),
      reference_id: entry.reference_id || '',
      note: entry.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Is bank entry ko delete karna hai?');
    if (!confirmed) return;
    try {
      setDeletingId(id);
      const res = await fetch(apiUrl(`/api/bank-entries/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Bank entry delete nahi hui.'); return; }
      setEntries((current) => current.filter((entry) => entry._id !== id));
      if (editingId === id) resetForm();
      setSuccess('Bank entry deleted.');
    } catch {
      setError('Bank entry delete nahi hui.');
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
              <p className="rr-page-eyebrow">Bank movement</p>
              <h1 className="page-title reports-hero-title">Bank Entries</h1>
              <p className="reports-hero-subtitle">Deposits, withdrawals, charges, interest aur transfers ko dedicated bank register me rakho.</p>
            </div>
            <div className="reports-filter-pills">
              <Link href="/expenses" className="filter-pill">Expenses</Link>
              <Link href="/income" className="filter-pill">Income</Link>
              <Link href="/reports" className="filter-pill">Reports</Link>
            </div>
          </div>
          <div className="reports-hero-summary">
            <div className="reports-hero-summary-card"><span className="reports-hero-summary-label">Entries</span><strong className="reports-hero-summary-value">{fmtShort(filteredEntries.length)}</strong><span className="reports-hero-summary-note">visible rows</span></div>
            <div className="reports-hero-summary-card"><span className="reports-hero-summary-label">Inflow</span><strong className="reports-hero-summary-value is-emerald">Rs {fmtShort(totalInflow)}</strong><span className="reports-hero-summary-note">deposits and interest</span></div>
            <div className="reports-hero-summary-card"><span className="reports-hero-summary-label">Net Movement</span><strong className={`reports-hero-summary-value ${netMovement >= 0 ? 'is-emerald' : 'is-amber'}`}>Rs {fmtShort(Math.abs(netMovement))}</strong><span className="reports-hero-summary-note">{netMovement >= 0 ? 'net positive' : 'net outflow'}</span></div>
          </div>
        </div>

        {(error || success) && <div className={error ? 'rr-banner-warn' : 'rr-banner-ok'} role="status" style={{ marginBottom: 16, background: error ? '#fff1f2' : '#ecfdf5', borderColor: error ? '#fecdd3' : '#bbf7d0', color: error ? '#be123c' : '#166534' }}><strong>{error ? 'Issue' : 'Saved'}</strong>{` · ${error || success}`}</div>}

        <div className="reports-two-col reports-split-grid" style={{ alignItems: 'start' }}>
          <div className="card reports-section-card">
            <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#1d4ed8,#0891b2)' }} />
            <div className="reports-section-head">
              <div><p className="rr-page-eyebrow reports-section-eyebrow">{editingId ? 'Edit bank entry' : 'New bank entry'}</p><h2 className="section-title reports-section-title">{editingId ? 'Update Bank Entry' : 'Add Bank Entry'}</h2></div>
              {editingId ? <button type="button" className="btn-ghost" onClick={resetForm}>Cancel Edit</button> : null}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" style={{ padding: 20 }}>
              <div className="reports-breakdown-grid">
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Entry Type</p><select className="form-input" value={form.entry_type} onChange={(e) => setForm((current) => ({ ...current, entry_type: e.target.value }))}>{ENTRY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Amount</p><input className="form-input" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} placeholder="0.00" required /></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Date</p><input className="form-input" type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} required /></div>
              </div>
              <div className="reports-breakdown-grid">
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}><p className="reports-breakdown-label">Reference ID</p><input className="form-input" value={form.reference_id} onChange={(e) => setForm((current) => ({ ...current, reference_id: e.target.value }))} placeholder="Cheque / transfer ref" /></div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc', gridColumn: 'span 2' }}><p className="reports-breakdown-label">Narration</p><input className="form-input" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="Bank note, charge reason, transfer details..." /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', minHeight: 46 }}>{saving ? 'Saving...' : editingId ? 'Update Bank Entry' : 'Save Bank Entry'}</button>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <StatCard label="Total Inflow" value={fmtShort(totalInflow)} note="deposit, interest, transfer in" tone="emerald" />
            <StatCard label="Total Outflow" value={fmtShort(totalOutflow)} note="withdrawal, charge, transfer out" tone="rose" />
            <StatCard label="Net Movement" value={fmtShort(Math.abs(netMovement))} note={netMovement >= 0 ? 'net positive' : 'net outflow'} tone="blue" />
          </div>
        </div>

        <div className="card reports-section-card" style={{ marginTop: 18 }}>
          <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#1d4ed8,#0f766e)' }} />
          <div className="reports-section-head"><div><p className="rr-page-eyebrow reports-section-eyebrow">Bank register</p><h2 className="section-title reports-section-title">Transaction History</h2></div></div>
          <div style={{ padding: 16 }}>
            <div className="reports-section-actions" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search type, note or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="form-input" style={{ minWidth: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All Entry Types</option>{ENTRY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            </div>
            {loading ? <div className="reports-stack-list">{[...Array(5)].map((_, index) => <div key={index} className="skeleton" style={{ height: 72, borderRadius: 16 }} />)}</div> : filteredEntries.length === 0 ? <div className="empty-state" style={{ padding: '42px 16px' }}><div className="empty-state-icon">B</div><p style={{ fontWeight: 700, color: '#334155' }}>No bank entries found</p></div> : (
              <div className="reports-stack-list">
                {filteredEntries.slice().sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).map((entry) => {
                  const inflowType = ['deposit', 'interest', 'transfer_in'].includes(entry.entry_type);
                  return (
                    <div key={entry._id} className="dashboard-top-card stack-row reports-stack-row">
                      <div className="reports-rank-badge" style={{ background: inflowType ? 'linear-gradient(135deg,#10b981,#14b8a6)' : 'linear-gradient(135deg,#1d4ed8,#0891b2)' }}>{inflowType ? '+' : '-'}</div>
                      <div className="reports-stack-copy">
                        <p className="reports-stack-title">{entry.entry_type}</p>
                        <p className="reports-stack-meta">{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')} · {entry.reference_id || 'manual'}</p>
                        {entry.note ? <p className="page-subtitle" style={{ marginTop: 4 }}>{entry.note}</p> : null}
                      </div>
                      <div className="reports-stack-metrics">
                        <p className="reports-stack-value">Rs {fmt(entry.amount)}</p>
                        <div className="reports-section-actions" style={{ marginTop: 8, gap: 8, justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => startEdit(entry)} className="btn-ghost" style={{ minHeight: 34, padding: '0 12px', borderRadius: 10 }}>Edit</button>
                          <button type="button" onClick={() => handleDelete(entry._id)} className="btn-ghost" disabled={deletingId === entry._id} style={{ minHeight: 34, padding: '0 12px', borderRadius: 10 }}>{deletingId === entry._id ? 'Deleting...' : 'Delete'}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
