'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toFixed(2);

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

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    fetchAll();
  }, []);

  useEffect(() => {
    setSelected(null);
    setLedger([]);
    setError('');
    setSuccess('');
  }, [activeTab]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchSuppliers()]);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API}/api/customers`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setError('Customers load nahi hue');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API}/api/suppliers`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {}
  };

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
      setError('Ledger load nahi hua');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ amount: settleAmount, note: settleNote }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`₹${settleAmount} payment recorded ✅`);
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

  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const list = activeTab === 'customers' ? customers : suppliers;
  const isCustomer = activeTab === 'customers';
  const totalPendingCount = isCustomer
    ? customers.filter((c) => c.totalUdhaar > 0).length
    : suppliers.filter((s) => s.totalUdhaar > 0).length;

  return (
    <Layout>
      <div style={{ marginBottom: 22 }}>
        <div className="page-title" style={{ marginBottom: 6 }}>
          उधार बही / Credit Ledger
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 680 }}>
          Manage customer receivables and supplier payables in one clear, premium ledger workflow with live balance visibility.
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: isCustomer
            ? 'linear-gradient(135deg, #450A0A 0%, #991B1B 46%, #0F172A 100%)'
            : 'linear-gradient(135deg, #7C2D12 0%, #B45309 46%, #0F172A 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isCustomer
            ? '0 28px 60px rgba(153,27,27,0.18)'
            : '0 28px 60px rgba(180,83,9,0.18)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -20,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: 120,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.85fr)',
            gap: 18,
          }}
          className="udhaar-hero-grid"
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: 14,
              }}
            >
              <span>{isCustomer ? '👥' : '🏭'}</span>
              <span>{isCustomer ? 'Customer receivables' : 'Supplier payables'}</span>
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.08,
                fontFamily: 'var(--font-display)',
                marginBottom: 10,
              }}
            >
              {isCustomer ? 'Recover dues with full ledger clarity' : 'Track supplier balances without confusion'}
            </div>

            <div
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.82)',
                lineHeight: 1.65,
                maxWidth: 620,
              }}
            >
              Open any ledger, review running balance, and record settlement payments with a cleaner, more trusted business experience.
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 22,
              padding: '18px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: 700 }}>
              Current Focus
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>
              ₹{isCustomer ? totalCustomerUdhaar.toFixed(0) : totalSupplierUdhaar.toFixed(0)}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              {isCustomer ? 'Total to collect from customers' : 'Total to pay suppliers'}
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Pending
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{totalPendingCount}</div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Ledgers
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{list.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 22,
        }}
        className="udhaar-summary-grid"
      >
        <div
          style={{
            background: '#FEF2F2',
            border: '1.5px solid #FECACA',
            borderRadius: 24,
            padding: '18px 20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#EF4444' }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 8 }}>
            👥 Customer से लेना है
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#DC2626', letterSpacing: -1, lineHeight: 1 }}>
            ₹{totalCustomerUdhaar.toFixed(0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
            <span
              style={{
                background: '#FEE2E2',
                color: '#991B1B',
                padding: '4px 9px',
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {customers.filter((c) => c.totalUdhaar > 0).length} pending
            </span>
            <span style={{ marginLeft: 8 }}>{customers.length} total ledgers</span>
          </div>
        </div>

        <div
          style={{
            background: '#FFFBEB',
            border: '1.5px solid #FDE68A',
            borderRadius: 24,
            padding: '18px 20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F59E0B' }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 8 }}>
            🏭 Supplier को देना है
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#D97706', letterSpacing: -1, lineHeight: 1 }}>
            ₹{totalSupplierUdhaar.toFixed(0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
            <span
              style={{
                background: '#FEF3C7',
                color: '#92400E',
                padding: '4px 9px',
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {suppliers.filter((s) => s.totalUdhaar > 0).length} pending
            </span>
            <span style={{ marginLeft: 8 }}>{suppliers.length} total ledgers</span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          background: 'var(--surface-2)',
          borderRadius: 18,
          padding: 5,
          border: '1px solid var(--border-soft)',
        }}
      >
        <button
          onClick={() => setActiveTab('customers')}
          style={{
            flex: 1,
            padding: '11px 12px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            background: isCustomer ? 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)' : 'transparent',
            color: isCustomer ? '#fff' : 'var(--text-3)',
            boxShadow: isCustomer ? '0 14px 26px rgba(239,68,68,0.22)' : 'none',
          }}
        >
          👥 Customers ({customers.length})
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          style={{
            flex: 1,
            padding: '11px 12px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            background: !isCustomer ? 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)' : 'transparent',
            color: !isCustomer ? '#fff' : 'var(--text-3)',
            boxShadow: !isCustomer ? '0 14px 26px rgba(245,158,11,0.22)' : 'none',
          }}
        >
          🏭 Suppliers ({suppliers.length})
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#FEF2F2',
            color: '#991B1B',
            padding: '13px 16px',
            borderRadius: 16,
            fontSize: 13,
            marginBottom: 14,
            border: '1px solid #FECACA',
            fontWeight: 700,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: '#F0FDF4',
            color: '#15803D',
            padding: '13px 16px',
            borderRadius: 16,
            fontSize: 13,
            marginBottom: 14,
            border: '1px solid #BBF7D0',
            fontWeight: 700,
          }}
        >
          ✅ {success}
        </div>
      )}

      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 60,
            color: 'var(--text-4)',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: isCustomer ? '#EF4444' : '#D97706',
              animation: 'spin 0.7s linear infinite',
              marginBottom: 12,
            }}
          />
          लोड हो रहा है...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '64px 24px',
                color: 'var(--text-4)',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{isCustomer ? '👥' : '🏭'}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-2)', marginBottom: 6 }}>
                {isCustomer ? 'कोई customer नहीं' : 'कोई supplier नहीं'}
              </div>
              <div style={{ fontSize: 13.5 }}>
                {isCustomer ? 'Credit sale karo to auto-create hoga' : 'Credit purchase karo to auto-create hoga'}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
                gap: 16,
              }}
              className="udhaar-main-grid"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {list.map((item) => {
                  const isSelected = selected?._id === item._id;
                  const accentColor = isCustomer ? '#EF4444' : '#D97706';
                  const dueColor = item.totalUdhaar > 0 ? accentColor : '#16A34A';

                  return (
                    <div
                      key={item._id}
                      onClick={() => openLedger(item)}
                      style={{
                        background: '#fff',
                        borderRadius: 22,
                        padding: '15px 18px',
                        border: `1.5px solid ${isSelected ? accentColor : 'var(--border-soft)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: isSelected ? `0 20px 34px ${isCustomer ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)'}` : 'var(--shadow-sm)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{item.name}</div>
                        {item.phone && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>📞 {item.phone}</div>}
                        {item.gstin && (
                          <div style={{ fontSize: 11, color: '#4338CA', fontWeight: 700, marginTop: 3 }}>
                            GSTIN: {item.gstin}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 21, fontWeight: 900, color: dueColor, letterSpacing: -0.5 }}>
                            ₹{fmt(item.totalUdhaar)}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
                            {item.totalUdhaar > 0 ? (isCustomer ? 'लेना बाकी' : 'देना बाकी') : 'चुकता ✓'}
                          </div>
                        </div>

                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 12,
                            background: isSelected ? accentColor : 'var(--surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            color: isSelected ? '#fff' : 'var(--text-4)',
                            fontWeight: 800,
                          }}
                        >
                          {isSelected ? '▲' : '▼'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                {selected ? (
                  <div
                    className="card"
                    style={{
                      border: `1.5px solid ${isCustomer ? '#FECACA' : '#FDE68A'}`,
                      boxShadow: isCustomer
                        ? '0 24px 44px rgba(239,68,68,0.08)'
                        : '0 24px 44px rgba(245,158,11,0.08)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 16,
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                          {selected.name}
                        </div>
                        {selected.phone && (
                          <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                            📞 {selected.phone}
                          </div>
                        )}
                        <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                          Running transaction ledger
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selected.totalUdhaar > 0 && (
                          <button
                            onClick={() => {
                              setShowSettle(true);
                              setError('');
                              setSuccess('');
                            }}
                            style={{
                              padding: '10px 16px',
                              background: isCustomer
                                ? 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)'
                                : 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 14,
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-body)',
                              boxShadow: isCustomer
                                ? '0 14px 24px rgba(34,197,94,0.20)'
                                : '0 14px 24px rgba(245,158,11,0.20)',
                            }}
                          >
                            💰 {isCustomer ? 'Payment लें' : 'Payment करें'}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelected(null);
                            setLedger([]);
                          }}
                          style={{
                            padding: '10px 14px',
                            background: 'var(--surface-2)',
                            color: 'var(--text-3)',
                            border: '1px solid var(--border-soft)',
                            borderRadius: 14,
                            fontSize: 13,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 700,
                          }}
                        >
                          ✕ बंद करें
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      {isCustomer ? (
                        <>
                          <BalanceTile label="कुल बिक्री" value={`₹${fmt(selected.totalSales)}`} color="var(--text-2)" bg="var(--surface-2)" />
                          <BalanceTile label="कुल मिला" value={`₹${fmt(selected.totalPaid)}`} color="#16A34A" bg="#F0FDF4" />
                          <BalanceTile label="बाकी / Due" value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#DC2626' : '#16A34A'} bg={selected.totalUdhaar > 0 ? '#FEF2F2' : '#F0FDF4'} />
                        </>
                      ) : (
                        <>
                          <BalanceTile label="कुल खरीद" value={`₹${fmt(selected.totalPurchased)}`} color="var(--text-2)" bg="var(--surface-2)" />
                          <BalanceTile label="कुल दिया" value={`₹${fmt(selected.totalPaid)}`} color="#16A34A" bg="#F0FDF4" />
                          <BalanceTile label="देना बाकी" value={`₹${fmt(selected.totalUdhaar)}`} color={selected.totalUdhaar > 0 ? '#D97706' : '#16A34A'} bg={selected.totalUdhaar > 0 ? '#FFFBEB' : '#F0FDF4'} />
                        </>
                      )}
                    </div>

                    {ledgerLoading ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 30 }}>
                        ⏳ लोड हो रहा है...
                      </div>
                    ) : ledger.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: 30 }}>
                        कोई entry नहीं
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-soft)' }}>
                              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                                तारीख
                              </th>
                              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                                विवरण
                              </th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                                Debit (+)
                              </th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                                Credit (−)
                              </th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                                Balance
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...ledger].reverse().map((entry, i) => {
                              const isDebit = entry.type === 'debit' || entry.type === 'diya';
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                  <td style={{ padding: '12px 14px', color: 'var(--text-4)', fontSize: 12, whiteSpace: 'nowrap' }}>
                                    {new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-2)' }}>
                                    <div style={{ fontWeight: 700 }}>
                                      {entry.note || (isDebit ? (isCustomer ? 'Credit Sale' : 'Credit Purchase') : 'Payment')}
                                    </div>
                                    {entry.reference_id && (
                                      <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 3 }}>
                                        {entry.reference_id}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#DC2626' }}>
                                    {isDebit ? `₹${fmt(entry.amount)}` : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#16A34A' }}>
                                    {!isDebit ? `₹${fmt(entry.amount)}` : '—'}
                                  </td>
                                  <td
                                    style={{
                                      padding: '12px 14px',
                                      textAlign: 'right',
                                      fontWeight: 900,
                                      color: (entry.running_balance ?? 0) > 0 ? (isCustomer ? '#DC2626' : '#D97706') : '#16A34A',
                                      fontSize: 13.5,
                                    }}
                                  >
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
                ) : (
                  <div
                    className="card"
                    style={{
                      textAlign: 'center',
                      padding: '64px 24px',
                      color: 'var(--text-4)',
                    }}
                  >
                    <div style={{ fontSize: 46, marginBottom: 12 }}>{isCustomer ? '📒' : '🏦'}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-2)', marginBottom: 6 }}>
                      Ledger खोलने के लिए कोई entry चुनें
                    </div>
                    <div style={{ fontSize: 13.5 }}>
                      Customer ya supplier select karo to running balance aur history dikhegi
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showSettle && selected && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {isCustomer ? 'Payment लें' : 'Payment करें'}
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                  {isCustomer ? `Customer: ${selected.name}` : `Supplier: ${selected.name}`}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowSettle(false);
                  setError('');
                  setSettleAmount('');
                  setSettleNote('');
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: isCustomer ? '#FEF2F2' : '#FFFBEB',
                borderRadius: 18,
                padding: '14px 16px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: `1px solid ${isCustomer ? '#FECACA' : '#FDE68A'}`,
              }}
            >
              <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 800 }}>
                बाकी राशि / Balance Due
              </span>
              <span style={{ fontSize: 20, fontWeight: 900, color: isCustomer ? '#DC2626' : '#D97706' }}>
                ₹{fmt(selected.totalUdhaar)}
              </span>
            </div>

            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  color: '#991B1B',
                  padding: '12px 14px',
                  borderRadius: 14,
                  fontSize: 13,
                  marginBottom: 14,
                  border: '1px solid #FECACA',
                  fontWeight: 700,
                }}
              >
                ⚠️ {error}
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
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                />

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100].map((pct) => {
                    const val = parseFloat(((selected.totalUdhaar * pct) / 100).toFixed(2));
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSettleAmount(String(val))}
                        style={{
                          padding: '6px 12px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 10,
                          cursor: 'pointer',
                          color: 'var(--text-3)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
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
                  onChange={(e) => setSettleNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={settleLoading}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    padding: '11px 14px',
                    background: isCustomer
                      ? 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)'
                      : 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    boxShadow: isCustomer
                      ? '0 14px 24px rgba(34,197,94,0.20)'
                      : '0 14px 24px rgba(245,158,11,0.20)',
                  }}
                >
                  {settleLoading ? '⏳ Processing...' : '✅ Confirm Payment'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSettle(false);
                    setError('');
                    setSettleAmount('');
                    setSettleNote('');
                  }}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    padding: '11px 14px',
                    background: 'var(--surface-2)',
                    color: 'var(--text-2)',
                    border: '1.5px solid var(--border-soft)',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  रद्द / Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .udhaar-hero-grid,
          .udhaar-main-grid,
          .udhaar-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Layout>
  );
}

function BalanceTile({ label, value, color, bg }) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: 16,
        padding: '12px 14px',
        border: '1px solid var(--border-soft)',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-4)',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 0.06,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
