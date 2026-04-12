'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

/* ─── Constants & pure helpers (ALL UNCHANGED) ───────────────────── */
const getToken  = () => localStorage.getItem('token');
const LEDGER_CACHE_KEY = 'udhaar-page-v1';
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtShort = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'NA';
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const getMonthFilterValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const getLedgerEntryText = (entry) => [entry.note, entry.reference_id, entry.type].join(' ').toLowerCase();
const getLedgerDetailCacheKey = (kind, id) => `${LEDGER_CACHE_KEY}:${kind}:${id}`;
const getEmptyPartyForm = (kind = 'customer') => ({
  name: '',
  phone: '',
  gstin: '',
  email: '',
  address: '',
  state: '',
  companyName: '',
  notes: '',
  opening_balance: '0',
  kind,
});

/* ─── Small UI helpers ───────────────────────────────────────────── */
const INPUT_CLS = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25 focus:border-rose-400 transition-all';

/* Avatar with gradient based on name */
function Avatar({ name, size = 'md' }) {
  const colors = [
    'from-cyan-500 to-blue-600', 'from-rose-500 to-pink-600',
    'from-emerald-500 to-teal-600', 'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600', 'from-blue-500 to-indigo-600',
  ];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  const dim = size === 'lg' ? 'w-14 h-14 text-[18px]' : size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-11 h-11 text-[14px]';
  return (
    <div className={`${dim} rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm`}>
      {initials(name)}
    </div>
  );
}

/* Section card wrapper */
function SCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* Section header */
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

