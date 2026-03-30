'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { ActionButton, Card, StatCard } from '../../components/ui/AppUI';

const API = 'https://rakh-rakhaav.onrender.com';
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
      const res = await fetch(`${API}/api/customers`, {
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
      const res = await fetch(`${API}/api/suppliers`, {
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

  const sendReminder = (customer) => {
    const phone = cleanPhone(customer.phone || '');
    if (!phone) {
      setError('Is customer ka phone number nahi hai');
      return;
    }
    const msg = [
      `Namaste ${customer.name || 'Customer'} ji,`,
      '',
      `Aapke account me abhi ₹${fmt(customer.totalUdhaar)} baki hai.`,
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
      const res = await fetch(`${API}/api/${base}/${item._id}/udhaar`, {
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
      const res = await fetch(`${API}/api/${base}/${selected._id}/settle`, {
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
        const lRes = await fetch(`${API}/api/${ledgerBase}/${selected._id}/udhaar`, {
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
        <section className="card">
          <div className="page-toolbar">
            <div className="page-title" style={{ color: '#0f172a', marginBottom: 0 }}>Credit Ledger</div>
          </div>
        </section>

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <StatCard
            label="Customer Due"
            value={`₹${totalCustomerUdhaar.toFixed(0)}`}
            note={`${customers.filter((item) => item.totalUdhaar > 0).length} pending • ${customers.length} total`}
            tone="danger"
          />
          <StatCard
            label="Supplier Due"
            value={`₹${totalSupplierUdhaar.toFixed(0)}`}
            note={`${suppliers.filter((item) => item.totalUdhaar > 0).length} pending • ${suppliers.length} total`}
            tone="warning"
          />
        </section>

        <div className="ui-segmented">
          <button type="button" onClick={() => switchTab('customers')} className={`ui-segment ${isCustomer ? 'is-active' : ''}`}>
            Customers ({customers.length})
          </button>
          <button type="button" onClick={() => switchTab('suppliers')} className={`ui-segment ${!isCustomer ? 'is-active' : ''}`}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {list.map((item) => (
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
                              <ActionButton variant="whatsapp" onClick={() => sendReminder(selected)}>
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

                        {ledgerLoading ? (
                          <div className="ui-empty">Loading ledger...</div>
                        ) : ledger.length === 0 ? (
                          <div className="ui-empty">No entries found</div>
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
                                {[...ledger].reverse().map((entry, index) => {
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
      <style>{`
        .ledger-shell .ledger-hero { border: 1px solid rgba(191, 219, 254, 0.85); }

        .ledger-shell .ledger-detail-card {
          margin-top: 12px;
        }

        .ledger-shell .ui-list-card:hover {
          border-color: rgba(59, 130, 246, 0.28);
        }

        .ledger-shell .ledger-empty-state {
          min-height: 52vh;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          text-align: center;
          padding: 28px 20px;
        }

        .ledger-shell .ledger-empty-illustration {
          width: 88px;
          height: 88px;
          border-radius: 28px;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border: 1px solid #e2e8f0;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
          margin-bottom: 2px;
        }
      `}</style>
    </Layout>
  );
}

