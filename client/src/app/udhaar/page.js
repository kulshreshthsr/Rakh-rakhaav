'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';

export default function UdhaarPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showUdhaarModal, setShowUdhaarModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [udhaarHistory, setUdhaarHistory] = useState([]);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });
  const [udhaarForm, setUdhaarForm] = useState({ type: 'diya', amount: '', note: '', date: new Date().toISOString().split('T')[0] });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');
  const API = 'https://rakh-rakhaav.onrender.com';

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API}/api/customers`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      setCustomers(await res.json());
    } catch { setError('Could not load customers'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    fetchCustomers();
  }, []);

  const addCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(customerForm),
      });
      if (res.ok) {
        setShowAddCustomer(false);
        setCustomerForm({ name: '', phone: '' });
        fetchCustomers();
      }
    } catch { setError('Failed to add customer'); }
  };

  const openUdhaar = async (customer) => {
    setSelectedCustomer(customer);
    const res = await fetch(`${API}/api/customers/${customer._id}/udhaar`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setUdhaarHistory(await res.json());
    setShowUdhaarModal(true);
  };

  const addUdhaarEntry = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/customers/${selectedCustomer._id}/udhaar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(udhaarForm),
      });
      if (res.ok) {
        setUdhaarForm({ type: 'diya', amount: '', note: '', date: new Date().toISOString().split('T')[0] });
        const res2 = await fetch(`${API}/api/customers/${selectedCustomer._id}/udhaar`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        setUdhaarHistory(await res2.json());
        fetchCustomers();
      }
    } catch { setError('Failed to add entry'); }
  };

  const settleUdhaar = async (customerId) => {
    if (!confirm('Kya aap sure hain? Sab udhaar clear ho jaayega.')) return;
    await fetch(`${API}/api/customers/${customerId}/settle`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    fetchCustomers();
    setShowUdhaarModal(false);
  };

  const deleteCustomer = async (id) => {
    if (!confirm('Customer delete karein?')) return;
    await fetch(`${API}/api/customers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    fetchCustomers();
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search)));
  const totalUdhaar = customers.reduce((s, c) => s + (c.totalUdhaar || 0), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>उधार बही</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>
            Total Udhaar: <span style={{ color: totalUdhaar > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>₹{totalUdhaar.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={() => setShowAddCustomer(true)} className="btn-primary">+ Naya Customer</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="Customer naam ya phone se dhundho..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            Koi customer nahi. "+ Naya Customer" se add karo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(c => (
              <div key={c._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#6366f1' }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.phone || 'Phone nahi diya'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>BAAKI UDHAAR</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.totalUdhaar > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{(c.totalUdhaar || 0).toFixed(2)}
                    </div>
                  </div>
                  <button onClick={() => openUdhaar(c)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Hisaab
                  </button>
                  <button onClick={() => deleteCustomer(c._id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#1a1a2e' }}>Naya Customer Jodo</h3>
            <form onSubmit={addCustomer}>
              <div className="form-group">
                <label className="form-label">Naam</label>
                <input className="form-input" placeholder="Customer ka naam" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (optional)</label>
                <input className="form-input" placeholder="Mobile number" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Jodo</button>
                <button type="button" onClick={() => setShowAddCustomer(false)} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Udhaar Modal */}
      {showUdhaarModal && selectedCustomer && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowUdhaarModal(false); }}>
          <div className="modal" style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{selectedCustomer.name}</h3>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{selectedCustomer.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>BAAKI</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: selectedCustomer.totalUdhaar > 0 ? '#ef4444' : '#10b981' }}>
                  ₹{(selectedCustomer.totalUdhaar || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Add entry form */}
            <form onSubmit={addUdhaarEntry} style={{ background: '#f9f9f7', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button type="button" onClick={() => setUdhaarForm({ ...udhaarForm, type: 'diya' })} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: udhaarForm.type === 'diya' ? '#ef4444' : '#f3f4f6', color: udhaarForm.type === 'diya' ? '#fff' : '#374151' }}>
                  Diya (उधार दिया)
                </button>
                <button type="button" onClick={() => setUdhaarForm({ ...udhaarForm, type: 'liya' })} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: udhaarForm.type === 'liya' ? '#10b981' : '#f3f4f6', color: udhaarForm.type === 'liya' ? '#fff' : '#374151' }}>
                  Liya (वापस लिया)
                </button>
              </div>
              <div className="grid-2" style={{ marginBottom: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Raqam (₹)</label>
                  <input className="form-input" type="number" placeholder="0" value={udhaarForm.amount} onChange={e => setUdhaarForm({ ...udhaarForm, amount: e.target.value })} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tarikh</label>
                  <input className="form-input" type="date" value={udhaarForm.date} onChange={e => setUdhaarForm({ ...udhaarForm, date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="Kya liya/diya..." value={udhaarForm.note} onChange={e => setUdhaarForm({ ...udhaarForm, note: e.target.value })} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '10px', background: udhaarForm.type === 'diya' ? '#ef4444' : '#10b981', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {udhaarForm.type === 'diya' ? '+ Udhaar Diya' : '+ Wapas Liya'}
              </button>
            </form>

            {/* History */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Hisaab</div>
              {udhaarHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>Koi entry nahi</div>
              ) : (
                udhaarHistory.map(u => (
                  <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f3f0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{u.note || (u.type === 'diya' ? 'Udhaar diya' : 'Wapas liya')}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(u.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: u.type === 'diya' ? '#ef4444' : '#10b981' }}>
                      {u.type === 'diya' ? '+' : '-'}₹{u.amount}
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedCustomer.totalUdhaar > 0 && (
              <button onClick={() => settleUdhaar(selectedCustomer._id)} style={{ width: '100%', marginTop: 16, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Udhaar Clear Kar Do
              </button>
            )}

            <button onClick={() => setShowUdhaarModal(false)} style={{ width: '100%', marginTop: 8, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
              Band Karo
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}