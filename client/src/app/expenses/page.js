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
const CATEGORY_OPTIONS = ['rent', 'salary', 'transport', 'utility', 'maintenance', 'misc'];
const MODE_OPTIONS = ['cash', 'upi', 'bank'];
const getEmptyForm = () => ({
  category: 'rent',
  amount: '',
  payment_mode: 'cash',
  date: getTodayInputValue(),
  reference_id: '',
  note: '',
});

function StatCard({ label, value, note, tone }) {
  const toneClass = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-[26px] font-black leading-none">₹{value}</p>
      <p className="mt-2 text-[11px] font-semibold opacity-75">{note}</p>
    </div>
  );
}

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState([]);
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

  const fetchExpenses = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const res = await fetch(apiUrl('/api/expenses'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch {
      setError('Expenses load nahi ho paaye.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    if (!success) return undefined;
    const timeoutId = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(timeoutId);
  }, [success]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
      if (modeFilter !== 'all' && expense.payment_mode !== modeFilter) return false;
      if (!normalizedSearch) return true;
      return [expense.category, expense.note, expense.reference_id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [categoryFilter, expenses, modeFilter, search]);

  const totalExpense = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const cashExpense = filteredExpenses
    .filter((expense) => expense.payment_mode === 'cash')
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const bankExpense = filteredExpenses
    .filter((expense) => ['bank', 'upi'].includes(expense.payment_mode))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const categorySummary = [...filteredExpenses]
    .reduce((map, expense) => {
      const key = expense.category || 'misc';
      map.set(key, Number(map.get(key) || 0) + Number(expense.amount || 0));
      return map;
    }, new Map());
  const topCategories = Array.from(categorySummary.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const resetForm = () => {
    setEditingId('');
    setForm(getEmptyForm());
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Valid amount enter karo.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const endpoint = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
      const res = await fetch(apiUrl(endpoint), {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
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
      if (!res.ok) {
        setError(data.message || 'Expense save nahi hua.');
        return;
      }
      if (editingId) {
        setExpenses((current) => current.map((expense) => (expense._id === editingId ? data : expense)));
        setSuccess('Expense updated successfully.');
      } else {
        setExpenses((current) => [data, ...current]);
        setSuccess('Expense saved successfully.');
      }
      resetForm();
    } catch {
      setError('Expense save nahi hua.');
    } finally {
      setSaving(false);
    }
  };

  const startEditExpense = (expense) => {
    setEditingId(expense._id);
    setError('');
    setSuccess('');
    setForm({
      category: expense.category || 'rent',
      amount: String(expense.amount || ''),
      payment_mode: expense.payment_mode || 'cash',
      date: new Date(expense.date || expense.createdAt).toISOString().slice(0, 10),
      reference_id: expense.reference_id || '',
      note: expense.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (expenseId) => {
    const confirmed = window.confirm('Is expense entry ko delete karna hai?');
    if (!confirmed) return;
    try {
      setDeletingId(expenseId);
      setError('');
      const res = await fetch(apiUrl(`/api/expenses/${expenseId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Expense delete nahi hua.');
        return;
      }
      setExpenses((current) => current.filter((expense) => expense._id !== expenseId));
      if (editingId === expenseId) resetForm();
      setSuccess('Expense deleted.');
    } catch {
      setError('Expense delete nahi hua.');
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
              <p className="rr-page-eyebrow">Expense management</p>
              <h1 className="page-title reports-hero-title">Expenses / Kharch</h1>
              <p className="reports-hero-subtitle">
                Daily kharch ko category, payment mode aur reference ke saath track karo.
              </p>
            </div>
            <div className="reports-filter-pills">
              <Link href="/income" className="filter-pill">Income</Link>
              <Link href="/bank-entries" className="filter-pill">Bank</Link>
              <Link href="/reports" className="filter-pill">Reports</Link>
              <Link href="/gst" className="filter-pill">GST</Link>
            </div>
          </div>
          <div className="reports-hero-summary">
            <div className="reports-hero-summary-card">
              <span className="reports-hero-summary-label">Entries</span>
              <strong className="reports-hero-summary-value">{fmtShort(filteredExpenses.length)}</strong>
              <span className="reports-hero-summary-note">visible rows</span>
            </div>
            <div className="reports-hero-summary-card">
              <span className="reports-hero-summary-label">Cash Outflow</span>
              <strong className="reports-hero-summary-value is-amber">₹{fmtShort(cashExpense)}</strong>
              <span className="reports-hero-summary-note">cash expenses</span>
            </div>
            <div className="reports-hero-summary-card">
              <span className="reports-hero-summary-label">Bank / UPI</span>
              <strong className="reports-hero-summary-value is-emerald">₹{fmtShort(bankExpense)}</strong>
              <span className="reports-hero-summary-note">bank-linked outflow</span>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div
            className={error ? 'rr-banner-warn' : 'rr-banner-ok'}
            role="status"
            style={{ marginBottom: 16, background: error ? '#fff1f2' : '#ecfdf5', borderColor: error ? '#fecdd3' : '#bbf7d0', color: error ? '#be123c' : '#166534' }}
          >
            <strong>{error ? 'Issue' : 'Saved'}</strong>
            {` · ${error || success}`}
          </div>
        )}

        <div className="reports-two-col reports-split-grid" style={{ alignItems: 'start' }}>
          <div className="card reports-section-card">
            <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#ef4444,#f97316)' }} />
            <div className="reports-section-head">
              <div>
                <p className="rr-page-eyebrow reports-section-eyebrow">{editingId ? 'Edit expense' : 'New expense'}</p>
                <h2 className="section-title reports-section-title">{editingId ? 'Update Expense' : 'Add Expense'}</h2>
              </div>
              {editingId ? <button type="button" className="btn-ghost" onClick={resetForm}>Cancel Edit</button> : null}
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4" style={{ padding: 20 }}>
              <div className="reports-breakdown-grid">
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                  <p className="reports-breakdown-label">Category</p>
                  <select className="form-input" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                  <p className="reports-breakdown-label">Amount</p>
                  <input className="form-input" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} placeholder="0.00" required />
                </div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                  <p className="reports-breakdown-label">Payment Mode</p>
                  <select className="form-input" value={form.payment_mode} onChange={(e) => setForm((current) => ({ ...current, payment_mode: e.target.value }))}>
                    {MODE_OPTIONS.map((mode) => (
                      <option key={mode} value={mode}>{mode.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                  <p className="reports-breakdown-label">Date</p>
                  <input className="form-input" type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} required />
                </div>
              </div>

              <div className="reports-breakdown-grid">
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc' }}>
                  <p className="reports-breakdown-label">Reference ID</p>
                  <input className="form-input" value={form.reference_id} onChange={(e) => setForm((current) => ({ ...current, reference_id: e.target.value }))} placeholder="Bill / cheque / note ref" />
                </div>
                <div className="dashboard-breakdown-card reports-breakdown-card" style={{ background: '#f8fafc', gridColumn: 'span 2' }}>
                  <p className="reports-breakdown-label">Narration</p>
                  <input className="form-input" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="Rent for April, delivery van, repair, etc." />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', minHeight: 46 }}>
                {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Save Expense'}
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <StatCard label="Total Expense" value={fmtShort(totalExpense)} note={`${filteredExpenses.length} filtered entries`} tone="rose" />
            <StatCard label="Cash Paid" value={fmtShort(cashExpense)} note="pure cash outflow" tone="amber" />
            <StatCard label="Bank + UPI" value={fmtShort(bankExpense)} note="bank trail visible" tone="cyan" />
            <div className="card reports-section-card">
              <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#0ea5e9,#14b8a6)' }} />
              <div className="reports-section-head">
                <div>
                  <p className="rr-page-eyebrow reports-section-eyebrow">Top categories</p>
                  <h2 className="section-title reports-section-title">Spend Split</h2>
                </div>
              </div>
              <div className="reports-stack-list" style={{ padding: 14 }}>
                {topCategories.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>
                    <p style={{ fontWeight: 700, color: '#334155' }}>No expenses yet</p>
                  </div>
                ) : topCategories.map((item) => (
                  <div key={item.category} className="dashboard-top-card stack-row reports-stack-row">
                    <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#fb7185,#f97316)' }}>₹</div>
                    <div className="reports-stack-copy">
                      <p className="reports-stack-title">{item.category}</p>
                      <p className="reports-stack-meta">category total</p>
                    </div>
                    <div className="reports-stack-metrics">
                      <p className="reports-stack-value">₹{fmtShort(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card reports-section-card" style={{ marginTop: 18 }}>
          <div className="reports-section-accent" style={{ background: 'linear-gradient(90deg,#7c2d12,#ef4444)' }} />
          <div className="reports-section-head">
            <div>
              <p className="rr-page-eyebrow reports-section-eyebrow">Expense register</p>
              <h2 className="section-title reports-section-title">Transaction History</h2>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <div className="reports-section-actions" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <input
                className="form-input"
                style={{ maxWidth: 280 }}
                placeholder="Search note, category or reference"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="reports-section-actions" style={{ gap: 10, flexWrap: 'wrap' }}>
                <select className="form-input" style={{ minWidth: 150 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select className="form-input" style={{ minWidth: 130 }} value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                  <option value="all">All Modes</option>
                  {MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>{mode.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="reports-stack-list">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="skeleton" style={{ height: 72, borderRadius: 16 }} />
                ))}
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="empty-state" style={{ padding: '42px 16px' }}>
                <div className="empty-state-icon">₹</div>
                <p style={{ fontWeight: 700, color: '#334155' }}>No expenses found</p>
                <p className="page-subtitle" style={{ marginTop: 4 }}>Filter change karo ya new expense add karo.</p>
              </div>
            ) : (
              <div className="reports-stack-list">
                {filteredExpenses
                  .slice()
                  .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                  .map((expense) => (
                    <div key={expense._id} className="dashboard-top-card stack-row reports-stack-row">
                      <div className="reports-rank-badge" style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)' }}>₹</div>
                      <div className="reports-stack-copy">
                        <p className="reports-stack-title">{expense.category}</p>
                        <p className="reports-stack-meta">
                          {new Date(expense.date || expense.createdAt).toLocaleDateString('en-IN')} · {(expense.payment_mode || '').toUpperCase()}
                        </p>
                        {(expense.note || expense.reference_id) && (
                          <p className="page-subtitle" style={{ marginTop: 4 }}>
                            {[expense.note, expense.reference_id].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="reports-stack-metrics">
                        <p className="reports-stack-value">₹{fmt(expense.amount)}</p>
                        <div className="reports-section-actions" style={{ marginTop: 8, gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => startEditExpense(expense)}
                            className="btn-ghost"
                            style={{ minHeight: 34, padding: '0 12px', borderRadius: 10 }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(expense._id)}
                            className="btn-ghost"
                            disabled={deletingId === expense._id}
                            style={{ minHeight: 34, padding: '0 12px', borderRadius: 10 }}
                          >
                            {deletingId === expense._id ? 'Deleting...' : 'Delete'}
                          </button>
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
