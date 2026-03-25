'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'NA';
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');

export default function UdhaarPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('customers');

  // Lists
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected + ledger
  const [selected, setSelected] = useState(null);   // selected customer or supplier
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Settle modal
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
    } catch { setError('Customers load nahi hue'); }
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
      `Aapke account me abhi Rs ${fmt(customer.totalUdhaar)} baki hai.`,
      `Kripya suvidha anusar payment kar dein.`,
      '',
      `Dhanyavaad`,
    ].join('\n');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // ── Open ledger ──────────────────────────────────────────────────────────────
  const openLedger = async (item) => {
    // Toggle off if same item clicked
    if (selected?._id === item._id) { setSelected(null); setLedger([]); return; }

    setSelected(item);
    setLedger([]);
    setLedgerLoading(true);
    setError('');

    try {
      // Customer: GET /api/customers/:id/udhaar
      // Supplier: GET /api/suppliers/:id/udhaar  (supplierRoutes uses /udhaar)
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res = await fetch(`${API}/api/${base}/${item._id}/udhaar`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      // customerController returns { customer, entries }
      // supplierController returns { supplier, ledger }
      const entries = data.entries || data.ledger || (Array.isArray(data) ? data : []);
      setLedger(entries);
    } catch { setError('Ledger load nahi hua'); }
    setLedgerLoading(false);
  };

  // ── Settle payment ───────────────────────────────────────────────────────────
  const handleSettle = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
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
        setSuccess(`₹${settleAmount} payment recorded ✅`);
        setShowSettle(false);
        setSettleAmount(''); setSettleNote('');

        // ✅ Refresh lists + ledger with updated data
        await fetchAll();

        // Update selected item balance from response or re-fetch
        if (data.customer) {
          setSelected(data.customer);
        } else if (data.balanceDue !== undefined) {
          setSelected(prev => ({ ...prev, totalUdhaar: data.balanceDue }));
        }

        // Refresh ledger
        const ledgerBase = activeTab === 'customers' ? 'customers' : 'suppliers';
        const lRes = await fetch(`${API}/api/${ledgerBase}/${selected._id}/udhaar`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const lData = await lRes.json();
        setLedger(lData.entries || lData.ledger || (Array.isArray(lData) ? lData : []));
      } else {
        setError(data.message || 'Payment failed');
      }
    } catch { setError('Server error'); }
    setSettleLoading(false);
  };

  // ── Computed totals ──────────────────────────────────────────────────────────
  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const list = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';
  const renderLedgerPanel = () => (
    <div className="card" style={{
      border: `1.5px solid ${isCustomer ? '#fecaca' : '#fde68a'}`,
      borderTop: `4px solid ${isCustomer ? '#ef4444' : '#f59e0b'}`,
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="customer-chip-avatar" style={{ width: 42, height: 42, fontSize: 14, background: isCustomer ? '#fee2e2' : '#fef3c7', color: isCustomer ? '#b91c1c' : '#b45309' }}>
            {initials(selected.name)}
          </div>
          <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e' }}>{selected.name}</div>
          {selected.phone && <div style={{ fontSize: 12, color: '#9ca3af' }}>📞 {selected.phone}</div>}
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Transaction History</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isCustomer && selected.phone && selected.totalUdhaar > 0 && (
            <button
              onClick={() => sendReminder(selected)}
              style={{ padding: '9px 16px', background: 'linear-gradient(135deg, #16a34a, #25d366)', color: '#fff', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 24px rgba(22,163,74,0.2)' }}>
              WhatsApp Reminder
            </button>
          )}
          {selected.totalUdhaar > 0 && (
            <button
              onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}
              style={{ padding: '9px 16px', background: isCustomer ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: isCustomer ? '0 12px 24px rgba(5,150,105,0.2)' : '0 12px 24px rgba(217,119,6,0.2)' }}>
              💰 {isCustomer ? 'Payment लें' : 'Payment करें'}
            </button>
          )}
          <button
            onClick={() => { setSelected(null); setLedger([]); }}
            style={{ padding: '9px 14px', background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)', color: '#0f172a', border: '1px solid rgba(148,163,184,0.24)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 20px rgba(15,23,42,0.08)' }}>
            ✕ बंद करें
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {isCustomer ? (
          <>
            <BalanceTile label="कुल बिक्री / Total Sales" value={`₹${fmt(selected.totalSales)}`} color="#374151" bg="#f9fafb" />
            <BalanceTile label="कुल मिला / Received" value={`₹${fmt(selected.totalPaid)}`} color="#10b981" bg="#f0fdf4" />
            <BalanceTile label="बाकी / Due" value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#ef4444' : '#10b981'} bg={selected.totalUdhaar > 0 ? '#fef2f2' : '#f0fdf4'} />
          </>
        ) : (
          <>
            <BalanceTile label="कुल खरीद / Purchased" value={`₹${fmt(selected.totalPurchased)}`} color="#374151" bg="#f9fafb" />
            <BalanceTile label="कुल दिया / Paid" value={`₹${fmt(selected.totalPaid)}`} color="#10b981" bg="#f0fdf4" />
            <BalanceTile label="देना बाकी / Due" value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#f59e0b' : '#10b981'} bg={selected.totalUdhaar > 0 ? '#fffbeb' : '#f0fdf4'} />
          </>
        )}
      </div>

      {ledgerLoading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>⏳ लोड हो रहा है...</div>
      ) : ledger.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>कोई entry नहीं</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>तारीख / Date</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>विवरण / Note</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Debit (+)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Credit (−)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {[...ledger].reverse().map((entry, i) => {
                const isDebit = entry.type === 'debit' || entry.type === 'diya';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151', fontSize: 12 }}>
                      {entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment')}
                      {entry.reference_id && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{entry.reference_id}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                      {isDebit ? `₹${fmt(entry.amount)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {!isDebit ? `₹${fmt(entry.amount)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: (entry.running_balance ?? 0) > 0 ? (isCustomer ? '#ef4444' : '#f59e0b') : '#10b981' }}>
                      ₹{fmt(entry.running_balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="page-shell">
        <section className="hero-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div className="page-title" style={{ color: '#fff', marginBottom: 0 }}>उधार बही / Credit Ledger</div>
            </div>
          </div>
        </section>

        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="metric-card" style={{ cursor: 'default', background: 'linear-gradient(180deg, rgba(255,241,242,0.96), rgba(255,255,255,0.92))' }}>
            <div className="metric-label">Customer Due</div>
            <div className="metric-value" style={{ color: '#ef4444' }}>₹{totalCustomerUdhaar.toFixed(0)}</div>
            <div className="metric-note">{customers.filter(c => c.totalUdhaar > 0).length} pending • {customers.length} total</div>
          </div>
          <div className="metric-card" style={{ cursor: 'default', background: 'linear-gradient(180deg, rgba(255,248,240,0.96), rgba(255,255,255,0.92))' }}>
            <div className="metric-label">Supplier Due</div>
            <div className="metric-value" style={{ color: '#b45309' }}>₹{totalSupplierUdhaar.toFixed(0)}</div>
            <div className="metric-note">{suppliers.filter(s => s.totalUdhaar > 0).length} pending • {suppliers.length} total</div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => switchTab('customers')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: isCustomer ? '#dc2626' : '#f3f4f6', color: isCustomer ? '#fff' : '#374151', transition: 'all 0.2s' }}>
          👥 Customers ({customers.length})
        </button>
        <button
          onClick={() => switchTab('suppliers')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: !isCustomer ? '#b45309' : '#f3f4f6', color: !isCustomer ? '#fff' : '#374151', transition: 'all 0.2s' }}>
          🏭 Suppliers ({suppliers.length})
        </button>
        </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}
      {success && (
        <div className="alert-success">
          {success}
        </div>
      )}

      {loading ? (
        <div className="empty-state">लोड हो रहा है...</div>
      ) : (
        /* ── Main layout: list + ledger panel ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* List */}
          {list.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, marginBottom: 8 }}>{isCustomer ? '👥' : '🏭'}</div>
              <div style={{ fontWeight: 600 }}>
                {isCustomer ? 'कोई customer नहीं' : 'कोई supplier नहीं'}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {isCustomer ? 'Credit sale karo to auto-create hoga' : 'Credit purchase karo to auto-create hoga'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(item => (
                <div key={item._id}>
                  <div
                    onClick={() => openLedger(item)}
                    style={{
                      background: selected?._id === item._id ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92))' : 'rgba(255,255,255,0.9)',
                      borderRadius: 18,
                      padding: '16px 18px',
                      border: `1.5px solid ${selected?._id === item._id
                        ? (isCustomer ? '#ef4444' : '#f59e0b')
                        : 'rgba(0,0,0,0.06)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: selected?._id === item._id ? '0 18px 40px rgba(15,23,42,0.08)' : '0 10px 22px rgba(15,23,42,0.05)',
                      transition: 'border-color 0.2s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="customer-chip-avatar" style={{ width: 42, height: 42, fontSize: 14, background: selected?._id === item._id ? (isCustomer ? '#fee2e2' : '#fef3c7') : '#e2e8f0', color: selected?._id === item._id ? (isCustomer ? '#b91c1c' : '#b45309') : '#334155' }}>
                        {initials(item.name)}
                      </div>
                      <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{item.name}</div>
                      {item.phone && <div style={{ fontSize: 12, color: '#9ca3af' }}>📞 {item.phone}</div>}
                      {item.gstin && <div style={{ fontSize: 11, color: '#6366f1' }}>GSTIN: {item.gstin}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isCustomer && item.phone && item.totalUdhaar > 0 && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); sendReminder(item); }}
                          style={{ padding: '7px 10px', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          WA
                        </button>
                      )}
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.totalUdhaar > 0 ? (isCustomer ? '#ef4444' : '#f59e0b') : '#10b981' }}>
                          ₹{fmt(item.totalUdhaar)}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          {item.totalUdhaar > 0 ? (isCustomer ? 'लेना बाकी' : 'देना बाकी') : 'चुकता ✓'}
                        </div>
                      </div>
                      <div style={{ fontSize: 16, color: '#9ca3af' }}>
                        {selected?._id === item._id ? '▲' : '▼'}
                      </div>
                    </div>
                  </div>
                  {selected?._id === item._id && renderLedgerPanel()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settle Modal ── */}
      {showSettle && selected && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>
              {isCustomer ? '💰 Payment लें / Receive Payment' : '💰 Payment करें / Make Payment'}
            </h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
              {isCustomer ? `Customer: ${selected.name}` : `Supplier: ${selected.name}`}
            </p>

            {/* Outstanding balance */}
            <div style={{ background: isCustomer ? '#fef2f2' : '#fffbeb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>बाकी राशि / Balance Due:</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: isCustomer ? '#ef4444' : '#f59e0b' }}>
                ₹{fmt(selected.totalUdhaar)}
              </span>
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSettle}>
              <div className="form-group">
                <label className="form-label">राशि / Amount ₹ *</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="1"
                  max={selected.totalUdhaar}
                  placeholder={`Max ₹${fmt(selected.totalUdhaar)}`}
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  required />
                {/* Quick amount buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100].map(pct => {
                    const val = parseFloat(((selected.totalUdhaar * pct) / 100).toFixed(2));
                    return (
                      <button key={pct} type="button"
                        onClick={() => setSettleAmount(String(val))}
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                        {pct}% (₹{val})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">नोट / Note</label>
                <input
                  className="form-input"
                  placeholder="Payment note (optional)"
                  value={settleNote}
                  onChange={e => setSettleNote(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={settleLoading}
                  style={{ flex: 1, padding: '10px', background: isCustomer ? '#10b981' : '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {settleLoading ? '⏳ Processing...' : '✅ Confirm Payment'}
                </button>
                <button type="button"
                  onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); }}
                  style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  रद्द / Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}

// ── Small reusable tile ──────────────────────────────────────────────────────
function BalanceTile({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
