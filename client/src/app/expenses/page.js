'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import { getBusinessConfig } from '../../lib/business-configs';

/* ── Default categories (fallback for unknown types, matches existing IDs) ── */
const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'rent',        labelHi: 'किराया',      labelEn: 'Rent',        emoji: '🏠' },
  { id: 'salary',      labelHi: 'वेतन',         labelEn: 'Salary',      emoji: '👷' },
  { id: 'transport',   labelHi: 'परिवहन',       labelEn: 'Transport',   emoji: '🚛' },
  { id: 'utility',     labelHi: 'बिजली-पानी',   labelEn: 'Utility',     emoji: '💡' },
  { id: 'maintenance', labelHi: 'मरम्मत',        labelEn: 'Maintenance', emoji: '🔧' },
  { id: 'misc',        labelHi: 'अन्य',          labelEn: 'Misc',        emoji: '📦' },
];

const FREQ_LABELS  = { weekly: 'साप्ताहिक', monthly: 'मासिक', quarterly: 'तिमाही' };
const MODE_OPTIONS = ['cash', 'upi', 'bank'];
const MODE_LABELS  = { cash: 'Cash', upi: 'UPI', bank: 'Bank' };
const INP = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

const getToken          = () => localStorage.getItem('token');
const fmt               = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort          = (n) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtChart          = (n) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
};
const getTodayInputValue    = () => new Date().toISOString().slice(0, 10);
const getDefaultNextDueDate = (freq) => {
  const d = new Date();
  if (freq === 'weekly')    d.setDate(d.getDate() + 7);
  else if (freq === 'monthly')   d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
};
const advanceDueDate = (dateStr, freq) => {
  const d = new Date(dateStr);
  if (freq === 'weekly')    d.setDate(d.getDate() + 7);
  else if (freq === 'monthly')   d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
};

const getEmptyForm = () => ({
  category:         'misc',
  amount:           '',
  payment_mode:     'cash',
  date:             getTodayInputValue(),
  reference_id:     '',
  note:             '',
  is_recurring:     false,
  frequency:        'monthly',
  next_due_date:    '',
  is_tax_deductible: false,
});