/* Ledger entry row type badge */
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

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function UdhaarPage() {
  const router = useRouter();

  /* ── All state (UNCHANGED) ── */
  const [activeTab,       setActiveTab]       = useState('customers');
  const [customers,       setCustomers]       = useState([]);
  const [suppliers,       setSuppliers]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [selected,        setSelected]        = useState(null);
  const [ledger,          setLedger]          = useState([]);
  const [ledgerLoading,   setLedgerLoading]   = useState(false);
  const [showSettle,      setShowSettle]      = useState(false);
  const [settleAmount,    setSettleAmount]    = useState('');
  const [settleNote,      setSettleNote]      = useState('');
  const [settlePaymentMode, setSettlePaymentMode] = useState('cash');
  const [settleLoading,   setSettleLoading]   = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState('');
  const [partySearch,     setPartySearch]     = useState('');
  const [ledgerSearch,    setLedgerSearch]    = useState('');
  const [ledgerMonth,     setLedgerMonth]     = useState('');
  const [isOnline,        setIsOnline]        = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheLoaded,     setCacheLoaded]     = useState(false);
  const [cacheUpdatedAt,  setCacheUpdatedAt]  = useState(null);
  const [showPartyModal,  setShowPartyModal]  = useState(false);
  const [partyMode,       setPartyMode]       = useState('create');
  const [partySaving,     setPartySaving]     = useState(false);
  const [partyForm,       setPartyForm]       = useState(() => getEmptyPartyForm('customer'));

  /* ── NEW: sort + filter state ── */
  const [sortBy,     setSortBy]     = useState('due_desc'); // due_desc | due_asc | name_asc | recent
  const [filterDue,  setFilterDue]  = useState('all');      // all | pending | settled

  /* ── All logic (ALL UNCHANGED) ── */
  const applyCachedSnapshot = (cached) => {
    setCustomers(cached?.customers || []);
    setSuppliers(cached?.suppliers || []);
    setCacheUpdatedAt(cached?.cachedAt || null);
    setCacheLoaded(Boolean(cached));
  };

  async function fetchAll() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setLoading(false); return; }
    try {
      const [nextCustomers, nextSuppliers] = await Promise.all([fetchCustomers(), fetchSuppliers()]);
      writePageCache(LEDGER_CACHE_KEY, { customers: nextCustomers, suppliers: nextSuppliers });
      setCacheUpdatedAt(new Date().toISOString()); setCacheLoaded(true);
    } finally { setLoading(false); }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch(apiUrl('/api/customers'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return []; }
      const data = await res.json();
      const next = Array.isArray(data) ? data : [];
      setCustomers(next); return next;
    } catch { setError('Customers load nahi hue'); return []; }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch(apiUrl('/api/suppliers'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      const next = Array.isArray(data) ? data : [];
      setSuppliers(next); return next;
    } catch { return []; }
  }

  const switchTab = (nextTab) => {
    setActiveTab(nextTab); setSelected(null); setLedger([]);
    setLedgerSearch(''); setLedgerMonth(''); setError(''); setSuccess('');
    setPartySearch('');
  };

  const closePartyModal = () => {
    setShowPartyModal(false);
    setPartySaving(false);
    setPartyMode('create');
    setPartyForm(getEmptyPartyForm(activeTab === 'customers' ? 'customer' : 'supplier'));
  };

  const openCreatePartyModal = () => {
    setError('');
    setSuccess('');
    setPartyMode('create');
    setPartyForm(getEmptyPartyForm(activeTab === 'customers' ? 'customer' : 'supplier'));
    setShowPartyModal(true);
  };

  const openEditPartyModal = (party) => {
    setError('');
    setSuccess('');
    setPartyMode('edit');
    setPartyForm({
      name: party?.name || '',
      phone: party?.phone || '',
      gstin: party?.gstin || '',
      email: party?.email || '',
      address: party?.address || '',
      state: party?.state || '',
      companyName: party?.companyName || '',
      notes: party?.notes || '',
      opening_balance: String(party?.opening_balance ?? 0),
      kind: activeTab === 'customers' ? 'customer' : 'supplier',
    });
    setShowPartyModal(true);
  };

  const fetchCustomerLedgerEntries = async (customerId) => {
    const res = await fetch(apiUrl(`/api/customers/${customerId}/udhaar`), { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('Ledger could not be loaded');
    const data = await res.json();
    return data.entries || data.ledger || [];
  };

  const sendReminder = async (customer, entries = []) => {
    if (!isOnline) { setError('Offline mode me WhatsApp reminder open nahi hoga.'); return; }
    const phone = cleanPhone(customer.phone || '');
    if (!phone) { setError('Is customer ka phone number nahi hai'); return; }
    setError('');
    let ledgerEntries = entries;
    if (!ledgerEntries.length && customer?._id) {
      try { ledgerEntries = await fetchCustomerLedgerEntries(customer._id); }
      catch { setError('Reminder ke liye ledger load nahi ho paya'); return; }
    }
    const latestDebitEntry = ledgerEntries.find((e) => e.type === 'debit' || e.type === 'diya');
    const productInfo = latestDebitEntry?.note || latestDebitEntry?.reference_id || '';
    const totalSales = Number(customer.totalSales || 0);
    const totalPaid  = Number(customer.totalPaid  || 0);
    const totalDue   = Number(customer.totalUdhaar || 0);
    const msg = [
      `Namaste ${customer.name || 'Customer'} ji,`, '',
      'Aapke udhaar account ka short summary bhej rahe hain:',
      ...(productInfo ? [`Product / Bill: ${productInfo}`] : []),
      `Total: ₹${fmt(totalSales)}`, `Paid: ₹${fmt(totalPaid)}`, `Baaki: ₹${fmt(totalDue)}`, '',
      'Kripya suvidha anusar payment kar dein.', '', 'Dhanyavaad',
    ].join('\n');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

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

  const openLedger = async (item) => {
    if (selected?._id === item._id) { setSelected(null); setLedger([]); return; }
    setSelected(item); setLedger([]); setLedgerSearch(''); setLedgerMonth('');
    setLedgerLoading(true); setError('');
    const ledgerKind = activeTab === 'customers' ? 'customers' : 'suppliers';
    if (!isOnline) {
      const cached = readPageCache(getLedgerDetailCacheKey(ledgerKind, item._id));
      setLedger(cached?.ledger || []); setLedgerLoading(false); return;
    }
    try {
      const res = await fetch(apiUrl(`/api/${ledgerKind}/${item._id}/udhaar`), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      const next = data.entries || data.ledger || (Array.isArray(data) ? data : []);
      setLedger(next);
      writePageCache(getLedgerDetailCacheKey(ledgerKind, item._id), { ledger: next });
    } catch { setError('Ledger could not be loaded'); }
    setLedgerLoading(false);
  };

  const handleSettle = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!isOnline) { setError('Offline mode me payment record nahi hoga.'); return; }
    if (!settleAmount || Number(settleAmount) <= 0) { setError('Valid amount enter karo'); return; }
    setSettleLoading(true);
    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res = await fetch(apiUrl(`/api/${base}/${selected._id}/settle`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ amount: settleAmount, note: settleNote, payment_mode: settlePaymentMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`₹${settleAmount} payment recorded ✓`);
        setShowSettle(false); setSettleAmount(''); setSettleNote(''); setSettlePaymentMode('cash');
        await fetchAll();
        if (data.customer) setSelected(data.customer);
        else if (data.balanceDue !== undefined) setSelected((prev) => ({ ...prev, totalUdhaar: data.balanceDue }));
        const ledgerBase = activeTab === 'customers' ? 'customers' : 'suppliers';
        const lRes = await fetch(apiUrl(`/api/${ledgerBase}/${selected._id}/udhaar`), { headers: { Authorization: `Bearer ${getToken()}` } });
        const lData = await lRes.json();
        setLedger(lData.entries || lData.ledger || (Array.isArray(lData) ? lData : []));
      } else { setError(data.message || 'Payment failed'); }
    } catch { setError('Server error'); }
    setSettleLoading(false);
  };

  const handlePartySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isOnline) { setError('Offline mode me party save nahi hogi.'); return; }
    if (!partyForm.name.trim()) { setError(`${partyForm.kind === 'customer' ? 'Customer' : 'Supplier'} name required hai.`); return; }
    setPartySaving(true);
    try {
      const isCustomerParty = partyForm.kind === 'customer';
      const base = isCustomerParty ? 'customers' : 'suppliers';
      const payload = isCustomerParty
        ? {
            name: partyForm.name.trim(),
            phone: partyForm.phone.trim(),
            gstin: partyForm.gstin.trim(),
            email: partyForm.email.trim(),
            address: partyForm.address.trim(),
            notes: partyForm.notes.trim(),
            opening_balance: Number(partyForm.opening_balance || 0),
          }
        : {
            name: partyForm.name.trim(),
            phone: partyForm.phone.trim(),
            gstin: partyForm.gstin.trim(),
            address: partyForm.address.trim(),
            state: partyForm.state.trim(),
            companyName: partyForm.companyName.trim(),
            notes: partyForm.notes.trim(),
            opening_balance: Number(partyForm.opening_balance || 0),
          };
      const targetId = partyMode === 'edit' ? selected?._id : '';
      const res = await fetch(apiUrl(`/api/${base}${targetId ? `/${targetId}` : ''}`), {
        method: partyMode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Party save nahi hui');
        setPartySaving(false);
        return;
      }
      await fetchAll();
      if (partyMode === 'edit' && data?._id) {
        setSelected(data);
        const ledgerBase = partyForm.kind === 'customer' ? 'customers' : 'suppliers';
        const ledgerRes = await fetch(apiUrl(`/api/${ledgerBase}/${data._id}/udhaar`), {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData.entries || ledgerData.ledger || (Array.isArray(ledgerData) ? ledgerData : []));
      }
      closePartyModal();
      setSuccess(`${isCustomerParty ? 'Customer' : 'Supplier'} ${partyMode === 'edit' ? 'updated' : 'created'} ✓`);
    } catch {
      setError('Server error');
      setPartySaving(false);
    }
  };

  /* ── Derived ── */
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const list       = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';

  /* ── NEW: filter + sort pipeline ── */
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
      if (sortBy === 'due_desc') return (b.totalUdhaar || 0) - (a.totalUdhaar || 0);
      if (sortBy === 'due_asc')  return (a.totalUdhaar || 0) - (b.totalUdhaar || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

  const pendingCount  = list.filter((i) => i.totalUdhaar > 0).length;
  const settledCount  = list.filter((i) => i.totalUdhaar <= 0).length;

  const normalizedLedgerSearch = ledgerSearch.trim().toLowerCase();
  const filteredLedger = [...ledger].reverse().filter((entry) => {
    const matchesSearch = !normalizedLedgerSearch || getLedgerEntryText(entry).includes(normalizedLedgerSearch);
    const matchesMonth  = !ledgerMonth || getMonthFilterValue(entry.date || entry.createdAt) === ledgerMonth;
    return matchesSearch && matchesMonth;
  });
  const hasLedgerFilters = Boolean(normalizedLedgerSearch || ledgerMonth);

  /* ledger running totals */
  const ledgerDebits   = filteredLedger.filter((e) => e.type === 'debit' || e.type === 'diya').reduce((s, e) => s + Number(e.amount || 0), 0);
  const ledgerCredits  = filteredLedger.filter((e) => e.type !== 'debit' && e.type !== 'diya').reduce((s, e) => s + Number(e.amount || 0), 0);

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28 space-y-5">

        {/* ══ HERO HEADER ════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-rose-50/40 to-orange-50/30 border border-slate-200 p-5 lg:p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-12 -right-10 w-48 h-48 rounded-full bg-rose-200/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-amber-200/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold uppercase tracking-widest text-rose-700">
                💸 Credit Ledger
              </span>
              <h1 className="mt-2.5 text-[24px] lg:text-[28px] font-black text-slate-900 leading-tight tracking-tight">
                उधार — Parties & Dues
              </h1>
              <p className="mt-1 text-[13px] text-slate-500">
                Customer और Supplier का पूरा हिसाब — collect, pay, remind — सब यहाँ
              </p>
              {!isOnline
                ? <p className="mt-2 text-[11px] font-semibold text-amber-700">📶 Offline snapshot{cacheLabel ? ` · ${cacheLabel}` : ''}</p>
                : cacheLoaded && cacheLabel
                  ? <p className="mt-2 text-[11px] text-slate-400">Last synced {cacheLabel}</p>
                  : null
              }
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => router.push('/sales?open=1&payment=credit')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-[12px] font-black text-rose-700 hover:bg-rose-100 transition-all hover:-translate-y-px"
              >
                + Credit Sale
              </button>
            </div>
          </div>
        </div>

        {/* ══ OFFLINE BANNER ════════════════════════════════════════ */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-xl flex-shrink-0">📶</span>
            <div>
              <div className="text-[13px] font-black text-amber-800">Offline Ledger View</div>
              <div className="text-[11px] text-amber-600">Cached data दिख रहा है। New payments internet आने पर sync होंगी।</div>
            </div>
          </div>
        )}

        {/* ══ MAIN GRID — side by side on desktop ════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── LEFT: KPIs + list (2/3 width) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Customer due */}
              <button
                type="button"
                onClick={() => switchTab('customers')}
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

              {/* Supplier due */}
              <button
                type="button"
                onClick={() => switchTab('suppliers')}
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

            {/* Party list card */}
            <SCard>
              <SHead
                title={isCustomer ? 'Customers / ग्राहक' : 'Suppliers / आपूर्तिकर्ता'}
                subtitle={isCustomer ? 'Tap to open ledger & record payment' : 'Tap to view transactions & pay dues'}
                badge={`${processedList.length} shown`}
                right={(
                  <button
                    type="button"
                    onClick={openCreatePartyModal}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors ${
                      isCustomer ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    + Add {isCustomer ? 'Customer' : 'Supplier'}
                  </button>
                )}
              />

              {/* Search + Sort + Filter controls */}
              <div className="px-4 py-3 border-b border-slate-100 space-y-3">
                <input
                  className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25 focus:border-rose-400 transition-all"
                  placeholder={isCustomer ? '🔍 Name, phone, GSTIN...' : '🔍 Supplier name, phone...'}
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter pills */}
                  <div className="flex gap-1.5">
                    {[
                      { val: 'all',     label: `All (${list.length})`        },
                      { val: 'pending', label: `Pending (${pendingCount})`   },
                      { val: 'settled', label: `Settled (${settledCount})`   },
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
                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="ml-auto h-9 px-3 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                  >
                    <option value="due_desc">Highest Due First</option>
                    <option value="due_asc">Lowest Due First</option>
                    <option value="name_asc">Name A→Z</option>
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
                <div className="p-5 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : processedList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                  <div className="text-4xl mb-3">{isCustomer ? '👥' : '🏪'}</div>
                  <div className="text-[14px] font-black text-slate-700 mb-1">
                    {isCustomer ? 'कोई customer नहीं' : 'कोई supplier नहीं'}
                  </div>
                  <div className="text-[12px] text-slate-400 mb-5 max-w-[260px] leading-relaxed">
                    {isCustomer
                      ? 'Credit sale करने पर customers यहाँ automatically आ जाएंगे'
                      : 'Credit purchase करने पर suppliers यहाँ automatically आ जाएंगे'
                    }
                  </div>
                  {isCustomer && (
                    <button onClick={() => router.push('/sales?open=1&payment=credit')}
                      className="inline-flex items-center px-5 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-rose-500 to-pink-600 shadow-md hover:shadow-lg transition-all"
                    >+ Credit Sale Record करें</button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {processedList.map((item) => {
                    const isSelected  = selected?._id === item._id;
                    const isPending   = item.totalUdhaar > 0;
                    return (
                      <div key={item._id}>
                        {/* Party row */}
                        <button
                          type="button"
                          onClick={() => openLedger(item)}
                          className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all hover:bg-slate-50 ${isSelected ? 'bg-rose-50/60' : ''}`}
                        >
                          <Avatar name={item.name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[14px] font-black text-slate-900 truncate">{item.name}</span>
                              {isPending && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isCustomer ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>बाकी</span>
                              )}
                              {!isPending && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600">✓ Clear</span>
                              )}
                            </div>
                            {item.phone && <div className="text-[11px] text-slate-400 mt-0.5">📞 {item.phone}</div>}
                            {item.gstin && <div className="text-[10px] text-slate-300 font-mono mt-0.5">{item.gstin}</div>}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {/* WhatsApp quick action */}
                            {isCustomer && item.phone && isPending && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); sendReminder(item); }}
                                className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-sm hover:bg-emerald-100 transition-colors"
                                title="Send WhatsApp reminder"
                              >📲</button>
                            )}
                            <div className="text-right">
                              <div className={`text-[18px] font-black leading-none ${isPending ? (isCustomer ? 'text-rose-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                                {fmtShort(item.totalUdhaar)}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {isPending ? (isCustomer ? 'collect करना है' : 'देना है') : 'Settled'}
                              </div>
                            </div>
                            <span className={`text-slate-300 transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`}>›</span>
                          </div>
                        </button>

                        {/* Inline expanded ledger */}
                        {isSelected && (
                          <div className="border-t border-slate-100 bg-slate-50/50">

                            {/* Selected party header */}
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
                                  { label: 'Opening',      val: `₹${fmt(item.opening_balance)}`, color: 'text-cyan-700', bg: 'bg-cyan-50' },
                                  { label: 'Total Sales',  val: `₹${fmt(item.totalSales)}`,      color: 'text-slate-700', bg: 'bg-white' },
                                  { label: 'Received',     val: `₹${fmt(item.totalPaid)}`,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                  { label: 'Due',          val: `₹${fmt(item.totalUdhaar)}`,     color: item.totalUdhaar > 0 ? 'text-rose-600' : 'text-emerald-600', bg: item.totalUdhaar > 0 ? 'bg-rose-50' : 'bg-emerald-50' },
                                ] : [
                                  { label: 'Opening',      val: `₹${fmt(item.opening_balance)}`, color: 'text-cyan-700', bg: 'bg-cyan-50' },
                                  { label: 'Purchased',    val: `₹${fmt(item.totalPurchased)}`,  color: 'text-slate-700', bg: 'bg-white' },
                                  { label: 'Paid',         val: `₹${fmt(item.totalPaid)}`,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                  { label: 'Due',          val: `₹${fmt(item.totalUdhaar)}`,     color: item.totalUdhaar > 0 ? 'text-amber-600' : 'text-emerald-600', bg: item.totalUdhaar > 0 ? 'bg-amber-50' : 'bg-emerald-50' },
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
                                  <button
                                    type="button"
                                    onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}
                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md hover:-translate-y-px hover:shadow-lg transition-all"
                                  >
                                    {isCustomer ? '💰 Receive Payment' : '💸 Make Payment'}
                                  </button>
                                )}
                                {isCustomer && item.phone && item.totalUdhaar > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => sendReminder(item, ledger)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all"
                                  >📲 WhatsApp Reminder</button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditPartyModal(item)}
                                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-cyan-700 border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 transition-colors"
                                >Edit Party</button>
                                <button
                                  type="button"
                                  onClick={() => { setSelected(null); setLedger([]); }}
                                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                >Close</button>
                              </div>
                            </div>

                            {/* Ledger section */}
                            <div className="border-t border-slate-100">
                              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                                <p className="text-[13px] font-black text-slate-900">Transaction History</p>
                                {/* Ledger summary chips */}
                                {filteredLedger.length > 0 && (
                                  <div className="flex gap-1.5">
                                    <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-[10px] font-black text-rose-600">
                                      ↑ ₹{fmt(ledgerDebits)}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600">
                                      ↓ ₹{fmt(ledgerCredits)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Ledger filters */}
                              <div className="px-4 py-3 bg-white border-b border-slate-100">
                                <div className="flex gap-2 flex-col sm:flex-row">
                                  <input
                                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                                    placeholder="Note, reference खोजें..."
                                    value={ledgerSearch}
                                    onChange={(e) => setLedgerSearch(e.target.value)}
                                  />
                                  <input
                                    className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all sm:w-40"
                                    type="month"
                                    value={ledgerMonth}
                                    onChange={(e) => setLedgerMonth(e.target.value)}
                                  />
                                  {hasLedgerFilters && (
                                    <button type="button" onClick={() => { setLedgerSearch(''); setLedgerMonth(''); }}
                                      className="h-9 px-3 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors whitespace-nowrap"
                                    >Clear</button>
                                  )}
                                </div>
                              </div>

                              {/* Ledger entries */}
                              {ledgerLoading ? (
                                <div className="p-6 space-y-2">
                                  {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
                                </div>
                              ) : filteredLedger.length === 0 ? (
                                <div className="py-10 text-center">
                                  <div className="text-2xl mb-2">📒</div>
                                  <div className="text-[13px] font-bold text-slate-600">
                                    {hasLedgerFilters ? 'कोई entry नहीं मिली' : 'No transactions yet'}
                                  </div>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-50">
                                  {filteredLedger.map((entry, i) => {
                                    const isDebit  = entry.type === 'debit' || entry.type === 'diya';
                                    const balance  = entry.running_balance ?? 0;
                                    return (
                                      <div key={i} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white ${isDebit ? 'bg-rose-50/30' : 'bg-emerald-50/20'}`}>
                                        {/* Type indicator */}
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${isDebit ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                          {isDebit ? '↑' : '↓'}
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-[12px] font-bold text-slate-800 truncate">
                                                {entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment Received')}
                                              </div>
                                              {entry.reference_id && (
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{entry.reference_id}</div>
                                              )}
                                              <div className="flex items-center gap-2 mt-1">
                                                <EntryBadge type={entry.type} />
                                                <span className="text-[10px] text-slate-400">
                                                  {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
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

          {/* ── RIGHT: summary panel (1/3 width, desktop only) ── */}
          <div className="space-y-4">

            {/* Overall summary */}
            <SCard>
              <SHead title="Overall Position" subtitle="Customer + Supplier combined" />
              <div className="divide-y divide-slate-50">
                {[
                  { label: 'Customer Collect करना',  val: fmtShort(totalCustomerUdhaar), color: totalCustomerUdhaar > 0 ? 'text-rose-600' : 'text-emerald-600',    bg: 'bg-rose-50'   },
                  { label: 'Supplier को देना',        val: fmtShort(totalSupplierUdhaar), color: totalSupplierUdhaar > 0 ? 'text-amber-600' : 'text-emerald-600',   bg: 'bg-amber-50'  },
                  { label: 'Net Position',            val: fmtShort(Math.abs(totalCustomerUdhaar - totalSupplierUdhaar)),
                    color: totalCustomerUdhaar >= totalSupplierUdhaar ? 'text-emerald-600' : 'text-rose-600',
                    bg: totalCustomerUdhaar >= totalSupplierUdhaar ? 'bg-emerald-50' : 'bg-rose-50'
                  },
                ].map((r) => (
                  <div key={r.label} className={`flex items-center justify-between px-4 py-3.5 ${r.bg}`}>
                    <span className="text-[12px] font-semibold text-slate-700">{r.label}</span>
                    <span className={`text-[16px] font-black ${r.color}`}>{r.val}</span>
                  </div>
                ))}
              </div>
            </SCard>

            {/* Pending alerts */}
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
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => { switchTab('customers'); openLedger(c); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        <Avatar name={c.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-slate-900 truncate">{c.name}</div>
                          {c.phone && <div className="text-[10px] text-slate-400">{c.phone}</div>}
                        </div>
                        <span className="text-[13px] font-black text-rose-600 flex-shrink-0">
                          {fmtShort(c.totalUdhaar)}
                        </span>
                      </button>
                    ))
                  }
                </div>
              </SCard>
            )}

            {/* Quick actions */}
            <SCard>
              <SHead title="Quick Actions" subtitle="जल्दी काम" />
              <div className="p-4 space-y-2.5">
                <button onClick={() => router.push('/sales?open=1&payment=credit')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-100 bg-rose-50 text-[13px] font-black text-rose-700 hover:bg-rose-100 transition-colors text-left"
                >
                  <span className="text-lg">🧾</span>
                  <div>
                    <div>New Credit Sale</div>
                    <div className="text-[10px] font-normal text-rose-500">उधार bill बनाएं</div>
                  </div>
                </button>
                <button onClick={() => router.push('/purchases')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-100 bg-amber-50 text-[13px] font-black text-amber-700 hover:bg-amber-100 transition-colors text-left"
                >
                  <span className="text-lg">🛒</span>
                  <div>
                    <div>Credit Purchase</div>
                    <div className="text-[10px] font-normal text-amber-500">Supplier से credit लें</div>
                  </div>
                </button>
                <button onClick={() => router.push('/sales/customers')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-black text-slate-700 hover:bg-white transition-colors text-left"
                >
                  <span className="text-lg">👥</span>
                  <div>
                    <div>Customer Directory</div>
                    <div className="text-[10px] font-normal text-slate-400">सभी contacts देखें</div>
                  </div>
                </button>
              </div>
            </SCard>

          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          SETTLE PAYMENT MODAL
      ════════════════════════════════════════════════════════════ */}
      <div className={`fixed inset-0 z-[70] transition-opacity duration-300 ${showSettle ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button type="button" onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); setSettlePaymentMode('cash'); }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <div className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] md:rounded-3xl ${showSettle ? 'translate-y-0' : 'translate-y-full md:translate-y-[-40%] md:opacity-0'}`}>

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          <div className="px-6 pt-5 pb-6">
            {/* Header */}
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
                onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); setSettlePaymentMode('cash'); }}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >✕</button>
            </div>

            {/* Balance due */}
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
              {/* Amount */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Amount *</p>
                <input
                  className={`h-12 w-full px-4 rounded-xl border text-[18px] font-black text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 transition-all ${
                    isCustomer ? 'border-rose-200 focus:ring-rose-500/20 focus:border-rose-400' : 'border-amber-200 focus:ring-amber-500/20 focus:border-amber-400'
                  }`}
                  type="number" step="0.01" min="1"
                  max={selected?.totalUdhaar}
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                />
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => {
                    const val = parseFloat(((selected?.totalUdhaar * pct) / 100).toFixed(2));
                    return (
                      <button key={pct} type="button" onClick={() => setSettleAmount(String(val))}
                        className="flex-1 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-black text-slate-600 hover:border-slate-300 hover:bg-white transition-colors"
                      >{pct}%</button>
                    );
                  })}
                </div>
                {settleAmount && (
                  <div className="mt-2 text-center">
                    <span className={`text-[13px] font-bold ${isCustomer ? 'text-rose-600' : 'text-amber-600'}`}>
                      Remaining: ₹{fmt(Math.max(0, (selected?.totalUdhaar || 0) - parseFloat(settleAmount || 0)))}
                    </span>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Note (optional)</p>
                <input
                  className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                  placeholder="Cash, UPI, cheque..."
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Payment Mode *</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'cash', label: 'Cash' },
                    { value: 'upi', label: 'UPI' },
                    { value: 'bank', label: 'Bank' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSettlePaymentMode(option.value)}
                      className={`rounded-xl border px-3 py-2 text-[12px] font-black transition-colors ${
                        settlePaymentMode === option.value
                          ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={settleLoading}
                  className={`flex-1 py-3.5 rounded-2xl text-[15px] font-black text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all ${
                    isCustomer
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25'
                  }`}
                >
                  {settleLoading ? 'Processing...' : 'Confirm Payment'}
                </button>
                <button type="button"
                  onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); setSettlePaymentMode('cash'); }}
                  className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className={`fixed inset-0 z-[75] transition-opacity duration-300 ${showPartyModal ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button
          type="button"
          onClick={closePartyModal}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <div className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 md:inset-auto md:top-1/2 md:left-1/2 md:w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl ${showPartyModal ? 'translate-y-0' : 'translate-y-full md:translate-y-[-40%] md:opacity-0'}`}>
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
                <p className="text-[12px] text-slate-400 mt-1">Opening balance yahin se ledger me carry forward hoga.</p>
              </div>
              <button
                type="button"
                onClick={closePartyModal}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >✕</button>
            </div>

            <form onSubmit={handlePartySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Name *</p>
                  <input className={INPUT_CLS} value={partyForm.name} onChange={(e) => setPartyForm((current) => ({ ...current, name: e.target.value }))} placeholder={partyForm.kind === 'customer' ? 'Customer name' : 'Supplier name'} required />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Phone</p>
                  <input className={INPUT_CLS} value={partyForm.phone} onChange={(e) => setPartyForm((current) => ({ ...current, phone: e.target.value }))} placeholder="Mobile number" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">GSTIN</p>
                  <input className={INPUT_CLS} value={partyForm.gstin} onChange={(e) => setPartyForm((current) => ({ ...current, gstin: e.target.value.toUpperCase() }))} placeholder="GSTIN" maxLength={15} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Opening Balance</p>
                  <input className={INPUT_CLS} type="number" step="0.01" min="0" value={partyForm.opening_balance} onChange={(e) => setPartyForm((current) => ({ ...current, opening_balance: e.target.value }))} placeholder="0.00" />
                </div>
                {partyForm.kind === 'customer' ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Email</p>
                    <input className={INPUT_CLS} type="email" value={partyForm.email} onChange={(e) => setPartyForm((current) => ({ ...current, email: e.target.value }))} placeholder="customer@email.com" />
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Company</p>
                    <input className={INPUT_CLS} value={partyForm.companyName} onChange={(e) => setPartyForm((current) => ({ ...current, companyName: e.target.value }))} placeholder="Firm / company name" />
                  </div>
                )}
                {partyForm.kind === 'supplier' && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">State</p>
                    <input className={INPUT_CLS} value={partyForm.state} onChange={(e) => setPartyForm((current) => ({ ...current, state: e.target.value }))} placeholder="State" />
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Address</p>
                <textarea className={`${INPUT_CLS} min-h-[88px] py-3`} value={partyForm.address} onChange={(e) => setPartyForm((current) => ({ ...current, address: e.target.value }))} placeholder="Address" />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Notes</p>
                <textarea className={`${INPUT_CLS} min-h-[88px] py-3`} value={partyForm.notes} onChange={(e) => setPartyForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Extra notes / narration" />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={partySaving}
                  className="flex-1 py-3.5 rounded-2xl text-[15px] font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all"
                >
                  {partySaving ? 'Saving...' : partyMode === 'edit' ? 'Update Party' : 'Create Party'}
                </button>
                <button
                  type="button"
                  onClick={closePartyModal}
                  className="px-5 py-3.5 rounded-2xl border border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
