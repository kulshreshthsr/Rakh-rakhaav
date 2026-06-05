'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import ReminderTemplateSettings, { loadReminderTemplates } from '../../components/ReminderTemplateSettings';
import { generatePartyStatementHTML } from '../../lib/generatePartyStatement';

/* ─── Constants & pure helpers ───────────────────────────────────────────── */
const getToken  = () => localStorage.getItem('token');
const LEDGER_CACHE_KEY = 'udhaar-page-v1';
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtShort = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};
const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'NA';
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const getMonthFilterValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const getLedgerEntryText = (entry) => [entry.note, entry.reference_id, entry.type].join(' ').toLowerCase();
const getLedgerDetailCacheKey = (kind, id) => `${LEDGER_CACHE_KEY}:${kind}:${id}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

/* Bug 2: party form factory with reminder defaults */
const getEmptyPartyForm = (kind = 'customer') => ({
  name: '', phone: '', gstin: '', email: '', address: '',
  state: '', companyName: '', notes: '', opening_balance: '0', kind,
  reminder_enabled: false, reminder_frequency: 'weekly',
});

/* Feature 5: empty add-entry form */
const getEmptyAddEntryForm = () => ({
  type: 'debit', amount: '', note: '', payment_mode: 'cash',
  date: todayStr(), due_date: '',
});

/* ─── Bug 2: payload builders — pure, outside component ─────────────────── */
function buildCustomerPayload(form) {
  return {
    name:              form.name.trim(),
    phone:             form.phone.trim(),
    gstin:             form.gstin.trim(),
    email:             form.email.trim(),
    address:           form.address.trim(),
    notes:             form.notes.trim(),
    opening_balance:   Number(form.opening_balance || 0),
    reminder_enabled:  Boolean(form.reminder_enabled),
    reminder_frequency: form.reminder_enabled ? (form.reminder_frequency || 'weekly') : null,
  };
}

function buildSupplierPayload(form) {
  return {
    name:              form.name.trim(),
    phone:             form.phone.trim(),
    gstin:             form.gstin.trim(),
    address:           form.address.trim(),
    state:             form.state.trim(),
    companyName:       form.companyName.trim(),
    notes:             form.notes.trim(),
    opening_balance:   Number(form.opening_balance || 0),
    reminder_enabled:  Boolean(form.reminder_enabled),
    reminder_frequency: form.reminder_enabled ? (form.reminder_frequency || 'weekly') : null,
  };
}

/* ─── Bug 4: reminder message builder ───────────────────────────────────── */
function buildReminderMessage(party, templateId = 'reminder') {
  const templates = loadReminderTemplates();
  const template  = templates[templateId] || templates.reminder;
  let shopName = 'हमारी दुकान';
  try { shopName = JSON.parse(localStorage.getItem('user') || '{}')?.shopName || shopName; } catch { /**/ }
  return template
    .replace(/{name}/g,     party.name || 'Customer')
    .replace(/{due}/g,      fmt(party.totalUdhaar || 0))
    .replace(/{paid}/g,     fmt(party.totalPaid   || 0))
    .replace(/{total}/g,    fmt(party.totalSales  || party.totalPurchased || 0))
    .replace(/{shopName}/g, shopName)
    .replace(/{date}/g,     new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
}

/* ─── Small UI helpers ───────────────────────────────────────────────────── */
const INPUT_CLS = 'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

function Avatar({ name, size = 'md' }) {
  const colors = [
    'from-green-600 to-emerald-700', 'from-rose-500 to-pink-600',
    'from-emerald-500 to-teal-600',  'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',  'from-blue-500 to-indigo-600',
  ];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  const dim = size === 'lg' ? 'w-14 h-14 text-[18px]' : size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-11 h-11 text-[14px]';
  return (
    <div className={`${dim} rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm`}>
      {initials(name)}
    </div>
  );
}

function SCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SHead({ title, subtitle, badge, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-black text-slate-900">{title}</p>
          {badge && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{badge}</span>}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function EntryBadge({ type }) {
  const isDebit = type === 'debit' || type === 'diya';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
      isDebit
        ? 'bg-rose-50 border-rose-200 text-rose-700'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
    }`}>
      {isDebit ? '↑ उधार' : '↓ Payment'}
    </span>
  );
}

