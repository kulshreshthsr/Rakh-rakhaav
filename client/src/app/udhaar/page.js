'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);

function BalanceTile({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '12px 16px', border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

export default function UdhaarPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [ledger, setLedger]       = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showSettle, setShowSettle]       = useState(false);
  const [settleAmount, setSettleAmount]   = useState('');
  const [settleNote, setSettleNote]       = useState('');
  const [settleLoading, setSettleLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchAll();
  }, []);

  useEffect(() => { setSelected(null); setLedger([]); setError(''); setSuccess(''); }, [activeTab]);

  const fetchAll = async () => { setLoading(true); await Promise.all([fetchCustomers(), fetchSuppliers()]); setLoading(false); };

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
      const res = await fetch(`${API}/api/${base}/${item._id}/udhaar`, { headers: { Authorization: `Bearer ${getToken()}` } });
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
      const res = await fetch(`${API}/api/${base}/${selected._id}/settle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ amount: settleAmount, note: settleNote }) });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`₹${settleAmount} payment recorded ✅`);
        setShowSettle(false); setSettleAmount(''); setSettleNote('');
        await fetchAll();
        if (data.customer) setSelected(data.customer);
        else if (data.balanceDue !== undefined) setSelected(prev => ({ ...prev, totalUdhaar: data.balanceDue }));
        const lRes = await fetch(`${API}/api/${activeTab === 'customers' ? 'customers' : 'suppliers'}/${selected._id}/udhaar`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const lData = await lRes.json();
        setLedger(lData.entries || lData.ledger || (Array.isArray(lData) ? lData : []));
      } else setError(data.message || 'Payment failed');
    } catch { setError('Server error'); }
    setSettleLoading(false);
  };

  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const list = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';

  const IS = { width: '100%', padding: '12px 14px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'DM Sans,sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s,box-shadow 0.2s' };
  const LS = { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 7 };

  return (
    <Layout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .ui:focus{border-color:#059669!important;box-shadow:0 0 0 3px rgba(5,150,105,0.08)!important;}
        .list-item{transition:all 0.15s;cursor:pointer;}
        .list-item:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.08)!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.9) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);}}
      `}</style>

      <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 20 }}>उधार बही / Credit Ledger 🤝</div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)', border: '1.5px solid #FECACA', borderRadius: 16, padding: '18px 20px', animation: 'fadeUp 0.4s ease both' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>👥 Customer से लेना है</div>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 28, fontWeight: 800, color: '#DC2626', letterSpacing: -1 }}>₹{totalCustomerUdhaar.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{customers.filter(c => c.totalUdhaar > 0).length} pending · {customers.length} total</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: '1.5px solid #FDE68A', borderRadius: 16, padding: '18px 20px', animation: 'fadeUp 0.4s ease 0.1s both' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🏭 Supplier को देना है</div>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 28, fontWeight: 800, color: '#D97706', letterSpacing: -1 }}>₹{totalSupplierUdhaar.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{suppliers.filter(s => s.totalUdhaar > 0).length} pending · {suppliers.length} total</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
        {[{ key: 'customers', label: `👥 Customers (${customers.length})`, color: '#DC2626' }, { key: 'suppliers', label: `🏭 Suppliers (${suppliers.length})`, color: '#D97706' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'DM Sans,sans-serif', background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? tab.color : '#94A3B8', boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
      {success && <div style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>✅ {success}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: isCustomer ? '#DC2626' : '#D97706', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#94A3B8', fontSize: 14 }}>लोड हो रहा है...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: '50px 20px', textAlign: 'center', border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{isCustomer ? '👥' : '🏭'}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#475569', marginBottom: 4 }}>{isCustomer ? 'कोई customer नहीं' : 'कोई supplier नहीं'}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{isCustomer ? 'Credit sale karo to auto-create hoga' : 'Credit purchase karo to auto-create hoga'}</div>
            </div>
          ) : (
            list.map((item, i) => (
              <div key={item._id} className="list-item" onClick={() => openLedger(item)}
                style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: `1.5px solid ${selected?._id === item._id ? (isCustomer ? '#EF4444' : '#F59E0B') : '#F1F5F9'}`, boxShadow: selected?._id === item._id ? `0 0 0 3px ${isCustomer ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'}` : '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 2 }}>{item.name}</div>
                  {item.phone && <div style={{ fontSize: 12, color: '#94A3B8' }}>📞 {item.phone}</div>}
                  {item.gstin && <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 600 }}>GSTIN: {item.gstin}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 20, fontWeight: 800, color: item.totalUdhaar > 0 ? (isCustomer ? '#DC2626' : '#D97706') : '#059669' }}>₹{fmt(item.totalUdhaar)}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.totalUdhaar > 0 ? (isCustomer ? 'लेना बाकी' : 'देना बाकी') : 'चुकता ✓'}</div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94A3B8', transition: 'transform 0.2s', transform: selected?._id === item._id ? 'rotate(180deg)' : 'none' }}>▼</div>
                </div>
              </div>
            ))
          )}

          {/* Ledger Panel */}
          {selected && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: `1.5px solid ${isCustomer ? '#FECACA' : '#FDE68A'}`, borderTop: `3px solid ${isCustomer ? '#EF4444' : '#F59E0B'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', animation: 'fadeUp 0.3s ease both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Playfair Display,serif', fontWeight: 800, fontSize: 18, color: '#0F172A' }}>{selected.name}</div>
                  {selected.phone && <div style={{ fontSize: 12, color: '#94A3B8' }}>📞 {selected.phone}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.totalUdhaar > 0 && (
                    <button onClick={() => { setShowSettle(true); setError(''); setSuccess(''); }}
                      style={{ padding: '9px 16px', background: isCustomer ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', boxShadow: `0 3px 10px ${isCustomer ? 'rgba(5,150,105,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                      💰 {isCustomer ? 'Payment लें' : 'Payment करें'}
                    </button>
                  )}
                  <button onClick={() => { setSelected(null); setLedger([]); }} style={{ padding: '9px 14px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 600 }}>✕ Close</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
                {isCustomer ? (
                  <>
                    <BalanceTile label="Total Sales" value={`₹${fmt(selected.totalSales)}`} color="#374151" bg="#F8FAFC" />
                    <BalanceTile label="Received" value={`₹${fmt(selected.totalPaid)}`} color="#059669" bg="#F0FDF4" />
                    <BalanceTile label="Due" value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#DC2626' : '#059669'} bg={selected.totalUdhaar > 0 ? '#FEF2F2' : '#F0FDF4'} />
                  </>
                ) : (
                  <>
                    <BalanceTile label="Purchased" value={`₹${fmt(selected.totalPurchased)}`} color="#374151" bg="#F8FAFC" />
                    <BalanceTile label="Paid" value={`₹${fmt(selected.totalPaid)}`} color="#059669" bg="#F0FDF4" />
                    <BalanceTile label="Due" value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#D97706' : '#059669'} bg={selected.totalUdhaar > 0 ? '#FFFBEB' : '#F0FDF4'} />
                  </>
                )}
              </div>

              {ledgerLoading ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>⏳ लोड हो रहा है...</div>
              ) : ledger.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 13 }}>कोई entry नहीं</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                        {['Date', 'Note', 'Debit (+)', 'Credit (−)', 'Balance'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Note' || h === 'Date' ? 'left' : 'right', fontWeight: 700, color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...ledger].reverse().map((entry, i) => {
                        const isDebit = entry.type === 'debit' || entry.type === 'diya';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                            <td style={{ padding: '11px 12px', color: '#94A3B8', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</td>
                            <td style={{ padding: '11px 12px', color: '#374151', fontSize: 12 }}>
                              {entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment')}
                              {entry.reference_id && <div style={{ fontSize: 10, color: '#94A3B8' }}>{entry.reference_id}</div>}
                            </td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{isDebit ? `₹${fmt(entry.amount)}` : '—'}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{!isDebit ? `₹${fmt(entry.amount)}` : '—'}</td>
                            <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 800, color: (entry.running_balance ?? 0) > 0 ? (isCustomer ? '#DC2626' : '#D97706') : '#059669' }}>₹{fmt(entry.running_balance)}</td>
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

      {/* Settle Modal */}
      {showSettle && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,13,26,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: isCustomer ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#F59E0B,#D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
              <div>
                <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{isCustomer ? 'Payment लें' : 'Payment करें'}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>{selected.name}</div>
              </div>
            </div>
            <div style={{ background: isCustomer ? '#FEF2F2' : '#FFFBEB', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Balance Due:</span>
              <span style={{ fontFamily: 'Playfair Display,serif', fontSize: 20, fontWeight: 800, color: isCustomer ? '#DC2626' : '#D97706' }}>₹{fmt(selected.totalUdhaar)}</span>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
            <form onSubmit={handleSettle}>
              <div style={{ marginBottom: 14 }}>
                <label style={LS}>Amount ₹ *</label>
                <input className="ui" style={IS} type="number" step="0.01" min="1" max={selected.totalUdhaar} placeholder={`Max ₹${fmt(selected.totalUdhaar)}`} value={settleAmount} onChange={e => setSettleAmount(e.target.value)} required />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100].map(pct => {
                    const val = parseFloat(((selected.totalUdhaar * pct) / 100).toFixed(2));
                    return <button key={pct} type="button" onClick={() => setSettleAmount(String(val))} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 7, cursor: 'pointer', color: '#475569', fontFamily: 'DM Sans,sans-serif' }}>{pct}% (₹{val})</button>;
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={LS}>Note</label>
                <input className="ui" style={IS} placeholder="Payment note (optional)" value={settleNote} onChange={e => setSettleNote(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={settleLoading} style={{ flex: 1, padding: '13px', background: isCustomer ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>{settleLoading ? '⏳...' : '✅ Confirm Payment'}</button>
                <button type="button" onClick={() => { setShowSettle(false); setError(''); setSettleAmount(''); setSettleNote(''); }} style={{ flex: 1, padding: '13px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}