'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];

const getToken = () => localStorage.getItem('token');

const Msg = ({ ok, text }) => text ? (
  <div
    style={{
      background: ok ? '#F0FDF4' : '#FEF2F2',
      color: ok ? '#15803D' : '#991B1B',
      padding: '12px 14px',
      borderRadius: 14,
      fontSize: 13,
      marginBottom: 16,
      border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`,
      fontWeight: 700,
    }}
  >
    {ok ? '✅ ' : '⚠️ '}
    {text}
  </div>
) : null;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [nameForm, setNameForm] = useState({ name: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [shopForm, setShopForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    phone: '',
    email: '',
    bank_name: '',
    bank_account: '',
    bank_ifsc: '',
    bank_branch: '',
    terms: '',
  });

  const [nameMsg, setNameMsg] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [shopMsg, setShopMsg] = useState('');
  const [nameError, setNameError] = useState('');
  const [passError, setPassError] = useState('');
  const [shopError, setShopError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [activeSection, setActiveSection] = useState('shop');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    const u = JSON.parse(stored);
    setUser(u);
    setNameForm({ name: u.name });
    fetchShop();
  }, []);

  const fetchShop = async () => {
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
  };

  const updateName = async (e) => {
    e.preventDefault();
    setNameMsg('');
    setNameError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: nameForm.name }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...user, name: nameForm.name };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setNameMsg('नाम अपडेट हो गया! / Name updated!');
      } else {
        setNameError(data.message || 'विफल / Failed');
      }
    } catch {
      setNameError('सर्वर त्रुटि / Server error');
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');

    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassError('पासवर्ड मेल नहीं खाते / Passwords do not match');
      return;
    }
    if (passForm.newPassword.length < 6) {
      setPassError('कम से कम 6 अक्षर / Min 6 characters');
      return;
    }

    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          currentPassword: passForm.currentPassword,
          newPassword: passForm.newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassMsg('पासवर्ड बदल गया! / Password updated!');
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPassError(data.message || 'विफल / Failed');
      }
    } catch {
      setPassError('सर्वर त्रुटि / Server error');
    }
  };

  const updateShop = async (e) => {
    e.preventDefault();
    setShopMsg('');
    setShopError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(shopForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShop(data);
        setShopMsg('दुकान की जानकारी अपडेट हो गई! / Shop details updated!');
      } else {
        setShopError(data.message || 'विफल / Failed');
      }
    } catch {
      setShopError('सर्वर त्रुटि / Server error');
    }
  };

  const sections = [
    { key: 'shop', icon: '🏪', label: 'Shop Details', sub: 'GST and invoice settings' },
    { key: 'account', icon: '✏️', label: 'Update Name', sub: 'Display identity' },
    { key: 'password', icon: '🔒', label: 'Change Password', sub: 'Security controls' },
  ];

  const completionScore = [
    !!shopForm.name,
    !!shopForm.phone,
    !!shopForm.address,
    !!shopForm.state,
    !!shopForm.gstin,
    !!shopForm.bank_name,
    !!shopForm.bank_account,
    !!shopForm.bank_ifsc,
  ].filter(Boolean).length;

  const completionPct = (completionScore / 8) * 100;

  return (
    <Layout>
      <div style={{ marginBottom: 22 }}>
        <div className="page-title" style={{ marginBottom: 6 }}>
          प्रोफ़ाइल / Profile
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 680 }}>
          Manage shop branding, GST and bank details, invoice identity, and account security from one polished control panel.
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: '24px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 42%, #4F46E5 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 28px 60px rgba(15,23,42,0.20)',
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
            background: 'radial-gradient(circle, rgba(34,197,94,0.14), transparent 70%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.8fr)',
            gap: 18,
          }}
          className="profile-hero-grid"
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 24,
                background: 'linear-gradient(135deg, #4F46E5 0%, #22C55E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 18px 34px rgba(79,70,229,0.28)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            <div style={{ minWidth: 0 }}>
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
                <span>👤</span>
                <span>Account and shop identity</span>
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.08,
                  fontFamily: 'var(--font-display)',
                  marginBottom: 8,
                }}
              >
                {user?.name || 'User'}
              </div>

              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', marginBottom: 10 }}>
                {user?.email || 'Business account'}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {shop?.gstin && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                      padding: '6px 10px',
                      borderRadius: 999,
                    }}
                  >
                    GSTIN: {shop.gstin}
                  </span>
                )}

                {shop?.name && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                      padding: '6px 10px',
                      borderRadius: 999,
                    }}
                  >
                    {shop.name}
                  </span>
                )}
              </div>
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
              Profile Completeness
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{Math.round(completionPct)}%</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              Better invoice trust with full shop details
            </div>

            <div
              style={{
                marginTop: 12,
                height: 10,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${completionPct}%`,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #22C55E 0%, #86EFAC 100%)',
                }}
              />
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Shop name', ok: !!shopForm.name },
                { label: 'GST details', ok: !!shopForm.gstin },
                { label: 'Bank details', ok: !!shopForm.bank_name && !!shopForm.bank_account && !!shopForm.bank_ifsc },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: item.ok ? '#86EFAC' : 'rgba(255,255,255,0.44)', fontWeight: 800 }}>
                    {item.ok ? '✓' : '•'}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.84)', fontWeight: 600 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr)',
          gap: 18,
        }}
        className="profile-main-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 20,
                border: '1.5px solid',
                borderColor: activeSection === s.key ? '#4F46E5' : 'var(--border-soft)',
                background: activeSection === s.key ? '#EEF2FF' : '#fff',
                color: activeSection === s.key ? '#4338CA' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                boxShadow: activeSection === s.key ? '0 18px 30px rgba(79,70,229,0.10)' : 'var(--shadow-xs)',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    background: activeSection === s.key ? '#fff' : 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>

                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: activeSection === s.key ? '#6366F1' : 'var(--text-4)', marginTop: 4 }}>
                    {s.sub}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div>
          {activeSection === 'shop' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    background: '#EEF2FF',
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  🏪
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    दुकान की जानकारी
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 3 }}>
                    GST compliance, invoices, and customer trust ke liye details complete रखें
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-soft)', margin: '16px 0' }} />

              <Msg ok={!!shopMsg} text={shopMsg || shopError} />

              <form onSubmit={updateShop}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(260px, 0.9fr)',
                    gap: 18,
                  }}
                  className="profile-shop-grid"
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-4)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.08,
                        marginBottom: 12,
                      }}
                    >
                      Basic Info
                    </div>

                    <div className="form-group">
                      <label className="form-label">दुकान का नाम / Shop Name *</label>
                      <input
                        className="form-input"
                        value={shopForm.name}
                        onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">फ़ोन / Phone</label>
                        <input
                          className="form-input"
                          placeholder="9876543210"
                          value={shopForm.phone}
                          onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">ईमेल / Email</label>
                        <input
                          className="form-input"
                          placeholder="shop@email.com"
                          value={shopForm.email}
                          onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">पता / Address</label>
                      <input
                        className="form-input"
                        placeholder="गली का पता / Street address"
                        value={shopForm.address}
                        onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">शहर / City</label>
                        <input
                          className="form-input"
                          placeholder="शहर"
                          value={shopForm.city}
                          onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">पिनकोड / Pincode</label>
                        <input
                          className="form-input"
                          placeholder="110001"
                          value={shopForm.pincode}
                          onChange={(e) => setShopForm({ ...shopForm, pincode: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">राज्य / State</label>
                      <select
                        className="form-input"
                        value={shopForm.state}
                        onChange={(e) => setShopForm({ ...shopForm, state: e.target.value })}
                      >
                        <option value="">राज्य चुनें / Select State</option>
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">GSTIN (वैकल्पिक)</label>
                      <input
                        className="form-input"
                        placeholder="22AAAAA0000A1Z5"
                        value={shopForm.gstin}
                        onChange={(e) => setShopForm({ ...shopForm, gstin: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 18,
                        background: '#F8FAFC',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: 'var(--text-4)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.08,
                          marginBottom: 12,
                        }}
                      >
                        Bank Details
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>
                        Invoice में show होगा / Will appear on invoices
                      </div>

                      <div className="form-group">
                        <label className="form-label">बैंक का नाम</label>
                        <input
                          className="form-input"
                          placeholder="State Bank of India"
                          value={shopForm.bank_name}
                          onChange={(e) => setShopForm({ ...shopForm, bank_name: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">शाखा / Branch</label>
                        <input
                          className="form-input"
                          placeholder="Main Branch"
                          value={shopForm.bank_branch}
                          onChange={(e) => setShopForm({ ...shopForm, bank_branch: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">खाता नंबर</label>
                        <input
                          className="form-input"
                          placeholder="0000000000"
                          value={shopForm.bank_account}
                          onChange={(e) => setShopForm({ ...shopForm, bank_account: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">IFSC Code</label>
                        <input
                          className="form-input"
                          placeholder="SBIN0000000"
                          value={shopForm.bank_ifsc}
                          onChange={(e) => setShopForm({ ...shopForm, bank_ifsc: e.target.value })}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 18,
                        background: '#F8FAFC',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: 'var(--text-4)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.08,
                          marginBottom: 12,
                        }}
                      >
                        Invoice Terms
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Invoice पर print होगा</label>
                        <textarea
                          className="form-input"
                          rows={6}
                          placeholder={'1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'}
                          value={shopForm.terms}
                          onChange={(e) => setShopForm({ ...shopForm, terms: e.target.value })}
                          style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    💾 दुकान की जानकारी सहेजें
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    background: '#EEF2FF',
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  ✏️
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    नाम बदलें / Update Name
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 3 }}>
                    Sidebar, account identity, and business presence के लिए
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-soft)', margin: '16px 0' }} />

              <Msg ok={!!nameMsg} text={nameMsg || nameError} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 190px',
                  gap: 14,
                }}
                className="profile-name-grid"
              >
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 18,
                    background: '#F8FAFC',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 12 }}>
                    Public Identity
                  </div>

                  <form onSubmit={updateName} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      className="form-input"
                      style={{ flex: 1, minWidth: 220 }}
                      placeholder="आपका नाम"
                      value={nameForm.name}
                      onChange={(e) => setNameForm({ name: e.target.value })}
                      required
                    />
                    <button type="submit" className="btn-primary">
                      अपडेट
                    </button>
                  </form>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: 18,
                    background: '#EEF2FF',
                    border: '1px solid #C7D2FE',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#4338CA', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 10 }}>
                    Preview
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#312E81', lineHeight: 1.2 }}>
                    {nameForm.name || 'Your Name'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6366F1', marginTop: 6 }}>
                    This is what users see inside the app shell.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'password' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    background: '#FEF2F2',
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  🔒
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    पासवर्ड बदलें / Change Password
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 3 }}>
                    Secure your account with a stronger updated password
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-soft)', margin: '16px 0' }} />

              <Msg ok={!!passMsg} text={passMsg || passError} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 220px',
                  gap: 16,
                }}
                className="profile-pass-grid"
              >
                <form onSubmit={updatePassword}>
                  <div className="form-group">
                    <label className="form-label">वर्तमान पासवर्ड *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        type={showPass ? 'text' : 'password'}
                        style={{ paddingRight: 46 }}
                        value={passForm.currentPassword}
                        onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 16,
                          color: 'var(--text-4)',
                        }}
                      >
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">नया पासवर्ड *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        type={showNew ? 'text' : 'password'}
                        style={{ paddingRight: 46 }}
                        placeholder="Min 6 characters"
                        value={passForm.newPassword}
                        onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 16,
                          color: 'var(--text-4)',
                        }}
                      >
                        {showNew ? '🙈' : '👁️'}
                      </button>
                    </div>

                    {passForm.newPassword && (
                      <div style={{ marginTop: 8 }}>
                        <div
                          style={{
                            height: 6,
                            background: 'var(--border-soft)',
                            borderRadius: 999,
                            overflow: 'hidden',
                            marginBottom: 6,
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 999,
                              transition: 'all 0.3s',
                              width:
                                passForm.newPassword.length < 6
                                  ? '33%'
                                  : passForm.newPassword.length < 10
                                  ? '66%'
                                  : '100%',
                              background:
                                passForm.newPassword.length < 6
                                  ? '#EF4444'
                                  : passForm.newPassword.length < 10
                                  ? '#F59E0B'
                                  : '#22C55E',
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color:
                              passForm.newPassword.length < 6
                                ? '#DC2626'
                                : passForm.newPassword.length < 10
                                ? '#D97706'
                                : '#15803D',
                            fontWeight: 700,
                          }}
                        >
                          {passForm.newPassword.length < 6
                            ? 'Weak'
                            : passForm.newPassword.length < 10
                            ? 'Medium'
                            : 'Strong'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">पासवर्ड पुष्टि *</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Same as new password"
                      value={passForm.confirmPassword}
                      onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                      style={{
                        borderColor:
                          passForm.confirmPassword && passForm.confirmPassword !== passForm.newPassword
                            ? '#EF4444'
                            : undefined,
                      }}
                      required
                    />
                    {passForm.confirmPassword && passForm.confirmPassword !== passForm.newPassword && (
                      <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 6, fontWeight: 700 }}>
                        ⚠️ Passwords don't match
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn-danger" style={{ width: '100%' }}>
                    🔒 पासवर्ड बदलें
                  </button>
                </form>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: 18,
                    background: '#F8FAFC',
                    border: '1px solid var(--border-soft)',
                    alignSelf: 'start',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 12 }}>
                    Security Tips
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      'At least 6 characters',
                      'Use something not easy to guess',
                      'Don’t reuse old passwords',
                    ].map((tip, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>
                        <span style={{ color: '#4338CA', fontWeight: 800 }}>•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .profile-hero-grid,
          .profile-main-grid,
          .profile-shop-grid,
          .profile-pass-grid,
          .profile-name-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Layout>
  );
}
