'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { ActionButton, Card, StatCard } from '../../components/ui/AppUI';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const LEDGER_CACHE_KEY = 'udhaar-page-v1';
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'NA';
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const getMonthFilterValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const monthInputWrapStyle = { position: 'relative', minWidth: 180 };
const monthInputHintStyle = {
  position: 'absolute',
  left: 16,
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#9ca3af',
  fontSize: 14,
  pointerEvents: 'none',
};
const getLedgerEntryText = (entry) => [
  entry.note,
  entry.reference_id,
  entry.type,
].join(' ').toLowerCase();
const getLedgerDetailCacheKey = (kind, id) => `${LEDGER_CACHE_KEY}:${kind}:${id}`;

function BalanceTile({ label, value, tone = 'neutral' }) {
  return (
    <div className={`ui-data-row ui-tone-${tone}`}>
      <div className="ui-data-row-label">{label}</div>
      <div className={`ui-data-row-value ${tone === 'success' ? 'ui-value-money' : tone === 'warning' ? 'ui-value-warning' : tone === 'danger' ? 'ui-value-danger' : ''}`}>{value}</div>
    </div>
  );
}

export default function UdhaarPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerMonth, setLedgerMonth] = useState('');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null);

  const applyCachedSnapshot = (cached) => {
    setCustomers(cached?.customers || []);
    setSuppliers(cached?.suppliers || []);
    setCacheUpdatedAt(cached?.cachedAt || null);
    setCacheLoaded(Boolean(cached));
  };

  async function fetchAll() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }
    try {
      const [nextCustomers, nextSuppliers] = await Promise.all([fetchCustomers(), fetchSuppliers()]);
      writePageCache(LEDGER_CACHE_KEY, {
        customers: nextCustomers,
        suppliers: nextSuppliers,
      });
      setCacheUpdatedAt(new Date().toISOString());
      setCacheLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch(apiUrl('/api/customers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextCustomers = Array.isArray(data) ? data : [];
      setCustomers(nextCustomers);
      return nextCustomers;
    } catch {
      setError('Customers load nahi hue');
      return [];
    }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch(apiUrl('/api/suppliers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      const nextSuppliers = Array.isArray(data) ? data : [];
      setSuppliers(nextSuppliers);
      return nextSuppliers;
    } catch {
      return [];
    }
  }

  const switchTab = (nextTab) => {
    setActiveTab(nextTab);
    setSelected(null);
    setLedger([]);
    setLedgerSearch('');
    setLedgerMonth('');
    setError('');
    setSuccess('');
  };

  const fetchCustomerLedgerEntries = async (customerId) => {
    const res = await fetch(apiUrl(`/api/customers/${customerId}/udhaar`), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) {
      throw new Error('Ledger could not be loaded');
    }

    const data = await res.json();
    return data.entries || data.ledger || [];
  };

  const sendReminder = async (customer, entries = []) => {
    if (!isOnline) {
      setError('Offline mode me WhatsApp reminder open nahi hoga.');
      return;
    }
    const phone = cleanPhone(customer.phone || '');
    if (!phone) {
      setError('Is customer ka phone number nahi hai');
      return;
    }

    setError('');

    let ledgerEntries = entries;
    if (!ledgerEntries.length && customer?._id) {
      try {
        ledgerEntries = await fetchCustomerLedgerEntries(customer._id);
      } catch {
        setError('Reminder ke liye ledger load nahi ho paya');
        return;
      }
    }

    const latestDebitEntry = ledgerEntries.find((entry) => entry.type === 'debit' || entry.type === 'diya');
    const productInfo = latestDebitEntry?.note || latestDebitEntry?.reference_id || '';
    const totalSales = Number(customer.totalSales || 0);
    const totalPaid = Number(customer.totalPaid || 0);
    const totalDue = Number(customer.totalUdhaar || 0);

    const msg = [
      `Namaste ${customer.name || 'Customer'} ji,`,
      '',
      'Aapke udhaar account ka short summary bhej rahe hain:',
      ...(productInfo ? [`Product / Bill: ${productInfo}`] : []),
      `Total: ₹${fmt(totalSales)}`,
      `Paid: ₹${fmt(totalPaid)}`,
      `Baaki: ₹${fmt(totalDue)}`,
      '',
      'Kripya suvidha anusar payment kar dein.',
      '',
      'Dhanyavaad',
    ].join('\n');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    const cached = readPageCache(LEDGER_CACHE_KEY);
    if (cached) {
      applyCachedSnapshot(cached);
      setLoading(false);
    } else {
      setCacheLoaded(false);
      setLoading(true);
    }

    const deferredId = scheduleDeferred(() => fetchAll());
    return () => cancelDeferred(deferredId);
  }, [router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const openLedger = async (item) => {
    if (selected?._id === item._id) {
      setSelected(null);
      setLedger([]);
      return;
    }

    setSelected(item);
    setLedger([]);
    setLedgerSearch('');
    setLedgerMonth('');
    setLedgerLoading(true);
    setError('');

    const ledgerKind = activeTab === 'customers' ? 'customers' : 'suppliers';

    if (!isOnline) {
      const cachedLedger = readPageCache(getLedgerDetailCacheKey(ledgerKind, item._id));
      setLedger(cachedLedger?.ledger || []);
      setLedgerLoading(false);
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/${ledgerKind}/${item._id}/udhaar`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      const nextLedger = data.entries || data.ledger || (Array.isArray(data) ? data : []);
      setLedger(nextLedger);
      writePageCache(getLedgerDetailCacheKey(ledgerKind, item._id), {
        ledger: nextLedger,
      });
    } catch {
      setError('Ledger could not be loaded');
    }
    setLedgerLoading(false);
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isOnline) {
      setError('Offline mode me payment record nahi hoga. Internet on karke try karein.');
      return;
    }
    if (!settleAmount || Number(settleAmount) <= 0) {
      setError('Valid amount enter karo');
      return;
    }
    setSettleLoading(true);

    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res = await fetch(apiUrl(`/api/${base}/${selected._id}/settle`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ amount: settleAmount, note: settleNote }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(`₹${settleAmount} payment recorded`);
        setShowSettle(false);
        setSettleAmount('');
        setSettleNote('');
        await fetchAll();

        if (data.customer) {
          setSelected(data.customer);
        } else if (data.balanceDue !== undefined) {
          setSelected((prev) => ({ ...prev, totalUdhaar: data.balanceDue }));
        }

        const ledgerBase = activeTab === 'customers' ? 'customers' : 'suppliers';
        const lRes = await fetch(apiUrl(`/api/${ledgerBase}/${selected._id}/udhaar`), {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const lData = await lRes.json();
        setLedger(lData.entries || lData.ledger || (Array.isArray(lData) ? lData : []));
      } else {
        setError(data.message || 'Payment failed');
      }
    } catch {
      setError('Server error');
    }
    setSettleLoading(false);
  };

  const totalCustomerUdhaar = customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((sum, supplier) => sum + (supplier.totalUdhaar || 0), 0);
  const cacheLabel = cacheUpdatedAt
    ? new Date(cacheUpdatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const list = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';
  const normalizedPartySearch = partySearch.trim().toLowerCase();
  const filteredList = list.filter((item) => {
    if (!normalizedPartySearch) return true;
    return [item.name, item.phone, item.gstin].join(' ').toLowerCase().includes(normalizedPartySearch);
  });
  const normalizedLedgerSearch = ledgerSearch.trim().toLowerCase();
  const filteredLedger = [...ledger]
    .reverse()
    .filter((entry) => {
      const matchesSearch = !normalizedLedgerSearch || getLedgerEntryText(entry).includes(normalizedLedgerSearch);
      const matchesMonth = !ledgerMonth || getMonthFilterValue(entry.date || entry.createdAt) === ledgerMonth;
      return matchesSearch && matchesMonth;
    });
  const hasLedgerFilters = Boolean(normalizedLedgerSearch || ledgerMonth);

  return (
    <Layout>
      <div className="page-shell ledger-shell">
        <section className="hero-panel ledger-hero">
          <div className="page-toolbar">
            <div className="min-w-0">
              <p className="rr-page-eyebrow">Parties &amp; payment follow-up</p>
              <div className="page-title">उधार / Credit Ledger</div>
              {!isOnline ? (
                <p className="rr-meta-line is-warn">
                  Offline snapshot active{cacheLabel ? ` · last updated ${cacheLabel}` : ''}
                </p>
              ) : cacheLoaded && cacheLabel ? (
                <p className="rr-meta-line">Last synced {cacheLabel} · customer aur supplier balance dono yahin milenge</p>
              ) : null}
            </div>
          </div>
        </section>

        {!isOnline ? (
          <div className="rr-banner-warn" role="status">
            <strong>Offline ledger view</strong>
            <div>
              Udhaar page offline snapshot dikha rahi hai. New payments aur fresh ledger updates internet ke saath sync hongi.
            </div>
          </div>
        ) : null}

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <StatCard
            label="Customer Due"
            value={`₹${totalCustomerUdhaar.toFixed(0)}`}
            note={`${customers.filter((item) => item.totalUdhaar > 0).length} pending • ${customers.length} total customers`}
            tone="danger"
          />
          <StatCard
            label="Supplier Due"
            value={`₹${totalSupplierUdhaar.toFixed(0)}`}
            note={`${suppliers.filter((item) => item.totalUdhaar > 0).length} pending • ${suppliers.length} total suppliers`}
            tone="warning"
          />
        </section>

        <div className="ui-segmented">
          <button type="button" onClick={() => switchTab('customers')} className={`ui-segment ${isCustomer ? 'is-active' : ''}`}>
            Customers / ग्राहक ({customers.length})
          </button>
          <button type="button" onClick={() => switchTab('suppliers')} className={`ui-segment ${!isCustomer ? 'is-active' : ''}`}>
            Suppliers / आपूर्तिकर्ता ({suppliers.length})
          </button>
        </div>

        <div className="toolbar-card">
          <div className="toolbar">
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder={isCustomer ? 'Search customer by name, phone or GSTIN...' : 'Search supplier by name, phone or GSTIN...'}
              value={partySearch}
              onChange={(e) => setPartySearch(e.target.value)}
            />
          </div>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}
        {success ? <div className="alert-success">{success}</div> : null}

        {loading ? (
          <div className="ui-empty">Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredList.length === 0 ? (
              <div className="ui-empty ledger-empty-state">
                <div className="ledger-empty-illustration" aria-hidden="true">
                  {isCustomer ? (
                    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                      <rect x="14" y="10" width="28" height="40" rx="8" fill="#EEF2FF" stroke="#3730A3" strokeWidth="2.4" />
                      <path d="M22 22h12M22 30h12M22 38h8" stroke="#3730A3" strokeWidth="2.4" strokeLinecap="round" />
                      <circle cx="48" cy="44" r="10" fill="#DCFCE7" stroke="#16A34A" strokeWidth="2.4" />
                      <path d="M44 44h8M48 40v8" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                      <rect x="12" y="12" width="30" height="38" rx="8" fill="#FFF7ED" stroke="#D97706" strokeWidth="2.4" />
                      <path d="M20 24h14M20 32h14M20 40h10" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" />
                      <circle cx="48" cy="44" r="10" fill="#FEF3C7" stroke="#D97706" strokeWidth="2.4" />
                      <path d="M44 44h8" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{isCustomer ? 'Customers' : 'Suppliers'}</div>
                <div style={{ fontWeight: 700 }}>
                  {isCustomer ? 'No customers found' : 'No suppliers found'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, maxWidth: 280 }}>
                  {isCustomer ? 'Credit sales create entries automatically once you record an udhaar bill.' : 'Credit purchases create entries automatically after supplier bills are added.'}
                </div>
                {isCustomer ? (
                  <ActionButton variant="primary" onClick={() => router.push('/sales?open=1&payment=credit')}>
                    + Record Credit Sale
                  </ActionButton>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredList.map((item) => (
                  <div key={item._id}>
                    <div
                      className={`ui-list-card ${selected?._id === item._id ? 'is-active' : ''}`}
                      onClick={() => openLedger(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div className="ui-avatar">{initials(item.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{item.name}</div>
                          {item.phone ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Phone: {item.phone}</div> : null}
                          {item.gstin ? <div style={{ fontSize: 11, color: '#67e8f9' }}>GSTIN: {item.gstin}</div> : null}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {isCustomer && item.phone && item.totalUdhaar > 0 ? (
                          <ActionButton
                            variant="whatsapp"
                            type="button"
                            onClick={(event) => { event.stopPropagation(); sendReminder(item); }}
                          >
                            WA
                          </ActionButton>
                        ) : null}
                        <div>
                          <div className={item.totalUdhaar > 0 ? (isCustomer ? 'ui-value-danger' : 'ui-value-warning') : 'ui-value-money'} style={{ fontSize: 18 }}>
                            ₹{fmt(item.totalUdhaar)}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            {item.totalUdhaar > 0 ? (isCustomer ? 'Amount to collect' : 'Amount to pay') : 'Settled'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selected?._id === item._id ? (
                      <Card
                        className="ledger-detail-card"
                        title={selected.name}
                        subtitle={selected.phone ? `Phone: ${selected.phone}` : 'Transaction history'}
                        actions={
                          <>
                            {isCustomer && selected.phone && selected.totalUdhaar > 0 ? (
                              <ActionButton variant="whatsapp" onClick={() => sendReminder(selected, ledger)}>
                                WhatsApp Reminder
                              </ActionButton>
                            ) : null}
                            {selected.totalUdhaar > 0 ? (
                              <ActionButton variant="primary" onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}>
                                {isCustomer ? 'Receive Payment' : 'Make Payment'}
                              </ActionButton>
                            ) : null}
                            <ActionButton variant="dark" onClick={() => { setSelected(null); setLedger([]); }}>
                              Close
                            </ActionButton>
                          </>
                        }
                      >
                        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
                          {isCustomer ? (
                            <>
                              <BalanceTile label="Total Sales" value={`₹${fmt(selected.totalSales)}`} />
                              <BalanceTile label="Received" value={`₹${fmt(selected.totalPaid)}`} tone="success" />
                              <BalanceTile label="Due" value={`₹${fmt(selected.totalUdhaar)}`} tone={selected.totalUdhaar > 0 ? 'danger' : 'success'} />
                            </>
                          ) : (
                            <>
                              <BalanceTile label="Purchased" value={`₹${fmt(selected.totalPurchased)}`} />
                              <BalanceTile label="Paid" value={`₹${fmt(selected.totalPaid)}`} tone="success" />
                              <BalanceTile label="Due" value={`₹${fmt(selected.totalUdhaar)}`} tone={selected.totalUdhaar > 0 ? 'warning' : 'success'} />
                            </>
                          )}
                        </div>

                        <div className="toolbar-card" style={{ marginBottom: 16 }}>
                          <div className="toolbar">
                            <input
                              className="form-input"
                              style={{ flex: 1, minWidth: 220 }}
                              placeholder="Search bill note, reference or type..."
                              value={ledgerSearch}
                              onChange={(e) => setLedgerSearch(e.target.value)}
                            />
                            <div style={monthInputWrapStyle}>
                              {!ledgerMonth ? <span style={monthInputHintStyle}>Select month and year</span> : null}
                              <input
                                className="form-input"
                                style={{ minWidth: 180, position: 'relative', background: 'transparent' }}
                                type="month"
                                value={ledgerMonth}
                                onChange={(e) => setLedgerMonth(e.target.value)}
                              />
                            </div>
                            {hasLedgerFilters ? (
                              <button type="button" className="btn-ghost" style={{ width: 'auto' }} onClick={() => { setLedgerSearch(''); setLedgerMonth(''); }}>
                                Clear
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {ledgerLoading ? (
                          <div className="ui-empty">Loading ledger...</div>
                        ) : filteredLedger.length === 0 ? (
                          <div className="ui-empty">{hasLedgerFilters ? 'No ledger entries found for this search/filter.' : 'No entries found'}</div>
                        ) : (
                          <div className="ui-table-wrap">
                            <table className="ui-table compact-ledger-table">
                              <thead>
                                <tr>
                                  <th className="sticky-col">Date</th>
                                  <th className="sticky-col-2">Note</th>
                                  <th style={{ textAlign: 'right' }}>Debit (+)</th>
                                  <th style={{ textAlign: 'right' }}>Credit (-)</th>
                                  <th style={{ textAlign: 'right' }}>Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredLedger.map((entry, index) => {
                                  const isDebit = entry.type === 'debit' || entry.type === 'diya';
                                  return (
                                    <tr key={index} className={isDebit ? 'ledger-debit-row' : 'ledger-credit-row'}>
                                      <td className="sticky-col">{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</td>
                                      <td className="sticky-col-2">
                                        <div>{entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment')}</div>
                                        {entry.reference_id ? <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{entry.reference_id}</div> : null}
                                      </td>
                                      <td style={{ textAlign: 'right' }} className="ui-value-danger">{isDebit ? `₹${fmt(entry.amount)}` : '-'}</td>
                                      <td style={{ textAlign: 'right' }} className="ui-value-money">{!isDebit ? `₹${fmt(entry.amount)}` : '-'}</td>
                                      <td style={{ textAlign: 'right' }} className={(entry.running_balance ?? 0) > 0 ? (isCustomer ? 'ui-value-danger' : 'ui-value-warning') : 'ui-value-money'}>
                                        ₹{fmt(entry.running_balance)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showSettle && selected ? (
          <div className="modal-overlay">
            <div className="modal">
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>
                {isCustomer ? 'Receive Payment' : 'Make Payment'}
              </h3>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>
                {isCustomer ? `Customer: ${selected.name}` : `Supplier: ${selected.name}`}
              </p>

              <div className="ui-data-row" style={{ marginBottom: 14 }}>
                <div className="ui-data-row-label">Balance Due</div>
                <div className={isCustomer ? 'ui-data-row-value ui-value-danger' : 'ui-data-row-value ui-value-warning'}>
                  ₹{fmt(selected.totalUdhaar)}
                </div>
              </div>

              {error ? <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}

              <form onSubmit={handleSettle}>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="1"
                    max={selected.totalUdhaar}
                    placeholder={`Max ₹${fmt(selected.totalUdhaar)}`}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[25, 50, 75, 100].map((pct) => {
                      const value = parseFloat(((selected.totalUdhaar * pct) / 100).toFixed(2));
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSettleAmount(String(value))}
                          className="ui-badge ui-badge-neutral"
                        >
                          {pct}% (₹{value})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input
                    className="form-input"
                    placeholder="Payment note (optional)"
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <ActionButton type="submit" variant="primary" disabled={settleLoading}>
                    {settleLoading ? 'Processing...' : 'Confirm Payment'}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="dark"
                    onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); }}
                  >
                    Cancel
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

