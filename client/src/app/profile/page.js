'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [nameForm, setNameForm] = useState({ name: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [shopForm, setShopForm] = useState({ name: '', address: '', city: '', state: '', pincode: '', gstin: '', phone: '', email: '' });
  const [nameMsg, setNameMsg] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [shopMsg, setShopMsg] = useState('');
  const [nameError, setNameError] = useState('');
  const [passError, setPassError] = useState('');
  const [shopError, setShopError] = useState('');
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
      setShopForm({ name: data.name || '', address: data.address || '', city: data.city || '', state: data.state || '', pincode: data.pincode || '', gstin: data.gstin || '', phone: data.phone || '', email: data.email || '' });
    } catch {}
  };

  const updateName = async (e) => {
    e.preventDefault(); setNameMsg(''); setNameError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ name: nameForm.name }) });
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
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }) });
      const data = await res.json();
      if (res.ok) { setPassMsg('पासवर्ड बदल गया! / Password updated!'); setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
      else setPassError(data.message || 'विफल / Failed');
    } catch { setPassError('सर्वर त्रुटि / Server error'); }
  };

  const updateShop = async (e) => {
    e.preventDefault(); setShopMsg(''); setShopError('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/shop', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(shopForm) });
      const data = await res.json();
      if (res.ok) { setShop(data); setShopMsg('दुकान की जानकारी अपडेट हो गई! / Shop details updated!'); }
      else setShopError(data.message || 'विफल / Failed');
    } catch { setShopError('सर्वर त्रुटि / Server error'); }
  };

  return (
    <Layout>
      <div className="page-title">प्रोफ़ाइल / Profile & Settings</div>
      <div style={{ maxWidth: 560 }}>

        {/* Avatar */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>{user?.name}</div>
            <div style={{ color: '#9ca3af', fontSize: 14 }}>{user?.email}</div>
            {shop?.gstin && <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginTop: 2 }}>GSTIN: {shop.gstin}</div>}
          </div>
        </div>

        {/* Shop Details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 2 }}>🏪 दुकान की जानकारी / Shop Details</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>GST अनुपालन के लिए पूरा भरें / Fill completely for GST compliance</div>
          {shopMsg && <div style={{ background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{shopMsg}</div>}
          {shopError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{shopError}</div>}
          <form onSubmit={updateShop}>
            <div className="form-group"><label className="form-label">दुकान का नाम / Shop Name *</label><input className="form-input" value={shopForm.name} onChange={e => setShopForm({ ...shopForm, name: e.target.value })} required /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">फ़ोन / Phone</label><input className="form-input" placeholder="9876543210" value={shopForm.phone} onChange={e => setShopForm({ ...shopForm, phone: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">ईमेल / Email</label><input className="form-input" placeholder="shop@email.com" value={shopForm.email} onChange={e => setShopForm({ ...shopForm, email: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">पता / Address</label><input className="form-input" placeholder="गली का पता / Street address" value={shopForm.address} onChange={e => setShopForm({ ...shopForm, address: e.target.value })} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">शहर / City</label><input className="form-input" placeholder="शहर / City" value={shopForm.city} onChange={e => setShopForm({ ...shopForm, city: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">पिनकोड / Pincode</label><input className="form-input" placeholder="110001" value={shopForm.pincode} onChange={e => setShopForm({ ...shopForm, pincode: e.target.value })} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">राज्य / State (CGST/IGST के लिए)</label>
              <select className="form-input" value={shopForm.state} onChange={e => setShopForm({ ...shopForm, state: e.target.value })}>
                <option value="">राज्य चुनें / Select State</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">GSTIN (वैकल्पिक / optional)</label><input className="form-input" placeholder="22AAAAA0000A1Z5" value={shopForm.gstin} onChange={e => setShopForm({ ...shopForm, gstin: e.target.value })} /></div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>दुकान की जानकारी सहेजें / Save Shop Details</button>
          </form>
        </div>

        {/* Update name */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 16 }}>✏️ नाम बदलें / Update Name</div>
          {nameMsg && <div style={{ background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{nameMsg}</div>}
          {nameError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{nameError}</div>}
          <form onSubmit={updateName} style={{ display: 'flex', gap: 10 }}>
            <input className="form-input" style={{ flex: 1 }} value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} required />
            <button type="submit" className="btn-primary">अपडेट / Update</button>
          </form>
        </div>

        {/* Change password */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 16 }}>🔒 पासवर्ड बदलें / Change Password</div>
          {passMsg && <div style={{ background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{passMsg}</div>}
          {passError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{passError}</div>}
          <form onSubmit={updatePassword}>
            <div className="form-group"><label className="form-label">वर्तमान पासवर्ड / Current Password</label><input className="form-input" type="password" value={passForm.currentPassword} onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">नया पासवर्ड / New Password</label><input className="form-input" type="password" value={passForm.newPassword} onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">पासवर्ड पुष्टि / Confirm Password</label><input className="form-input" type="password" value={passForm.confirmPassword} onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })} required /></div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>पासवर्ड बदलें / Change Password</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}