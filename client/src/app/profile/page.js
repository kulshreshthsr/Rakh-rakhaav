'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh'];
const GSTIN_LENGTH = 15;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};
const normalizeGstin = (value = '') => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, GSTIN_LENGTH);
const getStateFromGstin = (gstin = '') => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};

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
      const res = await fetch(apiUrl('/api/auth/shop'), {
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
      const res = await fetch(apiUrl('/api/auth/profile'), {
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
      const res = await fetch(apiUrl('/api/auth/password'), {
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
      const res = await fetch(apiUrl('/api/auth/shop'), {
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

  const handleGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);

    setShopForm((current) => ({
      ...current,
      gstin: normalized,
      ...(detectedState ? { state: detectedState } : {}),
    }));
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
                <div className="page-title" style={{ color: '#0f172a', marginBottom: 4 }}>Profile & Settings</div>
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
            <div className="section-title">Shop Details</div>
            <div className="section-subtitle">GST compliance, billing identity and printed invoice information</div>
          </div>

          {shopMsg && <div className="alert-success">{shopMsg}</div>}
          {shopError && <div className="alert-error">{shopError}</div>}

          <form onSubmit={updateShop}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Shop Name *</label>
                <input className="form-input" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input
                  className="form-input"
                  placeholder="22AAAAA0000A1Z5"
                  value={shopForm.gstin}
                  maxLength={GSTIN_LENGTH}
                  onChange={(e) => handleGstinChange(e.target.value)}
                />
                {shopForm.gstin.length === GSTIN_LENGTH && getStateFromGstin(shopForm.gstin) && shopForm.state ? (
                  <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>State auto-detected from GSTIN</div>
                ) : null}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="9876543210" value={shopForm.phone} onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" placeholder="shop@email.com" value={shopForm.email} onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="Street address" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} />
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" placeholder="City" value={shopForm.city} onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-input" value={shopForm.state} onChange={(e) => setShopForm({ ...shopForm, state: e.target.value })}>
                  <option value="">Select State</option>
                  {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" placeholder="110001" value={shopForm.pincode} onChange={(e) => setShopForm({ ...shopForm, pincode: e.target.value })} />
              </div>
            </div>

            <div className="divider" />

            <div className="soft-panel" style={{ padding: 16, marginBottom: 16 }}>
              <div className="section-title" style={{ fontSize: 16 }}>Bank Details</div>
              <div className="section-subtitle">Will appear on invoices when available</div>
              <div className="grid-2" style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-input" placeholder="State Bank of India" value={shopForm.bank_name} onChange={(e) => setShopForm({ ...shopForm, bank_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input className="form-input" placeholder="Main Branch" value={shopForm.bank_branch} onChange={(e) => setShopForm({ ...shopForm, bank_branch: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Account No.</label>
                  <input className="form-input" placeholder="0000000000" value={shopForm.bank_account} onChange={(e) => setShopForm({ ...shopForm, bank_account: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input className="form-input" placeholder="SBIN0000000" value={shopForm.bank_ifsc} onChange={(e) => setShopForm({ ...shopForm, bank_ifsc: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="soft-panel" style={{ padding: 16, marginBottom: 18 }}>
              <div className="section-title" style={{ fontSize: 16 }}>Terms & Conditions</div>
              <div className="section-subtitle">Printed on invoices for cleaner business communication</div>
              <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                <label className="form-label">Terms</label>
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
              <div className="section-title">Update Name</div>
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
              <div className="section-title">Change Password</div>
              <div className="section-subtitle">Keep access secure without changing any business data</div>
            </div>

            {passMsg && <div className="alert-success">{passMsg}</div>}
            {passError && <div className="alert-error">{passError}</div>}

            <form onSubmit={updatePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={passForm.currentPassword} onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={passForm.newPassword} onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" value={passForm.confirmPassword} onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary">Change Password</button>
            </form>
          </div>
        </section>
      </div>
    </Layout>
  );
}

