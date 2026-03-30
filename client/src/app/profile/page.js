'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh'];

export default function ProfilePage() {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [shop, setShop] = useState(null);
  const [nameForm, setNameForm] = useState(() => ({
    name: typeof window === 'undefined'
      ? ''
      : (JSON.parse(localStorage.getItem('user') || 'null')?.name || ''),
  }));
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [shopForm, setShopForm] = useState({
    name: '', address: '', city: '', state: '', pincode: '',
    gstin: '', phone: '', email: '',
    bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: '',
    terms: '',
  });
  const [nameMsg, setNameMsg] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [shopMsg, setShopMsg] = useState('');
  const [nameError, setNameError] = useState('');
  const [passError, setPassError] = useState('');
  const [shopError, setShopError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  async function fetchShop() {
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setShop(data);
      setShopForm({
        name: data.name || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        gstin: data.gstin || '',
        phone: data.phone || '',
        email: data.email || '',
        bank_name: data.bank_name || '',
        bank_account: data.bank_account || '',
        bank_ifsc: data.bank_ifsc || '',
        bank_branch: data.bank_branch || '',
        terms: data.terms || '',
      });
    } catch {}
  }

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const timeoutId = setTimeout(() => {
      fetchShop();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [router, user]);

  const updateName = async (e) => {
    e.preventDefault();
    setNameMsg('');
    setNameError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: nameForm.name }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...user, name: nameForm.name };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setNameMsg('Name updated successfully.');
      } else {
        setNameError(data.message || 'Failed to update name.');
      }
    } catch {
      setNameError('Server error');
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassError('Passwords do not match');
      return;
    }
    if (passForm.newPassword.length < 6) {
      setPassError('Minimum 6 characters required');
      return;
    }
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassMsg('Password updated successfully.');
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPassError(data.message || 'Failed to update password.');
      }
    } catch {
      setPassError('Server error');
    }
  };

  const updateShop = async (e) => {
    e.preventDefault();
    setShopMsg('');
    setShopError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(shopForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShop(data);
        setShopMsg('Shop details updated successfully.');
      } else {
        setShopError(data.message || 'Failed to update shop details.');
      }
    } catch {
      setShopError('Server error');
    }
  };

  const jumpToShopDetails = () => {
    document.getElementById('shop-details-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const profileTiles = [
    { label: 'GSTIN', value: shop?.gstin || 'GSTIN: Not added' },
    { label: 'Phone', value: shop?.phone || 'Phone: Tap to add' },
    { label: 'State', value: shop?.state || 'State: Not set' },
  ];

  return (
    <Layout>
      <div className="page-shell profile-shell">
        <section className="hero-panel">
          <div className="profile-hero-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #2563eb, #0ea5e9 58%, #10b981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 800,
                  boxShadow: '0 16px 36px rgba(37,99,235,0.2)',
                  flexShrink: 0,
                }}
              >
                {user?.name?.charAt(0).toUpperCase() || 'R'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="kicker" style={{ marginBottom: 10 }}>Profile control</div>
                <div className="page-title" style={{ color: '#0f172a', marginBottom: 4 }}>प्रोफ़ाइल और सेटिंग्स / Profile & Settings</div>
                <div style={{ fontSize: 13, color: '#5b6b82' }}>
                  Manage shop identity, invoice details and account security in one place.
                </div>
              </div>
            </div>

            <div className="profile-hero-tiles" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {profileTiles.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={jumpToShopDetails}
                  style={{
                    minWidth: 112,
                    maxWidth: 168,
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.84)',
                    border: '1px solid rgba(191,219,254,0.82)',
                    boxShadow: '0 10px 24px rgba(37,99,235,0.08)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    {tile.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>{tile.value}</div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: '#64748b' }} aria-hidden="true">
                      <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card" id="shop-details-section">
          <div style={{ marginBottom: 18 }}>
            <div className="section-title">दुकान विवरण / Shop Details</div>
            <div className="section-subtitle">GST compliance, billing identity and printed invoice information</div>
          </div>

          {shopMsg && <div className="alert-success">{shopMsg}</div>}
          {shopError && <div className="alert-error">{shopError}</div>}

          <form onSubmit={updateShop}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">दुकान नाम / SHOP NAME *</label>
                <input className="form-input" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">जीएसटीआईएन / GSTIN</label>
                <input className="form-input" placeholder="22AAAAA0000A1Z5" value={shopForm.gstin} onChange={(e) => setShopForm({ ...shopForm, gstin: e.target.value })} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">फोन / PHONE</label>
                <input className="form-input" placeholder="9876543210" value={shopForm.phone} onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">ईमेल / EMAIL</label>
                <input className="form-input" placeholder="shop@email.com" value={shopForm.email} onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">पता / ADDRESS</label>
              <input className="form-input" placeholder="Street address" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} />
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">शहर / CITY</label>
                <input className="form-input" placeholder="City" value={shopForm.city} onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">राज्य / STATE</label>
                <select className="form-input" value={shopForm.state} onChange={(e) => setShopForm({ ...shopForm, state: e.target.value })}>
                  <option value="">Select State</option>
                  {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">पिनकोड / PINCODE</label>
                <input className="form-input" placeholder="110001" value={shopForm.pincode} onChange={(e) => setShopForm({ ...shopForm, pincode: e.target.value })} />
              </div>
            </div>

            <div className="divider" />

            <div className="soft-panel" style={{ padding: 16, marginBottom: 16 }}>
              <div className="section-title" style={{ fontSize: 16 }}>बैंक विवरण / Bank Details</div>
              <div className="section-subtitle">Will appear on invoices when available</div>
              <div className="grid-2" style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">बैंक नाम / BANK NAME</label>
                  <input className="form-input" placeholder="State Bank of India" value={shopForm.bank_name} onChange={(e) => setShopForm({ ...shopForm, bank_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">शाखा / BRANCH</label>
                  <input className="form-input" placeholder="Main Branch" value={shopForm.bank_branch} onChange={(e) => setShopForm({ ...shopForm, bank_branch: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">खाता संख्या / ACCOUNT NO.</label>
                  <input className="form-input" placeholder="0000000000" value={shopForm.bank_account} onChange={(e) => setShopForm({ ...shopForm, bank_account: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">आईएफएससी कोड / IFSC CODE</label>
                  <input className="form-input" placeholder="SBIN0000000" value={shopForm.bank_ifsc} onChange={(e) => setShopForm({ ...shopForm, bank_ifsc: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="soft-panel" style={{ padding: 16, marginBottom: 18 }}>
              <div className="section-title" style={{ fontSize: 16 }}>नियम और शर्तें / Terms & Conditions</div>
              <div className="section-subtitle">Printed on invoices for cleaner business communication</div>
              <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                <label className="form-label">नियम / TERMS</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder={'1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'}
                  value={shopForm.terms}
                  onChange={(e) => setShopForm({ ...shopForm, terms: e.target.value })}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Save Shop Details
            </button>
          </form>
        </section>

        <section className="profile-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="section-title">नाम अपडेट करें / Update Name</div>
              <div className="section-subtitle">This updates your account identity across the app</div>
            </div>

            {nameMsg && <div className="alert-success">{nameMsg}</div>}
            {nameError && <div className="alert-error">{nameError}</div>}

            <form onSubmit={updateName} className="toolbar">
              <input
                className="form-input"
                style={{ flex: 1, minWidth: 180 }}
                value={nameForm.name}
                onChange={(e) => setNameForm({ name: e.target.value })}
                required
              />
              <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Update</button>
            </form>
          </div>

          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div className="section-title">पासवर्ड बदलें / Change Password</div>
              <div className="section-subtitle">Keep access secure without changing any business data</div>
            </div>

            {passMsg && <div className="alert-success">{passMsg}</div>}
            {passError && <div className="alert-error">{passError}</div>}

            <form onSubmit={updatePassword}>
              <div className="form-group">
                <label className="form-label">वर्तमान पासवर्ड / CURRENT PASSWORD</label>
                <input className="form-input" type="password" value={passForm.currentPassword} onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">नया पासवर्ड / NEW PASSWORD</label>
                <input className="form-input" type="password" value={passForm.newPassword} onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">पासवर्ड पुष्टि / CONFIRM PASSWORD</label>
                <input className="form-input" type="password" value={passForm.confirmPassword} onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary">Change Password</button>
            </form>
          </div>
        </section>

        <style>{`
          @media (max-width: 900px) {
            .profile-two-col {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 640px) {
            .profile-hero-header {
              align-items: flex-start !important;
            }

            .profile-hero-tiles {
              width: 100%;
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 8px !important;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
}