/* ── SVG Trend Chart — no external library ── */
function TrendChart({ data }) {
  if (!data || data.every((d) => d.total === 0)) return null;
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  return (
    <svg viewBox="0 0 300 150" className="w-full" aria-label="Monthly expense trend">
      <line x1={0} y1={115} x2={300} y2={115} stroke="#e2e8f0" strokeWidth={1} />
      {data.map((d, i) => {
        const barH = Math.max((d.total / maxVal) * 100, d.total > 0 ? 3 : 0);
        const x    = 12 + i * 48;
        const y    = 115 - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={36} height={barH}
              fill={d.isCurrentMonth ? '#16a34a' : '#86efac'} rx={3} />
            {d.total > 0 && (
              <text x={x + 18} y={Math.max(y - 4, 8)} textAnchor="middle"
                fontSize={7} fill={d.isCurrentMonth ? '#166534' : '#4ade80'} fontWeight="700">
                ₹{fmtChart(d.total)}
              </text>
            )}
            <text x={x + 18} y={133} textAnchor="middle"
              fontSize={8.5}
              fill={d.isCurrentMonth ? '#1e293b' : '#94a3b8'}
              fontWeight={d.isCurrentMonth ? '700' : '400'}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ExpensesPage() {
  const router        = useRouter();
  const { showToast } = useToast();

  /* ── Core state ── */
  const [expenses,      setExpenses]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [deletingId,    setDeletingId]    = useState('');
  const [editingId,     setEditingId]     = useState('');
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [form,          setForm]          = useState(getEmptyForm);
  const [showRecurring, setShowRecurring] = useState(false);

  /* ── Filters ── */
  const [search,         setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modeFilter,     setModeFilter]     = useState('all');
  const [taxFilter,      setTaxFilter]      = useState(false);

  /* ── Industry config & budgets ── */
  const [businessType, setBusinessType] = useState('');
  const [budgets,      setBudgets]      = useState({});

  /* ── Month anchor — stable across re-renders ── */
  const monthAnchor = useRef({ m: new Date().getMonth(), y: new Date().getFullYear() });

  /* ── Category helpers derived from bizConfig ── */
  const CATEGORIES = useMemo(() => {
    const bc = getBusinessConfig(businessType);
    return bc.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  }, [businessType]);

  const getCategoryById  = useCallback((id) =>
    CATEGORIES.find((c) => c.id === id) || { id, labelHi: id, labelEn: id, emoji: '📦' },
  [CATEGORIES]);
  const getCategoryLabel = useCallback((id) => getCategoryById(id).labelHi, [getCategoryById]);
  const getCategoryEmoji = useCallback((id) => getCategoryById(id).emoji,    [getCategoryById]);

  /* ── Load businessType + shop budgets once ── */
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setBusinessType(user.businessType || '');
    } catch { setBusinessType(''); }

    const loadShopData = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(apiUrl('/api/auth/shop'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const shop = await res.json();
          const bm   = {};
          (shop.expense_budgets || []).forEach((b) => { bm[b.category] = b.monthly_limit; });
          setBudgets(bm);
        }
      } catch {}
    };
    loadShopData();
  }, []);

  /* ── Fetch all expenses ── */
  const fetchExpenses = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setError('');
      const res  = await fetch(apiUrl('/api/expenses'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch { setError('खर्च load नहीं हो पाए।'); }
    finally   { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  /* ── Auto-clear success ── */
  useEffect(() => {
    if (!success) return undefined;
    const id = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(id);
  }, [success]);

  /* ── Recurring due-date checker (runs once when expenses load) ── */
  const dueChecked = useRef(false);
  useEffect(() => {
    if (!expenses.length || dueChecked.current) return;
    dueChecked.current = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expenses
      .filter((e) => e.is_recurring_template && e.next_due_date && new Date(e.next_due_date) <= today)
      .forEach((template) => {
        showToast(
          `📅 Recurring खर्च due: ${getCategoryLabel(template.category)} — ₹${fmtShort(template.amount)}`,
          'info',
          [{ label: 'Add करो', onClick: () => prefillFromTemplate(template) }]
        );
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  /* ── Derived: split templates from real expenses ── */
  const realExpenses       = useMemo(() => expenses.filter((e) => !e.is_recurring_template), [expenses]);
  const recurringTemplates = useMemo(() => expenses.filter((e) => e.is_recurring_template),  [expenses]);

  /* ── Filtered list for history (excludes templates) ── */
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return realExpenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (modeFilter     !== 'all' && e.payment_mode !== modeFilter) return false;
      if (taxFilter && !e.is_tax_deductible) return false;
      if (!q) return true;
      return [e.category, getCategoryLabel(e.category), e.note, e.reference_id]
        .join(' ').toLowerCase().includes(q);
    });
  }, [realExpenses, categoryFilter, modeFilter, taxFilter, search, getCategoryLabel]);

  /* ── KPI totals (from filtered list, templates excluded) ── */
  const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const cashExpense  = filteredExpenses.filter((e) => e.payment_mode === 'cash')
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const bankExpense  = filteredExpenses.filter((e) => ['bank', 'upi'].includes(e.payment_mode || ''))
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  /* ── Category summary for top-5 analytics ── */
  const topCategories = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach((e) => {
      const k = e.category || 'misc';
      map.set(k, (map.get(k) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredExpenses]);

  /* ── Monthly spend map for budget progress bars ── */
  const monthlySpend = useMemo(() => {
    const { m, y } = monthAnchor.current;
    return realExpenses
      .filter((e) => {
        const d = new Date(e.date || e.createdAt);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((map, e) => {
        map.set(e.category, (map.get(e.category) || 0) + e.amount);
        return map;
      }, new Map());
  }, [realExpenses]);

  /* ── Tax deductible total (this month) ── */
  const taxDeductibleTotal = useMemo(() => {
    const { m, y } = monthAnchor.current;
    return realExpenses
      .filter((e) => {
        if (!e.is_tax_deductible) return false;
        const d = new Date(e.date || e.createdAt);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((s, e) => s + e.amount, 0);
  }, [realExpenses]);

  /* ── 6-month trend data (templates excluded) ── */
  const trendData = useMemo(() => {
    const now    = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('hi-IN', { month: 'short' });
      const total = realExpenses
        .filter((e) => {
          const ed = new Date(e.date || e.createdAt);
          return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
        })
        .reduce((s, e) => s + e.amount, 0);
      months.push({ label, total, isCurrentMonth: i === 0 });
    }
    return months;
  }, [realExpenses]);

  /* ── Helpers ── */
  const resetForm = () => { setEditingId(''); setForm(getEmptyForm()); };

  const prefillFromTemplate = async (template) => {
    // Advance the template's next_due_date optimistically
    if (template.next_due_date && template.frequency) {
      const newDue = advanceDueDate(template.next_due_date, template.frequency);
      try {
        const res = await fetch(apiUrl(`/api/expenses/${template._id}`), {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body:    JSON.stringify({
            category:              template.category,
            amount:                template.amount,
            payment_mode:          template.payment_mode || 'cash',
            note:                  template.note || '',
            reference_id:          template.reference_id || '',
            date:                  template.date,
            is_recurring:          true,
            frequency:             template.frequency,
            next_due_date:         newDue,
            is_recurring_template: true,
            is_tax_deductible:     template.is_tax_deductible || false,
          }),
        });
        if (res.ok) {
          setExpenses((prev) =>
            prev.map((e) => (e._id === template._id ? { ...e, next_due_date: newDue } : e))
          );
        }
      } catch {}
    }
    setEditingId('');
    setForm({
      category:          template.category || 'misc',
      amount:            String(template.amount || ''),
      payment_mode:      template.payment_mode || 'cash',
      date:              getTodayInputValue(),
      reference_id:      template.reference_id || '',
      note:              template.note || '',
      is_recurring:      false,
      frequency:         'monthly',
      next_due_date:     '',
      is_tax_deductible: template.is_tax_deductible || false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── CRUD ── */
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.amount || amt <= 0) { setError('सही amount डालें।'); return; }
    if (amt > 10_00_00_000)       { setError('₹10 करोड़ से ज़्यादा का amount? एक बार check करें।'); return; }
    try {
      setSaving(true); setError('');
      const endpoint = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
      const res = await fetch(apiUrl(endpoint), {
        method:  editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({
          category:              form.category,
          amount:                amt,
          payment_mode:          form.payment_mode,
          date:                  form.date,
          reference_id:          form.reference_id,
          note:                  form.note,
          is_recurring:          form.is_recurring,
          frequency:             form.is_recurring ? form.frequency : null,
          next_due_date:         form.is_recurring ? (form.next_due_date || null) : null,
          is_recurring_template: form.is_recurring,
          is_tax_deductible:     form.is_tax_deductible,
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'खर्च save नहीं हुआ।'); return; }
      if (editingId) {
        setExpenses((c) => c.map((ex) => (ex._id === editingId ? data : ex)));
        setSuccess('✅ खर्च बदला गया');
      } else {
        setExpenses((c) => [data, ...c]);
        setSuccess(form.is_recurring ? '🔄 Recurring खर्च जोड़ा गया' : '✅ खर्च जोड़ा गया');
      }
      resetForm();
    } catch { setError('खर्च save नहीं हुआ।'); }
    finally   { setSaving(false); }
  };

  const startEditExpense = (expense) => {
    setEditingId(expense._id); setError(''); setSuccess('');
    setForm({
      category:          expense.category || 'misc',
      amount:            String(expense.amount || ''),
      payment_mode:      expense.payment_mode || 'cash',
      date:              new Date(expense.date || expense.createdAt).toISOString().slice(0, 10),
      reference_id:      expense.reference_id || '',
      note:              expense.note || '',
      is_recurring:      expense.is_recurring || expense.is_recurring_template || false,
      frequency:         expense.frequency || 'monthly',
      next_due_date:     expense.next_due_date
        ? new Date(expense.next_due_date).toISOString().slice(0, 10) : '',
      is_tax_deductible: expense.is_tax_deductible || false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('क्या आप यह खर्च हटाना चाहते हैं?')) return;
    try {
      setDeletingId(expenseId); setError('');
      const res = await fetch(apiUrl(`/api/expenses/${expenseId}`), {
        method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'खर्च delete नहीं हुआ।'); return; }
      setExpenses((c) => c.filter((ex) => ex._id !== expenseId));
      if (editingId === expenseId) resetForm();
      setSuccess('✅ खर्च हटाया गया');
    } catch { setError('खर्च delete नहीं हुआ।'); }
    finally   { setDeletingId(''); }
  };

  /* ── CSV Export via papaparse ── */
  const exportCSV = () => {
    const rows = filteredExpenses.map((e) => ({
      'दिनांक':          new Date(e.date || e.createdAt).toLocaleDateString('en-IN'),
      'Category':        getCategoryLabel(e.category),
      'Amount (₹)':      e.amount,
      'Payment Mode':    e.payment_mode || '',
      'Note':            e.note || '',
      'Reference':       e.reference_id || '',
      'Tax Deductible':  e.is_tax_deductible ? 'Yes' : 'No',
    }));
    const csv  = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <PageShell>

        {/* ── Header ── */}
        <div className="rr-page-hero rr-fade-in">
          <span className="rr-section-label">💸 Expense Management</span>
          <div className="flex items-center justify-between gap-3">
            <PageHeader title="खर्च" subtitle="रोज़ के खर्च का हिसाब" />
            <button onClick={exportCSV} type="button"
              className="flex-shrink-0 flex items-center gap-1.5 border border-slate-300 bg-white text-slate-600 text-[12px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              📥 Export
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { href: '/income',       label: '📈 Income'  },
              { href: '/bank-entries', label: '🏦 Bank'    },
              { href: '/reports',      label: '📊 Reports' },
              { href: '/gst',          label: '🧾 GST'     },
            ].map((l) => (
              <Link key={l.href} href={l.href}
                className="px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-[12px] font-bold text-slate-600 shadow-md hover:border-green-300 hover:bg-green-50 hover:-translate-y-0.5 transition-all">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── KPI strip (templates excluded) ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'कुल खर्च',   value: `₹${fmtShort(totalExpense)}`, sub: `${filteredExpenses.length} entries`,
              gradient: 'from-rose-50 to-red-100',      border: 'border-rose-200',  vc: 'text-rose-800',  icon: '💸' },
            { label: 'Cash खर्च',  value: `₹${fmtShort(cashExpense)}`,  sub: 'cash outflow',
              gradient: 'from-amber-50 to-orange-100',  border: 'border-amber-200', vc: 'text-amber-800', icon: '💵' },
            { label: 'Bank / UPI', value: `₹${fmtShort(bankExpense)}`,  sub: 'digital outflow',
              gradient: 'from-green-50 to-emerald-100', border: 'border-green-200', vc: 'text-green-800', icon: '🏦' },
          ].map((k) => (
            <div key={k.label}
              className={`relative overflow-hidden bg-gradient-to-br ${k.gradient} border-2 ${k.border} rounded-2xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
              <div className="absolute top-2 right-2 text-2xl opacity-10">{k.icon}</div>
              <p className={`text-[20px] font-black leading-none ${k.vc}`}>{k.value}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wide leading-tight">{k.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Alert / success banner ── */}
        {(error || success) && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-semibold ${
            error
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {error ? '⚠️' : '✅'} {error || success}
          </div>
        )}

        {/* ── Add / Edit form ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`h-1 ${editingId
            ? 'bg-gradient-to-r from-amber-400 to-orange-500'
            : 'bg-gradient-to-r from-rose-500 to-orange-500'}`} />
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {editingId ? 'Edit expense' : 'New expense'}
              </p>
              <h2 className="text-[15px] font-black text-slate-900 mt-0.5">
                {editingId ? 'Expense Update करो' : 'Expense Add करो'}
              </h2>
            </div>
            {editingId && (
              <button onClick={resetForm}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleCreateExpense} className="p-5 space-y-3">

            {/* ── Category pills ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                श्रेणी / Category
              </p>
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} type="button"
                    onClick={() => setForm((c) => ({ ...c, category: cat.id }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-bold transition-all ${
                      form.category === cat.id
                        ? 'border-rose-400 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}>
                    <span>{cat.emoji}</span>
                    <span className="truncate">{cat.labelHi}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Amount ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount (₹)</p>
              <input className={INP} type="number" step="0.01" min="0.01" placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
                required />
            </div>

            {/* ── Recurring toggle ── */}
            <div
              className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
              onClick={() => {
                const on = !form.is_recurring;
                setForm((c) => ({
                  ...c,
                  is_recurring:  on,
                  next_due_date: on ? getDefaultNextDueDate(c.frequency) : '',
                }));
              }}>
              <input type="checkbox" className="w-4 h-4 accent-rose-500 flex-shrink-0 pointer-events-none"
                checked={form.is_recurring} readOnly />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-slate-700">यह खर्च हर महीने होता है</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Recurring — due होने पर reminder मिलेगा</p>
              </div>
              <span className="text-base flex-shrink-0">🔄</span>
            </div>

            {form.is_recurring && (
              <div className="space-y-3 p-4 rounded-xl border border-rose-100 bg-rose-50/40">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Frequency / कितने दिन में
                  </p>
                  <div className="flex gap-2">
                    {['weekly', 'monthly', 'quarterly'].map((f) => (
                      <button key={f} type="button"
                        onClick={() => setForm((c) => ({
                          ...c, frequency: f, next_due_date: getDefaultNextDueDate(f),
                        }))}
                        className={`flex-1 py-2 rounded-xl border text-[12px] font-bold transition-all ${
                          form.frequency === f
                            ? 'border-rose-400 bg-rose-500 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}>
                        {FREQ_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    अगला Due Date
                  </p>
                  <input className={INP} type="date" value={form.next_due_date}
                    onChange={(e) => setForm((c) => ({ ...c, next_due_date: e.target.value }))} />
                </div>
              </div>
            )}

            {/* ── Payment mode ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Mode</p>
              <div className="flex gap-2">
                {MODE_OPTIONS.map((mode) => (
                  <button key={mode} type="button"
                    onClick={() => setForm((c) => ({ ...c, payment_mode: mode }))}
                    className={`flex-1 py-2.5 rounded-xl border text-[12px] font-black transition-all ${
                      form.payment_mode === mode
                        ? 'border-rose-400 bg-rose-500 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}>
                    {MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date</p>
                <input className={INP} type="date" value={form.date}
                  onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} required />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Reference</p>
                <input className={INP} placeholder="Bill / cheque no." value={form.reference_id}
                  onChange={(e) => setForm((c) => ({ ...c, reference_id: e.target.value }))} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                टिप्पणी / Narration
              </p>
              <input className={INP} placeholder="किराया, वाहन, मरम्मत, आदि" value={form.note}
                onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} />
            </div>

            {/* ── Tax deductible toggle ── */}
            <div
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer"
              onClick={() => setForm((c) => ({ ...c, is_tax_deductible: !c.is_tax_deductible }))}>
              <input type="checkbox" className="w-4 h-4 accent-green-600 flex-shrink-0 pointer-events-none"
                checked={form.is_tax_deductible} readOnly />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-slate-700">यह खर्च tax में deductible है</p>
                <p className="text-[11px] text-slate-400 mt-0.5">ITR filing के समय काम आएगा</p>
              </div>
              <span className="text-base flex-shrink-0">💰</span>
            </div>

            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-rose-500 to-orange-500 shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 transition-all">
              {saving
                ? '⏳ Saving...'
                : editingId
                  ? '✏️ Update Expense'
                  : form.is_recurring
                    ? '🔄 Recurring खर्च Save करो'
                    : '💾 खर्च Save करो'}
            </button>
          </form>
        </div>

        {/* ── Analytics: top categories + budget progress + trend chart ── */}
        {topCategories.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-green-600 to-blue-500" />
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Spend Split</p>
              <h3 className="text-[14px] font-black text-slate-900 mt-0.5">Top Categories</h3>
              {taxDeductibleTotal > 0 && (
                <p className="text-[11px] font-semibold text-green-700 mt-1">
                  💰 Tax Deductible: ₹{fmtShort(taxDeductibleTotal)} this month
                </p>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {topCategories.map((item) => {
                const budget        = budgets[item.category] || 0;
                const catMonthSpend = monthlySpend.get(item.category) || 0;
                const pct           = budget > 0 ? Math.min(100, Math.round((catMonthSpend / budget) * 100)) : 0;
                const overBudget    = budget > 0 && catMonthSpend >= budget;
                const nearBudget    = budget > 0 && pct >= 70 && !overBudget;
                return (
                  <div key={item.category} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-lg flex-shrink-0">
                      {getCategoryEmoji(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-bold text-slate-900">{getCategoryLabel(item.category)}</p>
                        <p className="text-[15px] font-black text-rose-600 flex-shrink-0">₹{fmtShort(item.amount)}</p>
                      </div>
                      {budget > 0 && (
                        <div className="mt-1.5">
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                overBudget ? 'bg-red-500' : nearBudget ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className={`text-[10px] font-bold ${
                              overBudget ? 'text-red-600' : nearBudget ? 'text-amber-600' : 'text-slate-400'
                            }`}>
                              {overBudget
                                ? '⚠️ Budget पार हो गया!'
                                : `₹${fmtShort(catMonthSpend)} / ₹${fmtShort(budget)}`}
                            </p>
                            <p className={`text-[10px] font-black ${
                              overBudget ? 'text-red-600' : nearBudget ? 'text-amber-700' : 'text-slate-500'
                            }`}>{pct}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monthly Trend SVG chart */}
            {trendData.some((d) => d.total > 0) && (
              <div className="px-5 py-4 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Monthly Trend
                </p>
                <TrendChart data={trendData} />
              </div>
            )}
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
            <input
              className="h-10 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
              placeholder="🔍 नोट, श्रेणी या reference खोजें..."
              value={search}
              onChange={(e) => setSearch(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              <select
                className="flex-1 min-w-[120px] h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">सभी श्रेणियाँ</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.labelHi}</option>
                ))}
              </select>
              <select
                className="flex-1 min-w-[100px] h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}>
                <option value="all">सभी Modes</option>
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
              <button type="button"
                onClick={() => setTaxFilter((v) => !v)}
                className={`h-10 px-3 rounded-xl border text-[12px] font-bold transition-all flex-shrink-0 ${
                  taxFilter
                    ? 'border-green-400 bg-green-50 text-green-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}>
                💰 Tax
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2.5">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton-row" />)}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              emoji="💸"
              title="कोई खर्च दर्ज नहीं"
              subtitle="दुकान का बिजली बिल, किराया, तनख्वाह — सब यहाँ track करें।"
              actionLabel="खर्च जोड़ें"
              onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredExpenses
                .slice()
                .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                .map((expense) => (
                  <div key={expense._id} className="rr-list-row">
                    <div className="rr-icon-btn rr-icon-btn-md text-lg">
                      {getCategoryEmoji(expense.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[13px] font-bold text-slate-900">
                              {getCategoryLabel(expense.category)}
                            </p>
                            {expense.is_tax_deductible && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 border border-green-200">
                                Tax ✓
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[15px] font-black text-rose-600 flex-shrink-0">
                          ₹{fmt(expense.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="rr-pill rr-pill-slate">
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
                          className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDeleteExpense(expense._id)}
                          disabled={deletingId === expense._id}
                          className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors">
                          {deletingId === expense._id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── Recurring templates section ── */}
        {recurringTemplates.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button type="button"
              onClick={() => setShowRecurring((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 text-left hover:bg-slate-50 transition-colors">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recurring Setup</p>
                <h3 className="text-[14px] font-black text-slate-900 mt-0.5">
                  🔄 Recurring खर्च ({recurringTemplates.length})
                </h3>
              </div>
              <span className="text-slate-400 text-[12px] font-bold">
                {showRecurring ? '▲ बंद करो' : '▼ देखो'}
              </span>
            </button>
            {showRecurring && (
              <div className="divide-y divide-slate-50">
                {recurringTemplates.map((t) => {
                  const today     = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isOverdue = t.next_due_date && new Date(t.next_due_date) <= today;
                  return (
                    <div key={t._id} className="rr-list-row">
                      <div className="rr-icon-btn rr-icon-btn-md text-lg">{getCategoryEmoji(t.category)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-bold text-slate-900">{getCategoryLabel(t.category)}</p>
                          <p className="text-[15px] font-black text-rose-600 flex-shrink-0">₹{fmt(t.amount)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            t.frequency === 'monthly'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : t.frequency === 'weekly'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                          }`}>
                            🔄 {FREQ_LABELS[t.frequency] || t.frequency}
                          </span>
                          {t.next_due_date && (
                            <span className={`text-[11px] font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                              {isOverdue ? '⚠️ Due: ' : 'अगला: '}
                              {new Date(t.next_due_date).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>
                        {t.note && (
                          <p className="text-[11px] text-slate-400 mt-1 truncate">{t.note}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => prefillFromTemplate(t)}
                            className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-colors">
                            ➕ अभी Add करो
                          </button>
                          <button onClick={() => startEditExpense(t)}
                            className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleDeleteExpense(t._id)}
                            disabled={deletingId === t._id}
                            className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors">
                            {deletingId === t._id ? 'Deleting...' : '🗑️ Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </PageShell>
    </Layout>
  );
}
