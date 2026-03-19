'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];

const S = {
  section: { background: '#fff', borderRadius: 16, padding: '22px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 },
  sectionTitle: { fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#94A3B8', marginBottom: 18 },
  divider: { borderTop: '1px solid #F1F5F9', paddingTop: 16, marginTop: 4, marginBottom: 8 },
  subLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
};

export default function ProfilePage() {
  const [user, setUser]         = useState(null);
  const [shop, setShop]         = useState(null);
  const [nameForm, setNameForm] = useState({ name: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [shopForm, setShopForm] = useState({ name: '', address: '', city: '', state: '', pincode: '', gstin: '', phone: '', email: '', bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: '', terms: '' });
  const [nameMsg, setNameMsg]   = useState('');
  const [passMsg, setPassMsg]   = useState('');
  const [shopMsg, setShopMsg]   = useState('');
  const [nameError, setNameError] = useState('');
  const [passError, setPassError] = useState('');
  const [shopError, setShopError] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const router = useRouter();
  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    setUser(u); setNameForm({ name: u.name });
    fetchShop();
  }, []);

  const fetchShop = async () => {
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      setShop(data);
      setShopForm({ name: data.name || '', address: data.address || '', city: data.city || '', state: data.state || '', pincode: data.pincode || '', gstin: data.gstin || '', phone: data.phone || '', email: data.email || '', bank_name: data.bank_name || '', bank_account: data.bank_account || '', bank_ifsc: data.bank_ifsc || '', bank_branch: data.bank_branch || '', terms: data.terms || '' });
    } catch {}
  };

  const updateName = async (e) => {
    e.preventDefault(); setNameMsg(''); setNameError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ name: nameForm.name }) });
      const data = await res.json();
      if (res.ok) { const updated = { ...user, name: nameForm.name }; localStorage.setItem('user', JSON.stringify(updated)); setUser(updated); setNameMsg('नाम अपडेट हो गया! ✅'); }
      else setNameError(data.message || 'विफल');
    } catch { setNameError('सर्वर त्रुटि'); }
  };

  const updatePassword = async (e) => {
    e.preventDefault(); setPassMsg(''); setPassError('');
    if (passForm.newPassword !== passForm.confirmPassword) { setPassError('पासवर्ड मेल नहीं खाते'); return; }
    if (passForm.newPassword.length < 6) { setPassError('कम से कम 6 अक्षर'); return; }
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }) });
      const data = await res.json();
      if (res.ok) { setPassMsg('पासवर्ड बदल गया! ✅'); setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
      else setPassError(data.message || 'विफल');
    } catch { setPassError('सर्वर त्रुटि'); }
  };

  const updateShop = async (e) => {
    e.preventDefault(); setShopMsg(''); setShopError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(shopForm) });
      const data = await res.json();
      if (res.ok) { setShop(data); setShopMsg('दुकान की जानकारी अपडेट हो गई! ✅'); }
      else setShopError(data.message || 'विफल');
    } catch { setShopError('सर्वर त्रुटि'); }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 7 };
  const msgBox = (msg, type) => msg ? <div style={{ background: type === 'success' ? '#F0FDF4' : '#FEF2F2', color: type === 'success' ? '#166534' : '#991B1B', border: `1px solid ${type === 'success' ? '#BBF7D0' : '#FECACA'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>{type === 'success' ? '✅' : '⚠️'} {msg}</div> : null;

  return (
    <Layout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap'); .profile-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.08) !important; } @media(max-width:640px){.profile-grid{grid-template-columns:1fr !important;}.profile-max{max-width:100% !important;}}`}</style>

      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 20 }}>
        प्रोफ़ाइल / Profile ⚙️
      </div>

      <div className="profile-max" style={{ maxWidth: 580 }}>

        {/* Avatar Card */}
        <div style={{ ...S.section, background: 'linear-gradient(135deg, #060D1A, #0B1D35)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #059669, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0, boxShadow: '0 0 0 3px rgba(5,150,105,0.3), 0 8px 24px rgba(5,150,105,0.2)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 800, fontSize: 20, color: '#fff', marginBottom: 2 }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{user?.username || user?.email}</div>
              {shop?.gstin && <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginTop: 4, background: 'rgba(5,150,105,0.15)', display: 'inline-block', padding: '2px 10px', borderRadius: 20 }}>GSTIN: {shop.gstin}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Shop', value: shop?.name || '—' },
              { label: 'City', value: shop?.city || '—' },
              { label: 'State', value: shop?.state || '—' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Shop Details */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🏪 दुकान की जानकारी</div>
          <div style={S.sectionSub}>Invoice aur GST ke liye poora bharo</div>
          {msgBox(shopMsg, 'success')}
          {msgBox(shopError, 'error')}
          <form onSubmit={updateShop}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>दुकान का नाम *</label>
              <input className="profile-input" style={inputStyle} value={shopForm.name} onChange={e => setShopForm({ ...shopForm, name: e.target.value })} required />
            </div>
            <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={labelStyle}>Phone</label><input className="profile-input" style={inputStyle} placeholder="9876543210" value={shopForm.phone} onChange={e => setShopForm({ ...shopForm, phone: e.target.value })} /></div>
              <div><label style={labelStyle}>Email</label><input className="profile-input" style={inputStyle} placeholder="shop@email.com" value={shopForm.email} onChange={e => setShopForm({ ...shopForm, email: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Address</label>
              <input className="profile-input" style={inputStyle} placeholder="Street address" value={shopForm.address} onChange={e => setShopForm({ ...shopForm, address: e.target.value })} />
            </div>
            <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={labelStyle}>City</label><input className="profile-input" style={inputStyle} value={shopForm.city} onChange={e => setShopForm({ ...shopForm, city: e.target.value })} /></div>
              <div><label style={labelStyle}>Pincode</label><input className="profile-input" style={inputStyle} placeholder="110001" value={shopForm.pincode} onChange={e => setShopForm({ ...shopForm, pincode: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>State (CGST/IGST ke liye)</label>
              <select className="profile-input" style={{ ...inputStyle, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394A3B8' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36, appearance: 'none' }} value={shopForm.state} onChange={e => setShopForm({ ...shopForm, state: e.target.value })}>
                <option value="">राज्य चुनें</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>GSTIN (optional)</label>
              <input className="profile-input" style={inputStyle} placeholder="22AAAAA0000A1Z5" value={shopForm.gstin} onChange={e => setShopForm({ ...shopForm, gstin: e.target.value })} />
            </div>

            {/* Bank */}
            <div style={S.divider}>
              <div style={S.subLabel}>🏦 Bank Details</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>Invoice mein dikhayi dega</div>
              <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={labelStyle}>Bank Name</label><input className="profile-input" style={inputStyle} placeholder="State Bank of India" value={shopForm.bank_name} onChange={e => setShopForm({ ...shopForm, bank_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Branch</label><input className="profile-input" style={inputStyle} placeholder="Main Branch" value={shopForm.bank_branch} onChange={e => setShopForm({ ...shopForm, bank_branch: e.target.value })} /></div>
              </div>
              <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={labelStyle}>Account No.</label><input className="profile-input" style={inputStyle} placeholder="0000000000" value={shopForm.bank_account} onChange={e => setShopForm({ ...shopForm, bank_account: e.target.value })} /></div>
                <div><label style={labelStyle}>IFSC Code</label><input className="profile-input" style={inputStyle} placeholder="SBIN0000000" value={shopForm.bank_ifsc} onChange={e => setShopForm({ ...shopForm, bank_ifsc: e.target.value })} /></div>
              </div>
            </div>

            {/* Terms */}
            <div>
              <label style={labelStyle}>📋 Terms & Conditions</label>
              <textarea className="profile-input" style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} rows={3} placeholder="1. Goods once sold will not be taken back." value={shopForm.terms} onChange={e => setShopForm({ ...shopForm, terms: e.target.value })} />
            </div>

            <button type="submit" style={{ marginTop: 16, width: '100%', padding: '14px', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
              ✅ दुकान की जानकारी सहेजें
            </button>
          </form>
        </div>

        {/* Update Name */}
        <div style={S.section}>
          <div style={S.sectionTitle}>✏️ नाम बदलें</div>
          {msgBox(nameMsg, 'success')}
          {msgBox(nameError, 'error')}
          <form onSubmit={updateName} style={{ display: 'flex', gap: 10 }}>
            <input className="profile-input" style={{ ...inputStyle, flex: 1 }} value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} required />
            <button type="submit" style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>Update</button>
          </form>
        </div>

        {/* Change Password */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🔒 पासवर्ड बदलें</div>
          {msgBox(passMsg, 'success')}
          {msgBox(passError, 'error')}
          <form onSubmit={updatePassword}>
            {[
              { label: 'Current Password', key: 'currentPassword', placeholder: '••••••••' },
              { label: 'New Password', key: 'newPassword', placeholder: 'Min. 6 characters' },
              { label: 'Confirm Password', key: 'confirmPassword', placeholder: 'Repeat new password' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{field.label}</label>
                <input className="profile-input" style={inputStyle} type="password" placeholder={field.placeholder}
                  value={passForm[field.key]} onChange={e => setPassForm({ ...passForm, [field.key]: e.target.value })} required />
              </div>
            ))}
            <button type="submit" style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0F172A, #1E293B)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              🔒 पासवर्ड बदलें
            </button>
          </form>
        </div>

      </div>
    </Layout>
  );
}