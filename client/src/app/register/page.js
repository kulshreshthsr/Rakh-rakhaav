'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Server error. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#0B1D35', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '40px 32px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: -1, marginBottom: 6, fontFamily: 'serif' }}>
            रख<span style={{ color: '#10B981' }}>रखाव</span>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Join smart shopkeepers today</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['✓ Free to use', '✓ Mobile ready', '✓ GST compliant'].map((f, i) => (
              <div key={i} style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#6EE7B7', fontWeight: 500 }}>
                {f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#0B1D35', marginBottom: -1 }}>
          <svg viewBox="0 0 375 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0 0 C100 40 275 40 375 0 L375 40 L0 40 Z" fill="#F1F5F9"/>
          </svg>
        </div>

        <div style={{ flex: 1, background: '#F1F5F9', padding: '28px 24px 40px', maxWidth: 440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', marginBottom: 4, letterSpacing: -0.5 }}>Create account 🚀</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 28 }}>Start managing your business today</p>

          {error && (
            <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Full Name</label>
              <input type="text" placeholder="Sonaa" value={name}
                onChange={e => setName(e.target.value)} required
                style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 15, color: '#0F172A', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                onFocus={e => e.target.style.borderColor = '#059669'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Username</label>
              <input type="text" placeholder="sona_shop" value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))} required
                style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 15, color: '#0F172A', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                onFocus={e => e.target.style.borderColor = '#059669'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16, paddingLeft: 4 }}>
              Only lowercase letters, numbers and underscores
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" value={password}
                  onChange={e => setPassword(e.target.value)} required
                  style={{ width: '100%', padding: '14px 48px 14px 16px', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 15, color: '#0F172A', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                  onFocus={e => e.target.style.borderColor = '#059669'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18, padding: 0 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '14px', background: loading ? '#94A3B8' : 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 14px rgba(5,150,105,0.35)', fontFamily: 'Inter, sans-serif' }}>
              {loading ? '⏳ Creating account...' : 'Create account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#64748B', marginTop: 24 }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#059669', fontWeight: 700, textDecoration: 'none' }}>Sign in</a>
          </p>
        </div>
      </div>
    </>
  );
}