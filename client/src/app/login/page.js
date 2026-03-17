'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
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
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Server error. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#f5f5f0', display: 'flex', flexDirection: 'column' }}>

        <div style={{ background: '#1a1a2e', padding: '48px 32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: -1, marginBottom: 6 }}>
            रख<span style={{ color: '#6366f1' }}>रखाव</span>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>Smart Inventory Manager</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['📦 Stock Track', '💰 Sales & Purchase', '📊 Profit Reports'].map((f, i) => (
              <div key={i} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#a5b4fc', fontWeight: 500 }}>
                {f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#1a1a2e', marginBottom: -1 }}>
          <svg viewBox="0 0 375 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0 0 C100 40 275 40 375 0 L375 40 L0 40 Z" fill="#f5f5f0"/>
          </svg>
        </div>

        <div style={{ flex: 1, padding: '24px 24px 40px', maxWidth: 440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', marginBottom: 4, letterSpacing: -0.5 }}>Welcome back! 👋</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 28 }}>Sign in to continue</p>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 12, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Username</label>
              <input
                type="text"
                placeholder="your_username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 15, color: '#1a1a2e', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '14px 48px 14px 16px', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 15, color: '#1a1a2e', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, padding: 0 }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '15px', background: loading ? '#9ca3af' : '#6366f1', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.3 }}
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#9ca3af', marginTop: 24 }}>
            Don't have an account?{' '}
            <a href="/register" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Create one</a>
          </p>

          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 20 }}>
            {['🔒 Secure', '⚡ Fast', '📱 Mobile Ready'].map((b, i) => (
              <div key={i} style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{b}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}