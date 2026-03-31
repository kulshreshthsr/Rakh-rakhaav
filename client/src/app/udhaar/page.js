'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { ActionButton, Card, StatCard } from '../../components/ui/AppUI';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'NA';
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');

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

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchSuppliers()]);
    setLoading(false);
  }

  async function fetchCustomers() {
    try {
      const res = await fetch(apiUrl('/api/customers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setError('Customers load nahi hue');
    }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch(apiUrl('/api/suppliers'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {}
  }

  const switchTab = (nextTab) => {
    setActiveTab(nextTab);
    setSelected(null);
    setLedger([]);
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

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const openLedger = async (item) => {
    if (selected?._id === item._id) {
      setSelected(null);
      setLedger([]);
      return;
    }

    setSelected(item);
    setLedger([]);
    setLedgerLoading(true);
    setError('');

    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res = await fetch(apiUrl(`/api/${base}/${item._id}/udhaar`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setLedger(data.entries || data.ledger || (Array.isArray(data) ? data : []));
    } catch {
      setError('Ledger could not be loaded');
    }
    setLedgerLoading(false);
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
  const list = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';

  return (
    <Layout>
      <div className="page-shell ledger-shell">
        <section className="card ledger-hero">
          <div className="page-toolbar ledger-hero-toolbar">
            <div>
              <div className="page-title" style={{ color: '#1a1a1a', marginBottom: 0 }}>Credit Ledger</div>
              <div className="ledger-hero-subtitle">Track customer and supplier credits</div>
            </div>
          </div>
        </section>

        <section className="ledger-summary-grid">
          <StatCard
            label="Customer Due"
            value={`₹${totalCustomerUdhaar.toFixed(0)}`}
            note={`${customers.filter((item) => item.totalUdhaar > 0).length} pending • ${customers.length} total`}
            tone="danger"
            icon={<LedgerSummaryIcon kind="customer" />}
            className="ledger-summary-card ledger-summary-card-customer"
          />
          <StatCard
            label="Supplier Due"
            value={`₹${totalSupplierUdhaar.toFixed(0)}`}
            note={`${suppliers.filter((item) => item.totalUdhaar > 0).length} pending • ${suppliers.length} total`}
            tone="warning"
            icon={<LedgerSummaryIcon kind="supplier" />}
            className="ledger-summary-card ledger-summary-card-supplier"
          />
        </section>

        <div className="ledger-tabs">
          <button type="button" onClick={() => switchTab('customers')} className={`ledger-tab ${isCustomer ? 'is-active' : ''}`}>
            Customers ({customers.length})
          </button>
          <button type="button" onClick={() => switchTab('suppliers')} className={`ledger-tab ${!isCustomer ? 'is-active' : ''}`}>
            Suppliers ({suppliers.length})
          </button>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}
        {success ? <div className="alert-success">{success}</div> : null}

        {loading ? (
          <div className="ui-empty">Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {list.length === 0 ? (
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
              <div className="ledger-list">
                {list.map((item) => (
                  <div key={item._id}>
                    <div
                      className={`ui-list-card ledger-person-card ${selected?._id === item._id ? 'is-active' : ''}`}
                      onClick={() => openLedger(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="ledger-person-main">
                        <div className="ledger-person-avatar">{initials(item.name)}</div>
                        <div className="ledger-person-copy">
                          <div className="ledger-person-name">{item.name}</div>
                          {item.phone ? (
                            <div className="ledger-person-phone">
                              <LedgerPhoneIcon />
                              <span>{item.phone}</span>
                            </div>
                          ) : null}
                          {item.gstin ? <div style={{ fontSize: 11, color: '#67e8f9' }}>GSTIN: {item.gstin}</div> : null}
                        </div>
                      </div>

                      <div className="ledger-person-side">
                        {isCustomer && item.phone && item.totalUdhaar > 0 ? (
                          <button
                            variant="whatsapp"
                            type="button"
                            className="ledger-wa-button"
                            onClick={(event) => { event.stopPropagation(); sendReminder(item); }}
                          >
                            <LedgerActionIcon kind="whatsapp" />
                          </button>
                        ) : null}
                        <div>
                          <div className={`ledger-person-amount ${item.totalUdhaar > 0 ? (isCustomer ? 'is-danger' : 'is-warning') : 'is-success'}`}>
                            ₹{fmt(item.totalUdhaar)}
                          </div>
                          <div className="ledger-person-note">
                            {item.totalUdhaar > 0 ? (isCustomer ? 'Amount to collect' : 'Amount to pay') : 'Settled'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selected?._id === item._id ? (
                      <Card
                        className="ledger-detail-card"
                        title={
                          <div className="ledger-detail-header-title-wrap">
                            <div className="ledger-detail-header-title">{selected.name}</div>
                            {selected.phone ? (
                              <div className="ledger-detail-header-phone">
                                <LedgerPhoneIcon />
                                <span>{selected.phone}</span>
                              </div>
                            ) : null}
                          </div>
                        }
                        subtitle={isCustomer ? 'Customer transaction history' : 'Supplier transaction history'}
                        actions={
                          <>
                            {isCustomer && selected.phone && selected.totalUdhaar > 0 ? (
                              <ActionButton variant="whatsapp" className="ledger-detail-top-action" onClick={() => sendReminder(selected, ledger)}>
                                <LedgerActionIcon kind="whatsapp" />
                                WhatsApp Reminder
                              </ActionButton>
                            ) : null}
                            {selected.totalUdhaar > 0 ? (
                              <ActionButton variant="primary" className="ledger-detail-top-action" onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}>
                                <LedgerActionIcon kind="payment" />
                                {isCustomer ? 'Receive Payment' : 'Make Payment'}
                              </ActionButton>
                            ) : null}
                            <ActionButton variant="dark" className="ledger-detail-top-action" onClick={() => { setSelected(null); setLedger([]); }}>
                              Close
                            </ActionButton>
                          </>
                        }
                      >
                        <div className="ledger-detail-summary">
                          <div className={`ledger-detail-due ${selected.totalUdhaar > 0 ? (isCustomer ? 'is-danger' : 'is-warning') : 'is-success'}`}>
                            ₹{fmt(selected.totalUdhaar)}
                          </div>
                          <div className="ledger-detail-due-note">
                            {isCustomer ? 'Amount to collect' : 'Amount to pay'}
                          </div>
                        </div>

                        <div className="metric-grid ledger-breakdown-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
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

                        {ledgerLoading ? (
                          <div className="ui-empty">Loading ledger...</div>
                        ) : ledger.length === 0 ? (
                          <div className="ui-empty">No entries found</div>
                        ) : (
                          <div className="ui-table-wrap ledger-table-wrap">
                            <table className="ui-table compact-ledger-table ledger-transaction-table">
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
                                {[...ledger].reverse().map((entry, index) => {
                                  const isDebit = entry.type === 'debit' || entry.type === 'diya';
                                  const noteText = entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment');
                                  const noteLower = String(noteText).toLowerCase();
                                  const rowClass = noteLower.includes('advance')
                                    ? 'is-advance'
                                    : noteLower.includes('sale')
                                      ? 'is-sale'
                                      : '';
                                  return (
                                    <tr key={index} className={`${isDebit ? 'ledger-debit-row' : 'ledger-credit-row'} ${rowClass}`.trim()}>
                                      <td className="sticky-col ledger-date-cell">{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</td>
                                      <td className="sticky-col-2">
                                        <div className="ledger-note-main">{noteText}</div>
                                        {entry.reference_id ? <div className="ledger-note-ref">{entry.reference_id}</div> : null}
                                      </td>
                                      <td style={{ textAlign: 'right' }} className={`ledger-amount-cell ${isDebit ? 'is-debit' : ''}`}>{isDebit ? `₹${fmt(entry.amount)}` : '-'}</td>
                                      <td style={{ textAlign: 'right' }} className={`ledger-amount-cell ${!isDebit ? 'is-credit' : ''}`}>{!isDebit ? `₹${fmt(entry.amount)}` : '-'}</td>
                                      <td style={{ textAlign: 'right' }} className={`ledger-amount-cell ${(entry.running_balance ?? 0) > 0 ? (isCustomer ? 'is-debit' : 'is-warning') : 'is-credit'}`}>
                                        ₹{fmt(entry.running_balance)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="ledger-detail-actions">
                          {isCustomer && selected.phone && selected.totalUdhaar > 0 ? (
                            <ActionButton variant="whatsapp" className="ledger-detail-action-btn" onClick={() => sendReminder(selected, ledger)}>
                              <LedgerActionIcon kind="whatsapp" />
                              WhatsApp Reminder
                            </ActionButton>
                          ) : null}
                          {selected.totalUdhaar > 0 ? (
                            <ActionButton variant="primary" className="ledger-detail-action-btn" onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}>
                              <LedgerActionIcon kind="payment" />
                              {isCustomer ? 'Receive Payment' : 'Make Payment'}
                            </ActionButton>
                          ) : null}
                          <ActionButton variant="dark" className="ledger-detail-action-btn" onClick={() => { setSelected(null); setLedger([]); }}>
                            Close
                          </ActionButton>
                        </div>
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

function LedgerSummaryIcon({ kind }) {
  const commonProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (kind === 'customer') {
    return (
      <svg {...commonProps}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M20 8v6" />
        <path d="M17 11h6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4 7 4v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function LedgerPhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.34 2.71a2 2 0 0 1-.57 1.72l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 1.72-.57l2.71.34A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function LedgerActionIcon({ kind }) {
  const commonProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (kind === 'whatsapp') {
    return (
      <svg {...commonProps}>
        <path d="M20 11.5A8.5 8.5 0 0 1 7.5 19l-4.5 1 1-4.5A8.5 8.5 0 1 1 20 11.5Z" />
        <path d="M9 8.8c.2-.4.4-.4.7-.4h.6c.2 0 .4 0 .5.3l.8 1.8c.1.2.1.4 0 .6l-.5.7c-.1.1-.1.3 0 .5.3.6.8 1.2 1.4 1.7.7.6 1.5 1 2.3 1.3.2.1.4.1.5-.1l.8-.9c.1-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.5v.6c0 .3-.1.6-.4.7-.5.3-1.2.4-1.9.2a10 10 0 0 1-5.5-3.7A9.3 9.3 0 0 1 8.8 10c-.2-.7-.1-1.4.2-1.9Z" />
      </svg>
    );
  }

  if (kind === 'payment') {
    return (
      <svg {...commonProps}>
        <path d="M2 7h20" />
        <path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M16 14h.01" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

