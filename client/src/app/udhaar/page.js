'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API      = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt      = (n) => parseFloat(n || 0).toFixed(2);

export default function UdhaarPage() {
  const router = useRouter();
  const [activeTab, setActiveTab]   = useState('customers');
  const [customers, setCustomers]   = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [ledger, setLedger]         = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote]   = useState('');
  const [settleLoading, setSettleLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, []);

  useEffect(() => { setSelected(null); setLedger([]); setError(''); setSuccess(''); }, [activeTab]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchSuppliers()]);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API}/api/customers`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch { setError('Customers load nahi hue'); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API}/api/suppliers`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {}
  };

  const openLedger = async (item) => {
    if (selected?._id === item._id) { setSelected(null); setLedger([]); return; }
    setSelected(item); setLedger([]); setLedgerLoading(true); setError('');
    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res  = await fetch(`${API}/api/${base}/${item._id}/udhaar`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setLedger(data.entries || data.ledger || (Array.isArray(data) ? data : []));
    } catch { setError('Ledger load nahi hua'); }
    setLedgerLoading(false);
  };

  const handleSettle = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!settleAmount || Number(settleAmount) <= 0) { setError('Valid amount enter karo'); return; }
    setSettleLoading(true);
    try {
      const base = activeTab === 'customers' ? 'customers' : 'suppliers';
      const res  = await fetch(`${API}/api/${base}/${selected._id}/settle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ amount: settleAmount, note: settleNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`₹${settleAmount} payment recorded ✅`);
        setShowSettle(false); setSettleAmount(''); setSettleNote('');
        await fetchAll();
        if (data.customer) setSelected(data.customer);
        else if (data.balanceDue !== undefined) setSelected(prev => ({ ...prev, totalUdhaar: data.balanceDue }));
        const ledgerBase = activeTab === 'customers' ? 'customers' : 'suppliers';
        const lRes = await fetch(`${API}/api/${ledgerBase}/${selected._id}/udhaar`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const lData = await lRes.json();
        setLedger(lData.entries || lData.ledger || (Array.isArray(lData) ? lData : []));
      } else setError(data.message || 'Payment failed');
    } catch { setError('Server error'); }
    setSettleLoading(false);
  };

  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const list       = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';

  return (
    <Layout>
      <div style={{ marginBottom: 22 }}>
        <div className="page-title" style={{ marginBottom: 2 }}>उधार बही / Credit Ledger</div>
        <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Customers & Suppliers credit management</div>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: 'var(--radius)', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#EF4444', borderRadius: '14px 14px 0 0' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>👥 Customer से लेना है</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#EF4444', letterSpacing: -1, lineHeight: 1 }}>₹{totalCustomerUdhaar.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>
            <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>{customers.filter(c => c.totalUdhaar > 0).length} pending</span>
            <span style={{ marginLeft: 6 }}>· {customers.length} total</span>
          </div>
        </div>
        <div style={{ background: '#FFFBEB', border: '2px solid #FDE68A', borderRadius: 'var(--radius)', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#F59E0B', borderRadius: '14px 14px 0 0' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🏭 Supplier को देना है</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#D97706', letterSpacing: -1, lineHeight: 1 }}>₹{totalSupplierUdhaar.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>
            <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>{suppliers.filter(s => s.totalUdhaar > 0).length} pending</span>
            <span style={{ marginLeft: 6 }}>· {suppliers.length} total</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 4, border: '1px solid var(--border)' }}>
        <button onClick={() => setActiveTab('customers')} style={{
          flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)',
          background: isCustomer ? '#EF4444' : 'transparent',
          color: isCustomer ? '#fff' : 'var(--text-3)',
          boxShadow: isCustomer ? '0 2px 8px rgba(239,68,68,0.3)' : 'none',
          transition: 'all 0.18s',
        }}>👥 Customers ({customers.length})</button>
        <button onClick={() => setActiveTab('suppliers')} style={{
          flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)',
          background: !isCustomer ? '#D97706' : 'transparent',
          color: !isCustomer ? '#fff' : 'var(--text-3)',
          boxShadow: !isCustomer ? '0 2px 8px rgba(217,119,6,0.3)' : 'none',
          transition: 'all 0.18s',
        }}>🏭 Suppliers ({suppliers.length})</button>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #FECACA' }}>⚠️ {error}</div>}
      {success && <div style={{ background: '#F0FDF4', color: '#059669', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #BBF7D0', fontWeight: 600 }}>✅ {success}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, color: 'var(--text-4)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: isCustomer ? '#EF4444' : '#D97706', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          लोड हो रहा है...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '50px 24px', color: 'var(--text-4)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>{isCustomer ? '👥' : '🏭'}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-2)', marginBottom: 4 }}>{isCustomer ? 'कोई customer नहीं' : 'कोई supplier नहीं'}</div>
              <div style={{ fontSize: 13 }}>{isCustomer ? 'Credit sale karo to auto-create hoga' : 'Credit purchase karo to auto-create hoga'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(item => {
                const isSelected = selected?._id === item._id;
                const accentColor = isCustomer ? '#EF4444' : '#D97706';
                return (
                  <div key={item._id} onClick={() => openLedger(item)} style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 18px',
                    border: `1.5px solid ${isSelected ? accentColor : 'var(--border)'}`,
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    boxShadow: isSelected ? `0 4px 16px ${isCustomer ? 'rgba(239,68,68,0.12)' : 'rgba(217,119,6,0.12)'}` : 'var(--shadow-sm)',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = isCustomer ? '#FECACA' : '#FDE68A'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{item.name}</div>
                      {item.phone && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>📞 {item.phone}</div>}
                      {item.gstin && <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600, marginTop: 1 }}>GSTIN: {item.gstin}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: item.totalUdhaar > 0 ? accentColor : '#22C55E', letterSpacing: -0.5 }}>
                          ₹{fmt(item.totalUdhaar)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {item.totalUdhaar > 0 ? (isCustomer ? 'लेना बाकी' : 'देना बाकी') : 'चुकता ✓'}
                        </div>
                      </div>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: isSelected ? accentColor : 'var(--surface-3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: isSelected ? '#fff' : 'var(--text-4)',
                        transition: 'all 0.18s',
                      }}>
                        {isSelected ? '▲' : '▼'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Ledger Panel ── */}
          {selected && (
            <div className="card" style={{
              border: `2px solid ${isCustomer ? '#FECACA' : '#FDE68A'}`,
              borderTop: `4px solid ${isCustomer ? '#EF4444' : '#D97706'}`,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{selected.name}</div>
                  {selected.phone && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>📞 {selected.phone}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Transaction History</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.totalUdhaar > 0 && (
                    <button onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}
                      style={{ padding: '9px 16px', background: isCustomer ? '#059669' : '#D97706', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: isCustomer ? '0 2px 8px rgba(5,150,105,0.3)' : '0 2px 8px rgba(217,119,6,0.3)' }}>
                      💰 {isCustomer ? 'Payment लें' : 'Payment करें'}
                    </button>
                  )}
                  <button onClick={() => { setSelected(null); setLedger([]); }}
                    style={{ padding: '9px 14px', background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                    ✕ बंद करें
                  </button>
                </div>
              </div>

              {/* Balance tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
                {isCustomer ? (
                  <>
                    <BalanceTile label="कुल बिक्री" value={`₹${fmt(selected.totalSales)}`} color="var(--text-2)" bg="var(--surface-2)" />
                    <BalanceTile label="कुल मिला"   value={`₹${fmt(selected.totalPaid)}`}  color="#059669"  bg="#F0FDF4" />
                    <BalanceTile label="बाकी / Due"  value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#EF4444' : '#059669'} bg={selected.totalUdhaar > 0 ? '#FEF2F2' : '#F0FDF4'} />
                  </>
                ) : (
                  <>
                    <BalanceTile label="कुल खरीद"   value={`₹${fmt(selected.totalPurchased)}`} color="var(--text-2)" bg="var(--surface-2)" />
                    <BalanceTile label="कुल दिया"    value={`₹${fmt(selected.totalPaid)}`}       color="#059669"  bg="#F0FDF4" />
                    <BalanceTile label="देना बाकी"   value={`₹${fmt(selected.totalUdhaar)}`}    color={selected.totalUdhaar > 0 ? '#D97706' : '#059669'} bg={selected.totalUdhaar > 0 ? '#FFFBEB' : '#F0FDF4'} />
                  </>
                )}
              </div>

              {/* Ledger entries */}
              {ledgerLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 24 }}>⏳ लोड हो रहा है...</div>
              ) : ledger.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 24 }}>कोई entry नहीं</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)' }}>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>तारीख</th>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>विवरण</th>
                        <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>Debit (+)</th>
                        <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>Credit (−)</th>
                        <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ledger].reverse().map((entry, i) => {
                        const isDebit = entry.type === 'debit' || entry.type === 'diya';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-2)', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '11px 14px', color: 'var(--text-4)', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-2)' }}>
                              <div>{entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment')}</div>
                              {entry.reference_id && <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{entry.reference_id}</div>}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>
                              {isDebit ? `₹${fmt(entry.amount)}` : '—'}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              {!isDebit ? `₹${fmt(entry.amount)}` : '—'}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: (entry.running_balance ?? 0) > 0 ? (isCustomer ? '#EF4444' : '#D97706') : '#22C55E', fontSize: 13 }}>
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
          )}
        </div>
      )}

      {/* ── Settle Modal ── */}
      {showSettle && selected && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {isCustomer ? '💰 Payment लें' : '💰 Payment करें'}
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                  {isCustomer ? `Customer: ${selected.name}` : `Supplier: ${selected.name}`}
                </div>
              </div>
              <button onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); }}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>✕</button>
            </div>

            <div style={{ background: isCustomer ? '#FEF2F2' : '#FFFBEB', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${isCustomer ? '#FECACA' : '#FDE68A'}` }}>
              <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700 }}>बाकी राशि / Balance Due:</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: isCustomer ? '#EF4444' : '#D97706' }}>₹{fmt(selected.totalUdhaar)}</span>
            </div>

            {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid #FECACA' }}>⚠️ {error}</div>}

            <form onSubmit={handleSettle}>
              <div className="form-group">
                <label className="form-label">राशि / Amount ₹ *</label>
                <input className="form-input" type="number" step="0.01" min="1" max={selected.totalUdhaar}
                  placeholder={`Max ₹${fmt(selected.totalUdhaar)}`} value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)} required />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100].map(pct => {
                    const val = parseFloat(((selected.totalUdhaar * pct) / 100).toFixed(2));
                    return (
                      <button key={pct} type="button" onClick={() => setSettleAmount(String(val))}
                        style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 700, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'var(--font-body)', transition: 'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = isCustomer ? '#EF4444' : '#D97706'; e.currentTarget.style.color = isCustomer ? '#EF4444' : '#D97706'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
                        {pct}% (₹{val})
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">नोट / Note</label>
                <input className="form-input" placeholder="Payment note (optional)" value={settleNote} onChange={e => setSettleNote(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={settleLoading} style={{
                  flex: 1, padding: '11px', background: isCustomer ? '#059669' : '#D97706', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', boxShadow: isCustomer ? '0 2px 8px rgba(5,150,105,0.3)' : '0 2px 8px rgba(217,119,6,0.3)',
                }}>{settleLoading ? '⏳ Processing...' : '✅ Confirm Payment'}</button>
                <button type="button" onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); }}
                  style={{ flex: 1, padding: '11px', background: 'var(--surface-2)', color: 'var(--text-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  रद्द / Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

function BalanceTile({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '11px 14px', border: '1px solid var(--border-2)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}