/* Feature 5: due-date badge */
function DueDateBadge({ dueDate }) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const today = new Date(); today.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / 86_400_000);
  if (diff < 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-[10px] font-black text-rose-700">
      ⚠️ {Math.abs(diff)}d overdue
    </span>
  );
  if (diff === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-700">
      🔔 Due today
    </span>
  );
  if (diff <= 3) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-600">
      🔔 Due in {diff}d
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-500">
      Due: {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function UdhaarPage() {
  const router = useRouter();
  const { showToast } = useToast();

  /* ── Core state ── */
  const [activeTab,           setActiveTab]           = useState('customers');
  const [customers,           setCustomers]           = useState([]);
  const [suppliers,           setSuppliers]           = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [selected,            setSelected]            = useState(null);
  const [ledger,              setLedger]              = useState([]);
  const [ledgerLoading,       setLedgerLoading]       = useState(false);
  const [showSettle,          setShowSettle]          = useState(false);
  const [settleAmount,        setSettleAmount]        = useState('');
  const [settleNote,          setSettleNote]          = useState('');
  const [settlePaymentMode,   setSettlePaymentMode]   = useState('cash');
  const [settleDate,          setSettleDate]          = useState(todayStr);    // Bug 3
  const [settleLoading,       setSettleLoading]       = useState(false);
  const [error,               setError]               = useState('');
  const [success,             setSuccess]             = useState('');
  const [partySearch,         setPartySearch]         = useState('');
  const [ledgerSearch,        setLedgerSearch]        = useState('');
  const [ledgerMonth,         setLedgerMonth]         = useState('');
  const [isOnline,            setIsOnline]            = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheLoaded,         setCacheLoaded]         = useState(false);
  const [cacheUpdatedAt,      setCacheUpdatedAt]      = useState(null);
  const [showPartyModal,      setShowPartyModal]      = useState(false);
  const [partyMode,           setPartyMode]           = useState('create');
  const [partySaving,         setPartySaving]         = useState(false);
  const [partyForm,           setPartyForm]           = useState(() => getEmptyPartyForm('customer'));
  const [agingData,           setAgingData]           = useState(null);
  const [agingLoading,        setAgingLoading]        = useState(false); // eslint-disable-line no-unused-vars
  const [showAging,           setShowAging]           = useState(false);
  const [sortBy,              setSortBy]              = useState('due_desc');
  const [filterDue,           setFilterDue]           = useState('all');
  const [payToast,            setPayToast]            = useState('');

  /* Feature 5: manual entry */
  const [showAddEntry,        setShowAddEntry]        = useState(false);
  const [addEntryForm,        setAddEntryForm]        = useState(getEmptyAddEntryForm);
  const [addEntryLoading,     setAddEntryLoading]     = useState(false);
  const [overduePartyIds,     setOverduePartyIds]     = useState(new Set());

  /* Feature 3: reminder templates */
  const [activeReminderTemplate, setActiveReminderTemplate] = useState('reminder');
  const [showReminderSettings,   setShowReminderSettings]   = useState(false);

  /* Feature 4: automated reminders */
  const reminderCheckedRef                                  = useRef(false);
  const [dueReminderParties,  setDueReminderParties]  = useState([]);
  const [showBulkReminder,    setShowBulkReminder]    = useState(false);
  const [bulkReminderLoading, setBulkReminderLoading] = useState(false);
  const [bulkReminderSent,    setBulkReminderSent]    = useState({});

  /* Feature 1: bulk payment */
  const [showBulkPayment,  setShowBulkPayment]  = useState(false);
  const [bulkDate,         setBulkDate]         = useState(todayStr);
  const [bulkMode,         setBulkMode]         = useState('cash');
  const [bulkRows,         setBulkRows]         = useState([]);
  const [bulkLoading,      setBulkLoading]      = useState(false);
  const [bulkResults,      setBulkResults]      = useState({});

  /* ── Helpers ── */
  const applyCachedSnapshot = (cached) => {
    setCustomers(cached?.customers || []);
    setSuppliers(cached?.suppliers || []);
    setCacheUpdatedAt(cached?.cachedAt || null);
    setCacheLoaded(Boolean(cached));
  };

  const fetchCreditAging = async () => {
    setAgingLoading(true);
    try {
      const res = await fetch(apiUrl('/api/dashboard/credit-aging'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAgingData(data);
    } catch { /**/ }
    finally { setAgingLoading(false); }
  };

  /* Bug 1: null guard — failed fetch must not wipe state */
  async function fetchCustomers() {
    try {
      const res = await fetch(apiUrl('/api/customers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return []; }
      const data = await res.json();
      const next = Array.isArray(data) ? data : null;
      if (next !== null) setCustomers(next);
      return next ?? [];
    } catch {
      setError('Customers load नहीं हुए');
      return [];
    }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch(apiUrl('/api/suppliers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return []; }
      const data = await res.json();
      const next = Array.isArray(data) ? data : null;
      if (next !== null) setSuppliers(next);
      return next ?? [];
    } catch { return []; }
  }

  /* Feature 4: fire once after first fetch */
  const checkDueReminders = useCallback((allParties) => {
    if (reminderCheckedRef.current) return;
    reminderCheckedRef.current = true;
    const now = Date.now();
    const MS  = { daily: 86_400_000, weekly: 7 * 86_400_000, monthly: 30 * 86_400_000 };
    const due = allParties.filter((p) => {
      if (!p.reminder_enabled || !(p.totalUdhaar > 0)) return false;
      if (!p.last_reminded_at) return true;
      const gap = MS[p.reminder_frequency] || MS.weekly;
      return (now - new Date(p.last_reminded_at).getTime()) >= gap;
    });
    setDueReminderParties(due);
    if (due.length > 0) {
      showToast(
        `${due.length} ${due.length > 1 ? 'parties' : 'party'} को reminder भेजना है`,
        'info',
        [{ label: 'Send Now', onClick: () => setShowBulkReminder(true) }]
      );
    }
  }, [showToast]);

  /* Bug 1: fetchAll wraps both fetches in try/catch */
  async function fetchAll() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setLoading(false); return; }
    try {
      const [nextCustomers, nextSuppliers] = await Promise.all([fetchCustomers(), fetchSuppliers()]);
      fetchCreditAging();
      writePageCache(LEDGER_CACHE_KEY, { customers: nextCustomers, suppliers: nextSuppliers });
      setCacheUpdatedAt(new Date().toISOString());
      setCacheLoaded(true);
      checkDueReminders([...nextCustomers, ...nextSuppliers]);
    } finally { setLoading(false); }
  }

  const switchTab = (nextTab) => {
    setActiveTab(nextTab); setSelected(null); setLedger([]);
    setLedgerSearch(''); setLedgerMonth(''); setError(''); setSuccess('');
    setPartySearch(''); setShowAddEntry(false);
  };

  const closePartyModal = () => {
    setShowPartyModal(false); setPartySaving(false); setPartyMode('create');
    setPartyForm(getEmptyPartyForm(activeTab === 'customers' ? 'customer' : 'supplier'));
  };

  const openCreatePartyModal = () => {
    setError(''); setSuccess(''); setPartyMode('create');
    setPartyForm(getEmptyPartyForm(activeTab === 'customers' ? 'customer' : 'supplier'));
    setShowPartyModal(true);
  };

  const openEditPartyModal = (party) => {
    setError(''); setSuccess(''); setPartyMode('edit');
    setPartyForm({
      name:              party?.name || '',
      phone:             party?.phone || '',
      gstin:             party?.gstin || '',
      email:             party?.email || '',
      address:           party?.address || '',
      state:             party?.state || '',
      companyName:       party?.companyName || '',
      notes:             party?.notes || '',
      opening_balance:   String(party?.opening_balance ?? 0),
      kind:              activeTab === 'customers' ? 'customer' : 'supplier',
      reminder_enabled:  Boolean(party?.reminder_enabled),
      reminder_frequency: party?.reminder_frequency || 'weekly',
    });
    setShowPartyModal(true);
  };

  /* Bug 2: refreshLedger extracted as useCallback */
  const refreshLedger = useCallback(async (partyId, base) => {
    try {
      const res = await fetch(apiUrl(`/api/${base}/${partyId}/udhaar`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      const next = data.entries || data.ledger || (Array.isArray(data) ? data : []);
      setLedger(next);
      writePageCache(getLedgerDetailCacheKey(base, partyId), { ledger: next });
      return next;
    } catch { return []; }
  }, []);

  /* Bug 3: settle form reset helper */
  const resetSettleForm = () => {
    setSettleAmount(''); setSettleNote(''); setSettlePaymentMode('cash');
    setSettleDate(todayStr()); setError('');
  };

  /* Bug 4: sendReminder with try/catch + clipboard fallback */
  const sendReminder = useCallback(async (party, templateId) => {
    if (!isOnline) { showToast('Offline mode में WhatsApp reminder नहीं खुलेगा।', 'warning'); return; }
    const phone = cleanPhone(party.phone || '');
    if (!phone) { showToast('इस party का phone number नहीं है', 'error'); return; }
    const msg = buildReminderMessage(party, templateId || activeReminderTemplate);
    try {
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      const base = party.totalSales !== undefined ? 'customers' : 'suppliers';
      fetch(apiUrl(`/api/${base}/${party._id}/remind`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      }).catch(() => {});
    } catch {
      try {
        await navigator.clipboard.writeText(msg);
        showToast('WhatsApp open नहीं हुआ — message clipboard में copy हो गया 📋', 'info');
      } catch {
        showToast('Reminder भेजने में error', 'error');
      }
    }
  }, [isOnline, activeReminderTemplate, showToast]);

  const openLedger = async (item) => {
    if (selected?._id === item._id) { setSelected(null); setLedger([]); setShowAddEntry(false); return; }
    setSelected(item); setLedger([]); setLedgerSearch(''); setLedgerMonth('');
    setShowAddEntry(false); setLedgerLoading(true); setError('');
    const ledgerKind = activeTab === 'customers' ? 'customers' : 'suppliers';
    if (!isOnline) {
      const cached = readPageCache(getLedgerDetailCacheKey(ledgerKind, item._id));
      setLedger(cached?.ledger || []); setLedgerLoading(false); return;
    }
    try {
      const entries = await refreshLedger(item._id, ledgerKind);
      // Feature 5: mark party overdue if any debit entry has passed due_date
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const hasOverdue = entries.some((e) => {
        const isDebit = e.type === 'debit' || e.type === 'diya';
        return isDebit && e.due_date && new Date(e.due_date) < today;
      });
      if (hasOverdue) setOverduePartyIds((prev) => new Set([...prev, item._id]));
    } catch { setError('Ledger could not be loaded'); }
    setLedgerLoading(false);
  };

  /* Bug 1 + Bug 3: handleSettle */
  const handleSettle = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!isOnline) { setError('Offline mode में payment record नहीं होगा।'); return; }
    if (!settleAmount || Number(settleAmount) <= 0) { setError('Valid amount enter करें'); return; }
    setSettleLoading(true);
    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res = await fetch(apiUrl(`/api/${base}/${selected._id}/settle`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          amount:       settleAmount,
          note:         settleNote,
          payment_mode: settlePaymentMode,
          payment_date: settleDate,                  // Bug 3
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const paid   = parseFloat(settleAmount);
        const newDue = Math.max(0, (selected.totalUdhaar || 0) - paid);
        const toastMsg = newDue <= 0
          ? `✓ ${selected.name} का पूरा हिसाब साफ! 🎉`
          : `₹${fmt(paid)} जमा हुआ — ${selected.name} का बाकी ₹${fmt(newDue)}`;
        setShowSettle(false); resetSettleForm();
        setPayToast(toastMsg);
        setTimeout(() => setPayToast(''), 4000);
        const updateParty = (list) => list.map((p) =>
          p._id === selected._id
            ? { ...p, totalUdhaar: newDue, totalPaid: (p.totalPaid || 0) + paid }
            : p
        );
        if (activeTab === 'customers') setCustomers(updateParty);
        else setSuppliers(updateParty);
        setSelected((prev) => prev ? { ...prev, totalUdhaar: newDue, totalPaid: (prev.totalPaid || 0) + paid } : prev);
        // Bug 1: background refresh with catch
        fetchAll().catch(() => showToast('Background sync failed — data may be slightly stale', 'warning'));
        await refreshLedger(selected._id, base);
      } else { setError(data.message || 'Payment failed'); }
    } catch { setError('Server error'); }
    setSettleLoading(false);
  };

  /* Bug 2: handlePartySubmit uses extracted payload builders */
  const handlePartySubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!isOnline) { setError('Offline mode में party save नहीं होगी।'); return; }
    if (!partyForm.name.trim()) {
      setError(`${partyForm.kind === 'customer' ? 'Customer' : 'Supplier'} का नाम ज़रूरी है।`);
      return;
    }
    setPartySaving(true);
    try {
      const isCustomerParty = partyForm.kind === 'customer';
      const base    = isCustomerParty ? 'customers' : 'suppliers';
      const payload = isCustomerParty ? buildCustomerPayload(partyForm) : buildSupplierPayload(partyForm);
      const targetId = partyMode === 'edit' ? selected?._id : '';
      const res = await fetch(apiUrl(`/api/${base}${targetId ? `/${targetId}` : ''}`), {
        method: partyMode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Party save नहीं हुई'); setPartySaving(false); return; }
      await fetchAll();
      if (partyMode === 'edit' && data?._id) {
        setSelected(data);
        await refreshLedger(data._id, base);
      }
      closePartyModal();
      setSuccess(`${isCustomerParty ? 'Customer' : 'Supplier'} ${partyMode === 'edit' ? 'updated' : 'created'} ✓`);
    } catch { setError('Server error'); setPartySaving(false); }
  };

  /* Feature 5: add manual ledger entry */
  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!selected) return;
    if (!addEntryForm.amount || Number(addEntryForm.amount) <= 0) {
      showToast('Valid amount enter करें', 'error'); return;
    }
    setAddEntryLoading(true);
    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const body = {
        type:         addEntryForm.type,
        amount:       addEntryForm.amount,
        note:         addEntryForm.note,
        payment_mode: addEntryForm.payment_mode,
        date:         addEntryForm.date || new Date().toISOString(),
        ...(addEntryForm.type === 'debit' && addEntryForm.due_date
          ? { due_date: addEntryForm.due_date }
          : {}),
      };
      const res = await fetch(apiUrl(`/api/${base}/${selected._id}/udhaar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Entry add नहीं हुई', 'error');
      } else {
        showToast('Entry add हो गई ✓', 'success');
        setShowAddEntry(false);
        setAddEntryForm(getEmptyAddEntryForm());
        fetchAll().catch(() => {});
        const entries = await refreshLedger(selected._id, base);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const hasOverdue = entries.some((en) => {
          const isDebit = en.type === 'debit' || en.type === 'diya';
          return isDebit && en.due_date && new Date(en.due_date) < today;
        });
        if (hasOverdue) setOverduePartyIds((prev) => new Set([...prev, selected._id]));
      }
    } catch { showToast('Server error', 'error'); }
    setAddEntryLoading(false);
  };

  /* Feature 2: download statement */
  const handleDownloadStatement = useCallback(() => {
    if (!selected) return;
    const html = generatePartyStatementHTML(selected, ledger);
    const win = window.open('', '_blank', 'width=860,height=700,scrollbars=yes');
    if (!win) { showToast('Popup blocked — please allow popups for this site', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch { /**/ } }, 400);
  }, [selected, ledger, showToast]);

  /* Feature 4: bulk reminder */
  const executeBulkReminder = async () => {
    setBulkReminderLoading(true);
    const sent = {};
    for (const party of dueReminderParties) {
      try {
        const phone = cleanPhone(party.phone || '');
        if (!phone) { sent[party._id] = 'no-phone'; setBulkReminderSent({ ...sent }); continue; }
        const msg = buildReminderMessage(party, activeReminderTemplate);
        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        sent[party._id] = 'sent';
        const base = party.totalSales !== undefined ? 'customers' : 'suppliers';
        fetch(apiUrl(`/api/${base}/${party._id}/remind`), {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${getToken()}` },
        }).catch(() => {});
        await new Promise((r) => setTimeout(r, 300));
      } catch { sent[party._id] = 'error'; }
      setBulkReminderSent({ ...sent });
    }
    setBulkReminderLoading(false);
    const sentCount = Object.values(sent).filter((v) => v === 'sent').length;
    showToast(`${sentCount} reminder${sentCount !== 1 ? 's' : ''} भेजे गए`, 'success');
  };

  /* Feature 1: bulk payment */
  const openBulkPayment = () => {
    const pending = (activeTab === 'customers' ? customers : suppliers)
      .filter((p) => p.totalUdhaar > 0)
      .map((p) => ({ party: p, amount: String(Math.round(p.totalUdhaar)), checked: true }));
    if (!pending.length) { showToast('कोई pending payment नहीं है', 'info'); return; }
    setBulkRows(pending); setBulkDate(todayStr()); setBulkMode('cash'); setBulkResults({});
    setShowBulkPayment(true);
  };

  const executeBulkPayment = async () => {
    setBulkLoading(true);
    const results = {};
    let successCount = 0;
    const toProcess = bulkRows.filter((r) => r.checked && r.amount && Number(r.amount) > 0);
    for (const row of toProcess) {
      try {
        const base = activeTab === 'customers' ? 'customers' : 'suppliers';
        const res = await fetch(apiUrl(`/api/${base}/${row.party._id}/settle`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ amount: row.amount, payment_mode: bulkMode, payment_date: bulkDate }),
        });
        if (res.ok) { results[row.party._id] = 'ok'; successCount++; }
        else { const d = await res.json(); results[row.party._id] = d.message || 'Error'; }
      } catch { results[row.party._id] = 'Network error'; }
      setBulkResults({ ...results });
    }
    setBulkLoading(false);
    showToast(
      `${successCount}/${toProcess.length} payments record हो गए`,
      successCount === toProcess.length ? 'success' : 'warning'
    );
    await fetchAll().catch(() => {});
    if (successCount === toProcess.length) setShowBulkPayment(false);
  };

  /* ── Effects ── */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(LEDGER_CACHE_KEY);
    if (cached) { applyCachedSnapshot(cached); setLoading(false); }
    else { setCacheLoaded(false); setLoading(true); }
    const deferredId = scheduleDeferred(() => fetchAll());
    return () => cancelDeferred(deferredId);
  }, [router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const on = () => setIsOnline(true); const off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Derived state ── */
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const list       = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';

  const normalizedPartySearch = partySearch.trim().toLowerCase();
  const processedList = list
    .filter((item) => {
      if (filterDue === 'pending') return item.totalUdhaar > 0;
      if (filterDue === 'settled') return item.totalUdhaar <= 0;
      return true;
    })
    .filter((item) => {
      if (!normalizedPartySearch) return true;
      return [item.name, item.phone, item.gstin].join(' ').toLowerCase().includes(normalizedPartySearch);
    })
    .sort((a, b) => {
      if (sortBy === 'due_desc')      return (b.totalUdhaar || 0) - (a.totalUdhaar || 0);
      if (sortBy === 'due_asc')       return (a.totalUdhaar || 0) - (b.totalUdhaar || 0);
      if (sortBy === 'name_asc')      return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'overdue_first') {
        const ao = overduePartyIds.has(a._id), bo = overduePartyIds.has(b._id);
        if (ao !== bo) return bo ? 1 : -1;
        return (b.totalUdhaar || 0) - (a.totalUdhaar || 0);
      }
      return 0;
    });

  const pendingCount = list.filter((i) => i.totalUdhaar > 0).length;
  const settledCount = list.filter((i) => i.totalUdhaar <= 0).length;

  const normalizedLedgerSearch = ledgerSearch.trim().toLowerCase();
  const filteredLedger = [...ledger].reverse().filter((entry) => {
    const matchesSearch = !normalizedLedgerSearch || getLedgerEntryText(entry).includes(normalizedLedgerSearch);
    const matchesMonth  = !ledgerMonth || getMonthFilterValue(entry.date || entry.createdAt) === ledgerMonth;
    return matchesSearch && matchesMonth;
  });
  const hasLedgerFilters = Boolean(normalizedLedgerSearch || ledgerMonth);
  const ledgerDebits  = filteredLedger.filter((e) => e.type === 'debit'  || e.type === 'diya').reduce((s, e) => s + Number(e.amount || 0), 0);
  const ledgerCredits = filteredLedger.filter((e) => e.type !== 'debit'  && e.type !== 'diya').reduce((s, e) => s + Number(e.amount || 0), 0);
  const bulkTotal = bulkRows.filter((r) => r.checked && Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="desktop-expand w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28 space-y-5">

        {/* ══ HERO ═══════════════════════════════════════════════════════ */}
        <div className="rr-page-hero rr-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="rr-section-label">💸 Credit Ledger</span>
              <PageHeader title="उधार" subtitle="ग्राहक और supplier का हिसाब" />
              <div className="mt-2">
                <span className="rr-big-num text-rose-600">
                  <span className="rr-currency-sym text-rose-400">₹</span>
                  {(totalCustomerUdhaar + totalSupplierUdhaar).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
                <span className="ml-2 text-[12px] text-slate-500">कुल बाकी</span>
              </div>
              {!isOnline
                ? <p className="mt-1 text-[11px] font-semibold text-amber-700">📶 Offline snapshot{cacheLabel ? ` · ${cacheLabel}` : ''}</p>
                : cacheLoaded && cacheLabel
                  ? <p className="mt-1 text-[11px] text-slate-400">Last synced {cacheLabel}</p>
                  : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              {/* Feature 3: template settings */}
              <button type="button" onClick={() => setShowReminderSettings(true)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >📋 Templates</button>
              {/* Feature 1: bulk pay */}
              <button type="button" onClick={openBulkPayment}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 transition-all"
              >💳 Bulk Pay</button>
              <button type="button" onClick={() => router.push('/sales?open=1&payment=credit')}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-[13px] font-black text-green-700 shadow-md hover:bg-green-100 transition-all hover:-translate-y-0.5"
              >+ Credit Sale</button>
            </div>
          </div>
        </div>

        {/* ══ OFFLINE BANNER ═════════════════════════════════════════════ */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl flex-shrink-0">📶</span>
            <div>
              <div className="text-[13px] font-black text-amber-800">Offline Ledger View</div>
              <div className="text-[11px] text-amber-600">Cached data दिख रहा है। New payments internet आने पर sync होंगी।</div>
            </div>
          </div>
        )}

        {/* Feature 3: active template style picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400">Reminder style:</span>
          {['friendly', 'reminder', 'urgent'].map((t) => (
            <button key={t} type="button" onClick={() => setActiveReminderTemplate(t)}
              className={`px-3 py-1 rounded-xl text-[11px] font-black border transition-all ${
                activeReminderTemplate === t
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {t === 'friendly' ? '😊 Friendly' : t === 'reminder' ? '🔔 Reminder' : '⚠️ Urgent'}
            </button>
          ))}
        </div>

        {/* ══ MAIN GRID ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── LEFT: KPIs + list ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => switchTab('customers')}
                className={`text-left p-4 lg:p-5 rounded-2xl border-t-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  activeTab === 'customers'
                    ? 'bg-rose-50 border border-rose-200 border-t-rose-500'
                    : 'bg-white border border-slate-200 border-t-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-lg">👥</div>
                  {activeTab === 'customers' && <span className="w-2 h-2 rounded-full bg-rose-500 mt-1" />}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Customer Due</div>
                <div className={`text-[24px] lg:text-[28px] font-black leading-none tracking-tight mb-2 ${totalCustomerUdhaar > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmtShort(totalCustomerUdhaar)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[10px] font-black text-rose-700">
                    {customers.filter((c) => c.totalUdhaar > 0).length} pending
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                    {customers.length} total
                  </span>
                </div>
              </button>

              <button type="button" onClick={() => switchTab('suppliers')}
                className={`text-left p-4 lg:p-5 rounded-2xl border-t-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  activeTab === 'suppliers'
                    ? 'bg-amber-50 border border-amber-200 border-t-amber-500'
                    : 'bg-white border border-slate-200 border-t-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg">🏪</div>
                  {activeTab === 'suppliers' && <span className="w-2 h-2 rounded-full bg-amber-500 mt-1" />}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Supplier Due</div>
                <div className={`text-[24px] lg:text-[28px] font-black leading-none tracking-tight mb-2 ${totalSupplierUdhaar > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {fmtShort(totalSupplierUdhaar)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-black text-amber-700">
                    {suppliers.filter((s) => s.totalUdhaar > 0).length} pending
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                    {suppliers.length} total
                  </span>
                </div>
              </button>
            </div>

            {/* Credit aging */}
            {activeTab === 'customers' && agingData && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <div>
                    <p className="text-[14px] font-black text-slate-900">Credit Ageing</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      कुल बकाया ₹{parseFloat(agingData.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowAging((v) => !v)}
                    className="text-[11px] font-bold text-green-600 hover:text-green-800"
                  >{showAging ? 'Hide ↑' : 'Details ↓'}</button>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-100">
                  {['0-30 days', '31-60 days', '61-90 days', '90+ days'].map((bucket, i) => {
                    const d = agingData.summary?.[bucket] || { count: 0, total: 0 };
                    const colors = ['text-emerald-600', 'text-amber-500', 'text-orange-500', 'text-rose-600'];
                    return (
                      <div key={bucket} className="px-3 py-3 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 leading-tight">{bucket}</p>
                        <p className={`text-[16px] font-black mt-0.5 leading-none ${colors[i]}`}>
                          ₹{parseFloat(d.total || 0) >= 1000
                            ? `${(parseFloat(d.total) / 1000).toFixed(1)}K`
                            : parseFloat(d.total || 0).toFixed(0)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{d.count} party</p>
                      </div>
                    );
                  })}
                </div>
                {showAging && agingData.customers && agingData.customers.length > 0 && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {agingData.customers.slice(0, 20).map((c, idx) => {
                      const bc = {
                        '0-30 days': 'bg-emerald-100 text-emerald-700', '31-60 days': 'bg-amber-100 text-amber-700',
                        '61-90 days': 'bg-orange-100 text-orange-700', '90+ days': 'bg-rose-100 text-rose-700',
                      };
                      const cls = bc[c.agingBucket] || 'bg-slate-100 text-slate-600';
                      return (
                        <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-slate-900 truncate">{c._id?.buyerName || 'Unknown'}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{c.billCount} bill{c.billCount !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{c.agingBucket}</span>
                            <span className="text-[14px] font-black text-rose-600">
                              ₹{parseFloat(c.totalDue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {agingData.customers.length > 20 && (
                      <p className="text-center py-2 text-[11px] text-slate-400">+{agingData.customers.length - 20} more</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Party list */}
            <SCard>
              <SHead
                title={isCustomer ? 'Customers / ग्राहक' : 'Suppliers / आपूर्तिकर्ता'}
                subtitle={isCustomer ? 'Tap to open ledger & record payment' : 'Tap to view transactions & pay dues'}
                badge={`${processedList.length} shown`}
                right={(
                  <button type="button" onClick={openCreatePartyModal}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors ${
                      isCustomer
                        ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                        : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                    }`}
                  >+ Add {isCustomer ? 'Customer' : 'Supplier'}</button>
                )}
              />

              {/* Search + sort + filter */}
              <div className="px-4 py-3 border-b border-slate-100 space-y-3">
                <input
                  className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25 focus:border-rose-400 transition-all"
                  placeholder="🔍 नाम या नंबर से खोजें..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1.5">
                    {[
                      { val: 'all',     label: `All (${list.length})`      },
                      { val: 'pending', label: `Pending (${pendingCount})` },
                      { val: 'settled', label: `Settled (${settledCount})` },
                    ].map((f) => (
                      <button key={f.val} type="button" onClick={() => setFilterDue(f.val)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${
                          filterDue === f.val
                            ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >{f.label}</button>
                    ))}
                  </div>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="ml-auto h-9 px-3 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                  >
                    <option value="due_desc">Highest Due First</option>
                    <option value="due_asc">Lowest Due First</option>
                    <option value="name_asc">Name A→Z</option>
                    <option value="overdue_first">⚠️ Overdue First</option>
                  </select>
                </div>
              </div>

              {/* Alerts */}
              {error && !showSettle && (
                <div className="mx-4 mt-3 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700">
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div className="mx-4 mt-3 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] font-bold text-emerald-700">
                  ✓ {success}
                </div>
              )}

              {/* List body */}
              {loading ? (
                <div className="p-4 space-y-2.5">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton-row" />)}
                </div>
              ) : processedList.length === 0 ? (
                <EmptyState
                  emoji="🤝" title="कोई उधार बाकी नहीं"
                  subtitle="जब कोई customer उधार लेगा, उसका पूरा हिसाब यहाँ दिखेगा।"
                  actionLabel="नई Sale बनाएं" onAction={() => router.push('/sales')}
                  secondaryLabel="यह अच्छी बात है! 😊"
                />
              ) : (
                <div className="divide-y divide-slate-50">
                  {processedList.map((item) => {
                    const isSelected = selected?._id === item._id;
                    const isPending  = item.totalUdhaar > 0;
                    const isOverdue  = overduePartyIds.has(item._id);   // Feature 5
                    return (
                      <div key={item._id}>

                        {/* Party row */}
                        <button type="button" onClick={() => openLedger(item)}
                          className={`rr-list-row w-full text-left ${isSelected ? 'bg-rose-50/60' : ''} ${
                            isOverdue ? 'border-l-4 border-l-rose-400' : ''
                          }`}
                        >
                          <div className={`rr-avatar rr-avatar-md bg-gradient-to-br ${isCustomer ? 'from-green-600 to-emerald-700' : 'from-amber-500 to-orange-600'}`}>
                            {initials(item.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[14px] font-black text-slate-900 truncate">{item.name}</span>
                              {isPending && <span className={`rr-pill ${isCustomer ? 'rr-pill-rose' : 'rr-pill-amber'}`}>बाकी</span>}
                              {!isPending && <span className="rr-pill rr-pill-green">✓ Clear</span>}
                              {isOverdue && <span className="rr-pill rr-pill-rose">⚠️ Overdue</span>}
                              {item.reminder_enabled && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[9px] font-bold text-blue-600">🔔</span>
                              )}
                            </div>
                            {item.phone && <div className="text-[11px] text-slate-400 mt-0.5">📞 {item.phone}</div>}
                            {item.gstin && <div className="text-[10px] text-slate-300 font-mono mt-0.5">{item.gstin}</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isPending && (
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); setSelected(item); setShowSettle(true); resetSettleForm(); }}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[11px] font-black shadow-sm hover:shadow-md hover:-translate-y-px transition-all"
                              >💰 Payment</button>
                            )}
                            {isCustomer && item.phone && isPending && (
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); sendReminder(item); }}
                                className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-sm hover:bg-emerald-100 transition-colors"
                                title="WhatsApp reminder भेजें"
                              >📲</button>
                            )}
                            <div className="text-right flex-shrink-0">
                              <p className={`text-[17px] font-black tracking-tight ${isPending ? (isCustomer ? 'text-rose-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                                {fmtShort(item.totalUdhaar)}
                              </p>
                              <p className="rr-section-label mt-0.5">
                                {isPending ? (isCustomer ? 'बाकी' : 'देना है') : 'Settled'}
                              </p>
                            </div>
                            <span className={`text-slate-300 transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`}>›</span>
                          </div>
                        </button>

                        {/* Inline expanded ledger */}
                        {isSelected && (
                          <div className="border-t border-slate-100 bg-slate-50/50">
                            <div className="px-4 pt-4 pb-3">
                              <div className="flex items-start gap-3 mb-4">
                                <Avatar name={item.name} size="lg" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[16px] font-black text-slate-900">{item.name}</div>
                                  {item.phone && <div className="text-[12px] text-slate-500 mt-0.5">📞 {item.phone}</div>}
                                  {item.gstin && <div className="text-[11px] font-mono text-slate-400 mt-0.5">GSTIN: {item.gstin}</div>}
                                </div>
                              </div>

                              {/* Balance breakdown */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                                {(isCustomer ? [
                                  { label: 'Opening',     val: `₹${fmt(item.opening_balance)}`, color: 'text-green-700',   bg: 'bg-green-50' },
                                  { label: 'Total Sales', val: `₹${fmt(item.totalSales)}`,      color: 'text-slate-700',   bg: 'bg-white' },
                                  { label: 'Received',    val: `₹${fmt(item.totalPaid)}`,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                  { label: 'Due',         val: `₹${fmt(item.totalUdhaar)}`,     color: item.totalUdhaar > 0 ? 'text-rose-600' : 'text-emerald-600', bg: item.totalUdhaar > 0 ? 'bg-rose-50' : 'bg-emerald-50' },
                                ] : [
                                  { label: 'Opening',     val: `₹${fmt(item.opening_balance)}`, color: 'text-green-700',   bg: 'bg-green-50' },
                                  { label: 'Purchased',   val: `₹${fmt(item.totalPurchased)}`,  color: 'text-slate-700',   bg: 'bg-white' },
                                  { label: 'Paid',        val: `₹${fmt(item.totalPaid)}`,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                  { label: 'Due',         val: `₹${fmt(item.totalUdhaar)}`,     color: item.totalUdhaar > 0 ? 'text-amber-600' : 'text-emerald-600', bg: item.totalUdhaar > 0 ? 'bg-amber-50' : 'bg-emerald-50' },
                                ]).map((s) => (
                                  <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 p-2.5 text-center`}>
                                    <div className={`text-[16px] font-black leading-none ${s.color}`}>{s.val}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{s.label}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Action buttons */}
                              <div className="flex flex-wrap gap-2">
                                {item.totalUdhaar > 0 && (
                                  <button type="button"
                                    onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}
                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md hover:-translate-y-px hover:shadow-lg transition-all"
                                  >{isCustomer ? '💰 Receive Payment' : '💸 Make Payment'}</button>
                                )}
                                {isCustomer && item.phone && item.totalUdhaar > 0 && (
                                  <button type="button" onClick={() => sendReminder(item)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all"
                                  >📲 WhatsApp Reminder</button>
                                )}
                                {/* Feature 2: statement */}
                                <button type="button" onClick={handleDownloadStatement}
                                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-all"
                                >📄 Statement</button>
                                <button type="button" onClick={() => openEditPartyModal(item)}
                                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
                                >Edit Party</button>
                                {/* Feature 5: add entry */}
                                <button type="button"
                                  onClick={() => { setShowAddEntry((v) => !v); setAddEntryForm(getEmptyAddEntryForm()); }}
                                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
                                >+ Add Entry</button>
                                <button type="button"
                                  onClick={() => { setSelected(null); setLedger([]); setShowAddEntry(false); }}
                                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                >Close</button>
                              </div>
                            </div>

                            {/* Feature 5: add entry form */}
                            {showAddEntry && (
                              <div className="mx-4 mb-4 p-4 rounded-2xl border-2 border-violet-200 bg-violet-50/50">
                                <p className="text-[12px] font-black text-violet-700 mb-3">Manual Ledger Entry</p>
                                <form onSubmit={handleAddEntry} className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    {['debit', 'credit'].map((t) => (
                                      <button key={t} type="button"
                                        onClick={() => setAddEntryForm((f) => ({ ...f, type: t }))}
                                        className={`py-2 rounded-xl text-[12px] font-black border transition-all ${
                                          addEntryForm.type === t
                                            ? t === 'debit'
                                              ? 'bg-rose-500 border-rose-500 text-white'
                                              : 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                      >{t === 'debit' ? '↑ उधार दिया' : '↓ Payment मिला'}</button>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 mb-1">Amount *</p>
                                      <input className={INPUT_CLS} type="number" step="0.01" min="1"
                                        placeholder="0" value={addEntryForm.amount}
                                        onChange={(e) => setAddEntryForm((f) => ({ ...f, amount: e.target.value }))}
                                        required
                                      />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 mb-1">Date</p>
                                      <input className={INPUT_CLS} type="date" value={addEntryForm.date}
                                        max={todayStr()}
                                        onChange={(e) => setAddEntryForm((f) => ({ ...f, date: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 mb-1">Note</p>
                                    <input className={INPUT_CLS} placeholder="Description..."
                                      value={addEntryForm.note}
                                      onChange={(e) => setAddEntryForm((f) => ({ ...f, note: e.target.value }))}
                                    />
                                  </div>
                                  {addEntryForm.type === 'debit' && (
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 mb-1">Due Date (optional)</p>
                                      <input className={INPUT_CLS} type="date"
                                        value={addEntryForm.due_date}
                                        min={todayStr()}
                                        onChange={(e) => setAddEntryForm((f) => ({ ...f, due_date: e.target.value }))}
                                      />
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <button type="submit" disabled={addEntryLoading}
                                      className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-violet-600 to-purple-700 shadow-md disabled:opacity-60 transition-all"
                                    >{addEntryLoading ? 'Saving...' : 'Add Entry'}</button>
                                    <button type="button" onClick={() => setShowAddEntry(false)}
                                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                    >Cancel</button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {/* Ledger */}
                            <div className="border-t border-slate-100">
                              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                                <p className="text-[13px] font-black text-slate-900">Transaction History</p>
                                {filteredLedger.length > 0 && (
                                  <div className="flex gap-1.5">
                                    <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-[10px] font-black text-rose-600">↑ ₹{fmt(ledgerDebits)}</span>
                                    <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600">↓ ₹{fmt(ledgerCredits)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="px-4 py-3 bg-white border-b border-slate-100">
                                <div className="flex gap-2 flex-col sm:flex-row">
                                  <input
                                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                                    placeholder="Note, reference खोजें..." value={ledgerSearch}
                                    onChange={(e) => setLedgerSearch(e.target.value)}
                                  />
                                  <input
                                    className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all sm:w-40"
                                    type="month" value={ledgerMonth}
                                    onChange={(e) => setLedgerMonth(e.target.value)}
                                  />
                                  {hasLedgerFilters && (
                                    <button type="button" onClick={() => { setLedgerSearch(''); setLedgerMonth(''); }}
                                      className="h-9 px-3 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors whitespace-nowrap"
                                    >Clear</button>
                                  )}
                                </div>
                              </div>

                              {ledgerLoading ? (
                                <div className="p-6 space-y-2">
                                  {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
                                </div>
                              ) : filteredLedger.length === 0 ? (
                                <div className="py-10 text-center">
                                  <div className="text-2xl mb-2">📒</div>
                                  <div className="text-[13px] font-bold text-slate-600">कोई entry नहीं</div>
                                  <div className="text-[11px] text-slate-400 mt-1">पहली transaction होने पर यहाँ दिखेगी</div>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-50">
                                  {filteredLedger.map((entry, i) => {
                                    const isDebit = entry.type === 'debit' || entry.type === 'diya';
                                    const balance = entry.running_balance ?? 0;
                                    return (
                                      <div key={i} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white ${isDebit ? 'bg-rose-50/30' : 'bg-emerald-50/20'}`}>
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${isDebit ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                          {isDebit ? '↑' : '↓'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-[12px] font-bold text-slate-800 truncate">
                                                {entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment Received')}
                                              </div>
                                              {entry.reference_id && (
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{entry.reference_id}</div>
                                              )}
                                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <EntryBadge type={entry.type} />
                                                <span className="text-[10px] text-slate-400">
                                                  {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                                {/* Feature 5: due-date badge on debit entries */}
                                                {isDebit && entry.due_date && (
                                                  <DueDateBadge dueDate={entry.due_date} />
                                                )}
                                              </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                              <div className={`text-[15px] font-black ${isDebit ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {isDebit ? '+' : '-'}₹{fmt(entry.amount)}
                                              </div>
                                              <div className={`text-[10px] font-bold mt-0.5 ${balance > 0 ? (isCustomer ? 'text-rose-400' : 'text-amber-500') : 'text-emerald-500'}`}>
                                                Balance ₹{fmt(balance)}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SCard>
          </div>

          {/* ── RIGHT: summary panel ── */}
          <div className="space-y-4">
            <SCard>
              <SHead title="Overall Position" subtitle="Customer + Supplier combined" />
              <div className="divide-y divide-slate-50">
                {[
                  { label: 'Customer Collect करना', val: fmtShort(totalCustomerUdhaar), color: totalCustomerUdhaar > 0 ? 'text-rose-600' : 'text-emerald-600', bg: 'bg-rose-50' },
                  { label: 'Supplier को देना',       val: fmtShort(totalSupplierUdhaar), color: totalSupplierUdhaar > 0 ? 'text-amber-600' : 'text-emerald-600', bg: 'bg-amber-50' },
                  { label: 'Net Position',
                    val: fmtShort(Math.abs(totalCustomerUdhaar - totalSupplierUdhaar)),
                    color: totalCustomerUdhaar >= totalSupplierUdhaar ? 'text-emerald-600' : 'text-rose-600',
                    bg:    totalCustomerUdhaar >= totalSupplierUdhaar ? 'bg-emerald-50' : 'bg-rose-50' },
                ].map((r) => (
                  <div key={r.label} className={`flex items-center justify-between px-4 py-3.5 ${r.bg}`}>
                    <span className="text-[12px] font-semibold text-slate-700">{r.label}</span>
                    <span className={`text-[16px] font-black ${r.color}`}>{r.val}</span>
                  </div>
                ))}
              </div>
            </SCard>

            {customers.filter((c) => c.totalUdhaar > 0).length > 0 && (
              <SCard>
                <SHead
                  title="Top Pending"
                  subtitle="सबसे ज़्यादा due customers"
                  badge={`${customers.filter((c) => c.totalUdhaar > 0).length}`}
                />
                <div className="divide-y divide-slate-50">
                  {customers
                    .filter((c) => c.totalUdhaar > 0)
                    .sort((a, b) => b.totalUdhaar - a.totalUdhaar)
                    .slice(0, 5)
                    .map((c) => (
                      <button key={c._id} type="button"
                        onClick={() => { switchTab('customers'); openLedger(c); }}
                        className="rr-list-row w-full text-left"
                      >
                        <div className="rr-avatar rr-avatar-sm bg-gradient-to-br from-green-600 to-emerald-700">
                          {initials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black text-slate-900 truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{c.phone || 'No phone'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[17px] font-black text-rose-600 tracking-tight">₹{fmt(c.totalUdhaar)}</p>
                          <p className="rr-section-label mt-0.5">बाकी</p>
                        </div>
                      </button>
                    ))}
                </div>
              </SCard>
            )}

            <SCard>
              <SHead title="Quick Actions" subtitle="जल्दी काम" />
              <div className="p-4 space-y-2.5">
                <button type="button" onClick={() => router.push('/sales?open=1&payment=credit')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-100 bg-rose-50 text-[13px] font-black text-rose-700 hover:bg-rose-100 transition-colors text-left"
                >
                  <span className="text-lg">🧾</span>
                  <div><div>New Credit Sale</div><div className="text-[10px] font-normal text-rose-500">उधार bill बनाएं</div></div>
                </button>
                <button type="button" onClick={() => router.push('/purchases')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-100 bg-amber-50 text-[13px] font-black text-amber-700 hover:bg-amber-100 transition-colors text-left"
                >
                  <span className="text-lg">🛒</span>
                  <div><div>Credit Purchase</div><div className="text-[10px] font-normal text-amber-500">Supplier से credit लें</div></div>
                </button>
                <button type="button" onClick={() => router.push('/sales/customers')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-black text-slate-700 hover:bg-white transition-colors text-left"
                >
                  <span className="text-lg">👥</span>
                  <div><div>Customer Directory</div><div className="text-[10px] font-normal text-slate-400">सभी contacts देखें</div></div>
                </button>
              </div>
            </SCard>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SETTLE PAYMENT MODAL (Bug 3: settleDate)
      ════════════════════════════════════════════════════════════════ */}
      {showSettle && (
        <div className="fixed inset-0 z-[70]">
          <button type="button"
            onClick={() => { setShowSettle(false); resetSettleForm(); }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] md:rounded-3xl md:max-h-[90vh]">
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-5 pb-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {isCustomer ? 'Customer Payment' : 'Supplier Payment'}
                  </p>
                  <h3 className="text-[20px] font-black text-slate-900 mt-0.5">
                    {isCustomer ? '💰 Receive Payment' : '💸 Make Payment'}
                  </h3>
                  <p className="text-[12px] text-slate-400 mt-1">{selected?.name}</p>
                </div>
                <button type="button"
                  onClick={() => { setShowSettle(false); resetSettleForm(); }}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >✕</button>
              </div>

              <div className={`flex items-center justify-between px-4 py-3.5 rounded-2xl mb-5 ${isCustomer ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'}`}>
                <span className="text-[13px] font-bold text-slate-700">Balance Due</span>
                <span className={`text-[22px] font-black ${isCustomer ? 'text-rose-600' : 'text-amber-600'}`}>
                  ₹{fmt(selected?.totalUdhaar)}
                </span>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700 mb-4">
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSettle} className="space-y-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">कितना payment मिला? *</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-black text-slate-400">₹</span>
                    <input
                      className={`h-16 w-full pl-10 pr-4 rounded-xl border text-[24px] font-black text-center text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 transition-all ${
                        isCustomer ? 'border-rose-200 focus:ring-rose-500/20 focus:border-rose-400' : 'border-amber-200 focus:ring-amber-500/20 focus:border-amber-400'
                      }`}
                      type="number" step="0.01" min="1" max={selected?.totalUdhaar}
                      placeholder="0" value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      autoFocus required
                    />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(() => {
                      const due = selected?.totalUdhaar || 0;
                      const r50 = (v) => Math.round(v / 50) * 50 || 50;
                      const chips = [
                        { val: r50(due * 0.25), label: `₹${fmt(r50(due * 0.25))}` },
                        { val: r50(due * 0.50), label: `₹${fmt(r50(due * 0.50))}` },
                        { val: r50(due * 0.75), label: `₹${fmt(r50(due * 0.75))}` },
                        { val: due,             label: `₹${fmt(due)} (पूरा)` },
                      ].filter((c, i, arr) => i === 0 || c.val !== arr[i - 1].val);
                      return chips.map((c) => (
                        <button key={c.val} type="button" onClick={() => setSettleAmount(String(c.val))}
                          className={`flex-1 min-w-0 py-1.5 rounded-xl border text-[11px] font-black transition-colors ${
                            parseFloat(settleAmount) === c.val
                              ? (isCustomer ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-amber-400 bg-amber-50 text-amber-700')
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                          }`}
                        >{c.label}</button>
                      ));
                    })()}
                  </div>
                  {settleAmount && (
                    <div className="mt-2 text-center">
                      <span className={`text-[13px] font-bold ${isCustomer ? 'text-rose-600' : 'text-amber-600'}`}>
                        बाकी रहेगा: ₹{fmt(Math.max(0, (selected?.totalUdhaar || 0) - parseFloat(settleAmount || 0)))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bug 3: payment date */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Payment Date *</p>
                  <input
                    className={INPUT_CLS} type="date" value={settleDate} max={todayStr()}
                    onChange={(e) => setSettleDate(e.target.value)} required
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Note (optional)</p>
                  <input
                    className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    placeholder="Cash, UPI, cheque..."
                    value={settleNote} onChange={(e) => setSettleNote(e.target.value)}
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Payment Mode *</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank' }].map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setSettlePaymentMode(opt.value)}
                        className={`rounded-xl border px-3 py-2 text-[12px] font-black transition-colors ${
                          settlePaymentMode === opt.value
                            ? 'border-cyan-300 bg-green-50 text-green-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={settleLoading}
                    className={`flex-1 py-3.5 rounded-2xl text-[15px] font-black text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all ${
                      isCustomer
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25'
                    }`}
                  >{settleLoading ? 'Processing...' : settleAmount ? `₹${settleAmount} जमा करें` : 'Confirm Payment'}</button>
                  <button type="button"
                    onClick={() => { setShowSettle(false); resetSettleForm(); }}
                    className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PARTY MODAL (Feature 4: reminder toggle)
      ════════════════════════════════════════════════════════════════ */}
      {showPartyModal && (
        <div className="fixed inset-0 z-[75]">
          <button type="button" onClick={closePartyModal}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:max-h-[90vh]">
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-5 pb-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {partyForm.kind === 'customer' ? 'Customer Ledger Setup' : 'Supplier Ledger Setup'}
                  </p>
                  <h3 className="text-[20px] font-black text-slate-900 mt-0.5">
                    {partyMode === 'edit' ? 'Edit party details' : `Add ${partyForm.kind}`}
                  </h3>
                  <p className="text-[12px] text-slate-400 mt-1">Opening balance यहाँ से ledger में carry forward होगा।</p>
                </div>
                <button type="button" onClick={closePartyModal}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >✕</button>
              </div>

              <form onSubmit={handlePartySubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Name *</p>
                    <input className={INPUT_CLS} value={partyForm.name}
                      onChange={(e) => setPartyForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={partyForm.kind === 'customer' ? 'Customer name' : 'Supplier name'} required
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Phone</p>
                    <input className={INPUT_CLS} value={partyForm.phone}
                      onChange={(e) => setPartyForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Mobile number"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">GSTIN</p>
                    <input className={INPUT_CLS} value={partyForm.gstin}
                      onChange={(e) => setPartyForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                      placeholder="GSTIN" maxLength={15}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Opening Balance</p>
                    <input className={INPUT_CLS} type="number" step="0.01" min="0" value={partyForm.opening_balance}
                      onChange={(e) => setPartyForm((f) => ({ ...f, opening_balance: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  {partyForm.kind === 'customer' ? (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Email</p>
                      <input className={INPUT_CLS} type="email" value={partyForm.email}
                        onChange={(e) => setPartyForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="customer@email.com"
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Company</p>
                      <input className={INPUT_CLS} value={partyForm.companyName}
                        onChange={(e) => setPartyForm((f) => ({ ...f, companyName: e.target.value }))}
                        placeholder="Firm / company name"
                      />
                    </div>
                  )}
                  {partyForm.kind === 'supplier' && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">State</p>
                      <input className={INPUT_CLS} value={partyForm.state}
                        onChange={(e) => setPartyForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="State"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Address</p>
                  <textarea className={`${INPUT_CLS} min-h-[88px] py-3`} value={partyForm.address}
                    onChange={(e) => setPartyForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Address"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Notes</p>
                  <textarea className={`${INPUT_CLS} min-h-[88px] py-3`} value={partyForm.notes}
                    onChange={(e) => setPartyForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Extra notes / narration"
                  />
                </div>

                {/* Feature 4: auto-reminder toggle */}
                <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-black text-slate-800">🔔 Auto Reminder</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">WhatsApp reminder automatically भेजें</p>
                    </div>
                    <button type="button"
                      onClick={() => setPartyForm((f) => ({ ...f, reminder_enabled: !f.reminder_enabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${partyForm.reminder_enabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${partyForm.reminder_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {partyForm.reminder_enabled && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 mb-1.5">Frequency</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['daily', 'weekly', 'monthly'].map((f) => (
                          <button key={f} type="button"
                            onClick={() => setPartyForm((pf) => ({ ...pf, reminder_frequency: f }))}
                            className={`py-2 rounded-xl text-[12px] font-black border transition-all ${
                              partyForm.reminder_frequency === f
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'
                            }`}
                          >{f === 'daily' ? 'Daily' : f === 'weekly' ? 'Weekly' : 'Monthly'}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700">
                    ⚠️ {error}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={partySaving}
                    className="flex-1 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-600/25 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
                  >{partySaving ? 'Saving...' : partyMode === 'edit' ? 'Update Party' : 'Create Party'}</button>
                  <button type="button" onClick={closePartyModal}
                    className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          FEATURE 1: BULK PAYMENT DRAWER
      ════════════════════════════════════════════════════════════════ */}
      {showBulkPayment && (
        <div className="fixed inset-0 z-[80]">
          <button type="button" onClick={() => setShowBulkPayment(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:rounded-3xl md:max-h-[90vh]">
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-5 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Bulk Operation</p>
                  <h3 className="text-[20px] font-black text-slate-900 mt-0.5">💳 Bulk Payment</h3>
                  <p className="text-[12px] text-slate-400 mt-1">Multiple parties को एक साथ settle करें।</p>
                </div>
                <button type="button" onClick={() => setShowBulkPayment(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">Payment Date</p>
                  <input className={INPUT_CLS} type="date" value={bulkDate} max={todayStr()}
                    onChange={(e) => setBulkDate(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">Mode</p>
                  <select value={bulkMode} onChange={(e) => setBulkMode(e.target.value)} className={INPUT_CLS}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto mb-4">
                {bulkRows.map((row, i) => {
                  const status = bulkResults[row.party._id];
                  return (
                    <div key={row.party._id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      status === 'ok' ? 'border-emerald-200 bg-emerald-50' :
                      status ? 'border-rose-200 bg-rose-50' :
                      row.checked ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
                    }`}>
                      <input type="checkbox" checked={row.checked} disabled={Boolean(status)}
                        onChange={(e) => setBulkRows((prev) => prev.map((r, j) => j === i ? { ...r, checked: e.target.checked } : r))}
                        className="w-4 h-4 rounded accent-green-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-slate-900 truncate">{row.party.name}</p>
                        <p className="text-[11px] text-slate-400">Due: ₹{fmt(row.party.totalUdhaar)}</p>
                      </div>
                      <input type="number" step="0.01" min="1" max={row.party.totalUdhaar}
                        value={row.amount} disabled={Boolean(status)}
                        onChange={(e) => setBulkRows((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                        className="w-24 h-9 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-black text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-green-500/30 disabled:opacity-50"
                      />
                      {status && (
                        <span className={`text-[12px] font-black ${status === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {status === 'ok' ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
                <span className="text-[13px] font-bold text-slate-700">
                  {bulkRows.filter((r) => r.checked).length} parties selected
                </span>
                <span className="text-[18px] font-black text-emerald-700">₹{fmt(bulkTotal)}</span>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={executeBulkPayment}
                  disabled={bulkLoading || bulkRows.filter((r) => r.checked && Number(r.amount) > 0).length === 0}
                  className="flex-1 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
                >{bulkLoading ? 'Processing...' : `₹${fmt(bulkTotal)} Settle करें`}</button>
                <button type="button" onClick={() => setShowBulkPayment(false)}
                  className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          FEATURE 4: BULK REMINDER MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showBulkReminder && (
        <div className="fixed inset-0 z-[80]">
          <button type="button" onClick={() => setShowBulkReminder(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:rounded-3xl md:max-h-[90vh]">
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-5 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Auto Reminder</p>
                  <h3 className="text-[20px] font-black text-slate-900 mt-0.5">📲 Send Reminders</h3>
                  <p className="text-[12px] text-slate-400 mt-1">{dueReminderParties.length} parties due for reminder</p>
                </div>
                <button type="button" onClick={() => setShowBulkReminder(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >✕</button>
              </div>

              <div className="space-y-2 max-h-[45vh] overflow-y-auto mb-4">
                {dueReminderParties.map((party) => {
                  const status = bulkReminderSent[party._id];
                  return (
                    <div key={party._id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                      status === 'sent'     ? 'border-emerald-200 bg-emerald-50' :
                      status === 'no-phone' ? 'border-amber-200 bg-amber-50' :
                      status === 'error'    ? 'border-rose-200 bg-rose-50' :
                      'border-slate-200 bg-white'
                    }`}>
                      <div className="rr-avatar rr-avatar-sm bg-gradient-to-br from-green-600 to-emerald-700">
                        {initials(party.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-slate-900 truncate">{party.name}</p>
                        <p className="text-[11px] text-slate-400">
                          ₹{fmt(party.totalUdhaar)} बाकी · {party.phone ? `📞 ${party.phone}` : 'No phone'}
                        </p>
                      </div>
                      <span className="text-[12px] font-black">
                        {status === 'sent'     ? '✓ Sent' :
                         status === 'no-phone' ? '📵 No phone' :
                         status === 'error'    ? '✗ Error' : '⏳'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={executeBulkReminder} disabled={bulkReminderLoading}
                  className="flex-1 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-600/25 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 transition-all"
                >{bulkReminderLoading ? 'Sending...' : `Send ${dueReminderParties.length} Reminders`}</button>
                <button type="button" onClick={() => setShowBulkReminder(false)}
                  className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 3: Reminder template settings */}
      {showReminderSettings && (
        <ReminderTemplateSettings onClose={() => setShowReminderSettings(false)} />
      )}

      {/* Payment success toast */}
      {payToast && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border-2 border-green-300 shadow-xl text-[13px] font-bold text-green-800 whitespace-nowrap"
          style={{ animation: 'toastIn 0.2s ease' }}>
          <span>✅</span> {payToast}
        </div>
      )}
    </Layout>
  );
}
