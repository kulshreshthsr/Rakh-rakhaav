'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

export default function UdhaarPage() {
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [customerLedger, setCustomerLedger] = useState([]);
  const [supplierLedger, setSupplierLedger] = useState([]);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleType, setSettleType] = useState('customer');
  const [settleForm, setSettleForm] = useState({ amount: '', note: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');
  const API = 'https://rakh-rakhaav.onrender.com';

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API}/api/customers`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { router.push('/login'); return; }
      setCustomers(await res.json());
    } catch { setError('Customers load nahi hue'); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API}/api/suppliers`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setSuppliers(await res.json());
    } catch { setError('Suppliers load nahi hue'); }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    Promise.all([fetchCustomers(), fetchSuppliers()]).finally(() => setLoading(false));
  }, []);

  const openCustomerLedger = async (customer) => {
    setSelectedCustomer(customer);
    setSelectedSupplier(null);
    try {
      const res = await fetch(`${API}/api/customers/${customer._id}/udhaar`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setCustomerLedger(await res.json());
    } catch { setError('Ledger load nahi hua'); }
  };

  const openSupplierLedger = async (supplier) => {
    setSelectedSupplier(supplier);
    setSelectedCustomer(null);
    try {
      const res = await fetch(`${API}/api/suppliers/${supplier._id}/udhaar`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setSupplierLedger(await res.json());
    } catch { setError('Ledger load nahi hua'); }
  };

  const handleSettle = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const id = settleType === 'customer' ? selectedCustomer._id : selectedSupplier._id;
      const url = settleType === 'customer'
        ? `${API}/api/customers/${id}/settle`
        : `${API}/api/suppliers/${id}/settle`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(settleForm),
      });
      if (res.ok) {
        setSuccess('Payment recorded! ✅');
        setShowSettleModal(false);
        setSettleForm({ amount: '', note: '' });
        fetchCustomers();
        fetchSuppliers();
        if (settleType === 'customer' && selectedCustomer) openCustomerLedger(selectedCustomer);
        if (settleType === 'supplier' && selectedSupplier) openSupplierLedger(selectedSupplier);
      } else {
        const data = await res.json();
        setError(data.message || 'Failed');
      }
    } catch { setError('Server error'); }
  };

  const totalCustomerUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);
  const totalSupplierUdhaar = suppliers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);

  return (
    <Layout>
      <div className="page-title">उधार बही / Credit Ledger</div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>👥 Customer देना है</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#ef4444' }}>₹{totalCustomerUdhaar.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{customers.length} customers</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>🏭 Supplier को देना है</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>₹{totalSupplierUdhaar.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{suppliers.length} suppliers</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => { setActiveTab('customers'); setSelectedCustomer(null); setSelectedSupplier(null); }}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: activeTab === 'customers' ? '#ef4444' : '#f3f4f6', color: activeTab === 'customers' ? '#fff' : '#374151' }}>
          👥 Customers ({customers.length})
        </button>
        <button
          onClick={() => { setActiveTab('suppliers'); setSelectedCustomer(null); setSelectedSupplier(null); }}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: activeTab === 'suppliers' ? '#f59e0b' : '#f3f4f6', color: activeTab === 'suppliers' ? '#fff' : '#374151' }}>
          🏭 Suppliers ({suppliers.length})
        </button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{success}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>लोड हो रहा है...</div>
      ) : activeTab === 'customers' ? (
        /* ── CUSTOMERS ── */
        <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Customer List */}
          <div>
            {customers.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                <div style={{ fontWeight: 600 }}>कोई customer नहीं</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Credit sale karo to auto-create hoga</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customers.map(c => (
                  <div
                    key={c._id}
                    onClick={() => openCustomerLedger(c)}
                    style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${selectedCustomer?._id === c._id ? '#ef4444' : 'rgba(0,0,0,0.06)'}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: 12, color: '#9ca3af' }}>📞 {c.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c.totalUdhaar > 0 ? '#ef4444' : '#10b981' }}>
                        ₹{(c.totalUdhaar || 0).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {c.totalUdhaar > 0 ? 'बाकी है' : 'चुकता ✓'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Ledger */}
          {selectedCustomer && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Transaction History</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {selectedCustomer.totalUdhaar > 0 && (
                    <button
                      onClick={() => { setSettleType('customer'); setShowSettleModal(true); }}
                      style={{ padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      💰 Payment लें
                    </button>
                  )}
                  <button onClick={() => setSelectedCustomer(null)} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {/* Balance */}
              <div style={{ background: selectedCustomer.totalUdhaar > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>कुल बाकी / Balance Due</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: selectedCustomer.totalUdhaar > 0 ? '#ef4444' : '#059669' }}>
                  ₹{(selectedCustomer.totalUdhaar || 0).toFixed(2)}
                </div>
              </div>

              {/* Ledger entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {customerLedger.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>कोई entry नहीं</div>
                ) : customerLedger.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${entry.type === 'debit' ? '#ef4444' : '#10b981'}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{entry.note || (entry.type === 'debit' ? 'Credit Sale' : 'Payment Received')}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: entry.type === 'debit' ? '#ef4444' : '#10b981' }}>
                      {entry.type === 'debit' ? '+' : '-'}₹{entry.amount?.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── SUPPLIERS ── */
        <div style={{ display: 'grid', gridTemplateColumns: selectedSupplier ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Supplier List */}
          <div>
            {suppliers.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>
                <div style={{ fontWeight: 600 }}>कोई supplier नहीं</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Credit purchase karo to auto-create hoga</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suppliers.map(s => (
                  <div
                    key={s._id}
                    onClick={() => openSupplierLedger(s)}
                    style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${selectedSupplier?._id === s._id ? '#f59e0b' : 'rgba(0,0,0,0.06)'}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{s.name}</div>
                      {s.phone && <div style={{ fontSize: 12, color: '#9ca3af' }}>📞 {s.phone}</div>}
                      {s.gstin && <div style={{ fontSize: 11, color: '#6366f1' }}>GSTIN: {s.gstin}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.totalUdhaar > 0 ? '#f59e0b' : '#10b981' }}>
                        ₹{(s.totalUdhaar || 0).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {s.totalUdhaar > 0 ? 'देना बाकी' : 'चुकता ✓'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Ledger */}
          {selectedSupplier && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e' }}>{selectedSupplier.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Transaction History</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {selectedSupplier.totalUdhaar > 0 && (
                    <button
                      onClick={() => { setSettleType('supplier'); setShowSettleModal(true); }}
                      style={{ padding: '8px 14px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      💰 Payment करें
                    </button>
                  )}
                  <button onClick={() => setSelectedSupplier(null)} style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {/* Balance */}
              <div style={{ background: selectedSupplier.totalUdhaar > 0 ? '#fffbeb' : '#f0fdf4', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>कुल देना / Amount Due</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: selectedSupplier.totalUdhaar > 0 ? '#f59e0b' : '#059669' }}>
                  ₹{(selectedSupplier.totalUdhaar || 0).toFixed(2)}
                </div>
              </div>

              {/* Ledger entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {supplierLedger.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>कोई entry नहीं</div>
                ) : supplierLedger.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${entry.type === 'debit' ? '#f59e0b' : '#10b981'}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{entry.note || (entry.type === 'debit' ? 'Credit Purchase' : 'Payment Made')}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(entry.date || entry.createdAt).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: entry.type === 'debit' ? '#f59e0b' : '#10b981' }}>
                      {entry.type === 'debit' ? '+' : '-'}₹{entry.amount?.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTLE MODAL ── */}
      {showSettleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>
              {settleType === 'customer' ? '💰 Payment लें / Receive Payment' : '💰 Payment करें / Make Payment'}
            </h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
              {settleType === 'customer' ? `Customer: ${selectedCustomer?.name}` : `Supplier: ${selectedSupplier?.name}`}
            </p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSettle}>
              <div className="form-group">
                <label className="form-label">राशि / Amount ₹ *</label>
                <input className="form-input" type="number" min="1" placeholder="Enter amount" value={settleForm.amount} onChange={e => setSettleForm({ ...settleForm, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">नोट / Note</label>
                <input className="form-input" placeholder="Payment note..." value={settleForm.note} onChange={e => setSettleForm({ ...settleForm, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: settleType === 'customer' ? '#10b981' : '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ✅ Confirm Payment
                </button>
                <button type="button" onClick={() => { setShowSettleModal(false); setError(''); }} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>रद्द / Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}