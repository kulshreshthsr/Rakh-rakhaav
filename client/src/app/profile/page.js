'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];

const getToken = () => localStorage.getItem('token');

const Msg = ({ ok, text }) => text ? (
  <div style={{ background: ok ? '#F0FDF4' : '#FEF2F2', color: ok ? '#059669' : '#991B1B', padding: '11px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`, fontWeight: 600 }}>
    {ok ? '✅ ' : '⚠️ '}{text}
  </div>
) : null;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [nameForm, setNameForm] = useState({ name: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [shopForm, setShopForm] = useState({ name: '', address: '', city: '', state: '', pincode: '', gstin: '', phone: '', email: '', bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: '', terms: '' });
  const [nameMsg,   setNameMsg]   = useState('');
  const [passMsg,   setPassMsg]   = useState('');
  const [shopMsg,   setShopMsg]   = useState('');
  const [nameError, setNameError] = useState('');
  const [passError, setPassError] = useState('');
  const [shopError, setShopError] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showNew,  setShowNew]    = useState(false);
  const [activeSection, setActiveSection] = useState('shop');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    setUser(u); setNameForm({ name: u.name });
    fetchShop();
  }, []);

  const fetchShop = async () => {
    try {
      const res  = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      setShop(data);
      setShopForm({ name: data.name || '', address: data.address || '', city: data.city || '', state: data.state || '', pincode: data.pincode || '', gstin: data.gstin || '', phone: data.phone || '', email: data.email || '', bank_name: data.bank_name || '', bank_account: data.bank_account || '', bank_ifsc: data.bank_ifsc || '', bank_branch: data.bank_branch || '', terms: data.terms || '' });
    } catch {}
  };

  const updateName = async (e) => {
    e.preventDefault(); setNameMsg(''); setNameError('');
    try {
      const res  = await fetch('https://rakh-rakhaav.onrender.com/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ name: nameForm.name }) });
      const data = await res.json();
      if (res.ok) { const updated = { ...user, name: nameForm.name }; localStorage.setItem('user', JSON.stringify(updated)); setUser(updated); setNameMsg('नाम अपडेट हो गया! / Name updated!'); }
      else setNameError(data.message || 'विफल / Failed');
    } catch { setNameError('सर्वर त्रुटि / Server error'); }
  };

  const updatePassword = async (e) => {
    e.preventDefault(); setPassMsg(''); setPassError('');
    if (passForm.newPassword !== passForm.confirmPassword) { setPassError('पासवर्ड मेल नहीं खाते / Passwords do not match'); return; }
    if (passForm.newPassword.length < 6) { setPassError('कम से कम 6 अक्षर / Min 6 characters'); return; }
    try {
      const res  = await fetch('https://rakh-rakhaav.onrender.com/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }) });
      const data = await res.json();
      if (res.ok) { setPassMsg('पासवर्ड बदल गया! / Password updated!'); setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
      else setPassError(data.message || 'विफल / Failed');
    } catch { setPassError('सर्वर त्रुटि / Server error'); }
  };

  const updateShop = async (e) => {
    e.preventDefault(); setShopMsg(''); setShopError('');
    try {
      const res  = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(shopForm) });
      const data = await res.json();
      if (res.ok) { setShop(data); setShopMsg('दुकान की जानकारी अपडेट हो गई! / Shop details updated!'); }
      else setShopError(data.message || 'विफल / Failed');
    } catch { setShopError('सर्वर त्रुटि / Server error'); }
  };

  const sections = [
    { key: 'shop',     icon: '🏪', label: 'Shop Details',    sub: 'GST & invoices' },
    { key: 'account',  icon: '✏️', label: 'Update Name',     sub: 'Display name' },
    { key: 'password', icon: '🔒', label: 'Change Password', sub: 'Account security' },
  ];

  return (
    <Layout>
      <div style={{ marginBottom: 22 }}>
        <div className="page-title" style={{ marginBottom: 2 }}>प्रोफ़ाइल / Profile</div>
        <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Manage your account & shop settings</div>
      </div>

      <div style={{ maxWidth: 600 }}>
        {/* ── Avatar Card ── */}
        <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg, #EEF2FF, #F0FDF4)' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #4F46E5, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#fff', flexShrink: 0,
            boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
            fontFamily: 'var(--font-display)',
          }}>{user?.name?.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--text)', letterSpacing: -0.3, fontFamily: 'var(--font-display)' }}>{user?.name}</div>
            <div style={{ color: 'var(--text-4)', fontSize: 13, marginTop: 2 }}>{user?.email}</div>
            {shop?.gstin && (
              <div style={{ fontSize: 12, background: 'var(--primary-dim)', color: '#4338CA', padding: '2px 10px', borderRadius: 100, fontWeight: 700, marginTop: 6, display: 'inline-block' }}>
                GSTIN: {shop.gstin}
              </div>
            )}
          </div>
          {shop?.name && (
            <div style={{ textAlign: 'right', display: 'none' }} className="desktop-only">
              <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>SHOP</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{shop.name}</div>
            </div>
          )}
        </div>

        {/* ── Section Tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid',
              borderColor: activeSection === s.key ? '#4F46E5' : 'var(--border)',
              background: activeSection === s.key ? 'var(--primary-dim)' : 'var(--surface)',
              color: activeSection === s.key ? '#4F46E5' : 'var(--text-3)',
              cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)',
              transition: 'all 0.15s', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
              <div>{s.label}</div>
            </button>
          ))}
        </div>

        {/* ── SECTION: SHOP DETAILS ── */}
        {activeSection === 'shop' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, background: 'var(--primary-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏪</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>दुकान की जानकारी</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>GST compliance & invoices के लिए पूरा भरें</div>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <Msg ok={!!shopMsg} text={shopMsg || shopError} />

            <form onSubmit={updateShop}>
              {/* Basic Info */}
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>📋 Basic Info</div>
              <div className="form-group">
                <label className="form-label">दुकान का नाम / Shop Name *</label>
                <input className="form-input" value={shopForm.name} onChange={e => setShopForm({ ...shopForm, name: e.target.value })} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">फ़ोन / Phone</label>
                  <input className="form-input" placeholder="9876543210" value={shopForm.phone} onChange={e => setShopForm({ ...shopForm, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">ईमेल / Email</label>
                  <input className="form-input" placeholder="shop@email.com" value={shopForm.email} onChange={e => setShopForm({ ...shopForm, email: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">पता / Address</label>
                <input className="form-input" placeholder="गली का पता / Street address" value={shopForm.address} onChange={e => setShopForm({ ...shopForm, address: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">शहर / City</label>
                  <input className="form-input" placeholder="शहर" value={shopForm.city} onChange={e => setShopForm({ ...shopForm, city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">पिनकोड / Pincode</label>
                  <input className="form-input" placeholder="110001" value={shopForm.pincode} onChange={e => setShopForm({ ...shopForm, pincode: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">राज्य / State (CGST/IGST के लिए)</label>
                <select className="form-input" value={shopForm.state} onChange={e => setShopForm({ ...shopForm, state: e.target.value })}>
                  <option value="">राज्य चुनें / Select State</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN (वैकल्पिक)</label>
                <input className="form-input" placeholder="22AAAAA0000A1Z5" value={shopForm.gstin} onChange={e => setShopForm({ ...shopForm, gstin: e.target.value })} />
              </div>

              {/* Bank Details */}
              <div style={{ borderTop: '1.5px solid var(--border)', paddingTop: 16, marginTop: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>🏦 बैंक विवरण / Bank Details</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8 }}>💡 Invoice mein dikhayi dega / Will appear on invoices</div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">बैंक का नाम</label>
                    <input className="form-input" placeholder="State Bank of India" value={shopForm.bank_name} onChange={e => setShopForm({ ...shopForm, bank_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">शाखा / Branch</label>
                    <input className="form-input" placeholder="Main Branch" value={shopForm.bank_branch} onChange={e => setShopForm({ ...shopForm, bank_branch: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">खाता नंबर</label>
                    <input className="form-input" placeholder="0000000000" value={shopForm.bank_account} onChange={e => setShopForm({ ...shopForm, bank_account: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input className="form-input" placeholder="SBIN0000000" value={shopForm.bank_ifsc} onChange={e => setShopForm({ ...shopForm, bank_ifsc: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div style={{ borderTop: '1.5px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>📋 नियम एवं शर्तें</div>
                <div className="form-group">
                  <label className="form-label">Invoice पर print होगा</label>
                  <textarea className="form-input" rows={4}
                    placeholder={"1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction."}
                    value={shopForm.terms} onChange={e => setShopForm({ ...shopForm, terms: e.target.value })}
                    style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }} />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                💾 दुकान की जानकारी सहेजें
              </button>
            </form>
          </div>
        )}

        {/* ── SECTION: ACCOUNT ── */}
        {activeSection === 'account' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, background: 'var(--primary-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✏️</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>नाम बदलें / Update Name</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Sidebar और invoices पर दिखेगा</div>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
            <Msg ok={!!nameMsg} text={nameMsg || nameError} />
            <form onSubmit={updateName} style={{ display: 'flex', gap: 10 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="आपका नाम" value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} required />
              <button type="submit" className="btn-primary">अपडेट</button>
            </form>
          </div>
        )}

        {/* ── SECTION: PASSWORD ── */}
        {activeSection === 'password' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, background: 'var(--danger-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔒</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>पासवर्ड बदलें / Change Password</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Account security</div>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
            <Msg ok={!!passMsg} text={passMsg || passError} />
            <form onSubmit={updatePassword}>
              <div className="form-group">
                <label className="form-label">वर्तमान पासवर्ड *</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPass ? 'text' : 'password'} style={{ paddingRight: 44 }} value={passForm.currentPassword} onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })} required />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-4)' }}>{showPass ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">नया पासवर्ड *</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showNew ? 'text' : 'password'} style={{ paddingRight: 44 }} placeholder="Min 6 characters" value={passForm.newPassword} onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })} required />
                  <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-4)' }}>{showNew ? '🙈' : '👁️'}</button>
                </div>
                {passForm.newPassword && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', borderRadius: 99, transition: 'all 0.3s', width: passForm.newPassword.length < 6 ? '33%' : passForm.newPassword.length < 10 ? '66%' : '100%', background: passForm.newPassword.length < 6 ? '#EF4444' : passForm.newPassword.length < 10 ? '#F59E0B' : '#22C55E' }} />
                    </div>
                    <div style={{ fontSize: 11, color: passForm.newPassword.length < 6 ? '#EF4444' : passForm.newPassword.length < 10 ? '#D97706' : '#15803D', fontWeight: 700 }}>
                      {passForm.newPassword.length < 6 ? 'Weak' : passForm.newPassword.length < 10 ? 'Medium' : 'Strong ✓'}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">पासवर्ड पुष्टि *</label>
                <input className="form-input" type="password"
                  placeholder="Same as new password"
                  value={passForm.confirmPassword}
                  onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                  style={{ borderColor: passForm.confirmPassword && passForm.confirmPassword !== passForm.newPassword ? '#EF4444' : undefined }} required />
                {passForm.confirmPassword && passForm.confirmPassword !== passForm.newPassword && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: 600 }}>⚠️ Passwords don't match</div>
                )}
              </div>
              <button type="submit" className="btn-danger" style={{ width: '100%' }}>🔒 पासवर्ड बदलें</button>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}