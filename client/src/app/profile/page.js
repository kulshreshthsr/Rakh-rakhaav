'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [nameForm, setNameForm] = useState({ name: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [nameMsg, setNameMsg] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [nameError, setNameError] = useState('');
  const [passError, setPassError] = useState('');
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    setUser(u);
    setNameForm({ name: u.name });
  }, []);

  const updateName = async (e) => {
    e.preventDefault(); setNameMsg(''); setNameError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: nameForm.name }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...user, name: nameForm.name };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setNameMsg('Name updated!');
      } else setNameError(data.message || 'Failed');
    } catch { setNameError('Server error'); }
  };

  const updatePassword = async (e) => {
    e.preventDefault(); setPassMsg(''); setPassError('');
    if (passForm.newPassword !== passForm.confirmPassword) { setPassError('Passwords do not match'); return; }
    if (passForm.newPassword.length < 6) { setPassError('Min 6 characters'); return; }
    try {
      const res = await fetch('http://localhost:5000/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) { setPassMsg('Password updated!'); setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
      else setPassError(data.message || 'Failed');
    } catch { setPassError('Server error'); }
  };

  return (
    <Layout>
      <div className="page-title">Profile & Settings</div>

      <div style={{ maxWidth: 520 }}>
        {/* Avatar + info */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>{user?.name}</div>
            <div style={{ color: '#9ca3af', fontSize: 14 }}>{user?.email}</div>
          </div>
        </div>

        {/* Update name */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 16 }}>Update Name</div>
          {nameMsg && <div style={{ background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{nameMsg}</div>}
          {nameError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{nameError}</div>}
          <form onSubmit={updateName} style={{ display: 'flex', gap: 10 }}>
            <input className="form-input" style={{ flex: 1 }} value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} required />
            <button type="submit" className="btn-primary">Update</button>
          </form>
        </div>

        {/* Change password */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 16 }}>Change Password</div>
          {passMsg && <div style={{ background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{passMsg}</div>}
          {passError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{passError}</div>}
          <form onSubmit={updatePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input className="form-input" type="password" value={passForm.currentPassword} onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={passForm.newPassword} onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={passForm.confirmPassword} onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>Change Password</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}