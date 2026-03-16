'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ email, password }),
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
      setError('Server error. Is the backend running?');
    } finally { setLoading(false); }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#f5f5f0', display: 'flex' }}>

        {/* ── LEFT PANEL (desktop only) ── */}
        <div className="auth-left" style={{
          flex: 1, background: '#1a1a2e', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 48, color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          {/* Background decoration */}
          <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(99,102,241,0.06)' }} />

          <div style={{ maxWidth: 360, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 8, letterSpacing: -1 }}>
              रख<span style={{ color: '#6366f1' }}>रखाव</span>
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 52, lineHeight: 1.7 }}>
              Smart inventory management for your business
            </div>
            {[
              { icon: '📦', text: 'Track stock in real-time' },
              { icon: '💰', text: 'Record sales & purchases' },
              { icon: '📊', text: 'Get profit & loss insights' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{f.icon}</div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0',
          background: '#f5f5f0', position: 'relative',
        }}>
          {/* Mobile top branding */}
          <div className="mobile-brand" style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            background: '#1a1a2e', padding: '0 0 40px',
            borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -1, marginBottom: 6 }}>
              रख<span style={{ color: '#6366f1' }}>रखाव</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' }}>Inventory Manager</div>
            {/* Decorative dots */}
            <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
              {[1,2,3].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 2 ? '#6366f1' : 'rgba(255,255,255,0.2)' }} />)}
            </div>
          </div>

          {/* Form card */}
          <div className="auth-card" style={{
            width: '100%', maxWidth: 420,
            background: '#fff', borderRadius: 24,
            padding: '36px 32px',
            boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', marginBottom: 4, letterSpacing: -0.5 }}>Welcome back 👋</h1>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 28 }}>Sign in to your account</p>

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Email</label>
                <input
                  type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  style={{
                    width: '100%', padding: '12px 16px',
                    border: '1.5px solid #e5e7eb', borderRadius: 12,
                    fontSize: 14, color: '#1a1a2e', background: '#fff',
                    fontFamily: "'DM Sans', sans-serif", outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Password</label>
                <input
                  type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required
                  style={{
                    width: '100%', padding: '12px 16px',
                    border: '1.5px solid #e5e7eb', borderRadius: 12,
                    fontSize: 14, color: '#1a1a2e', background: '#fff',
                    fontFamily: "'DM Sans', sans-serif", outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px',
                background: loading ? '#a5b4fc' : '#6366f1',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', letterSpacing: 0.3,
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}>
                {loading ? '⏳ Signing in...' : 'Sign in →'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
              <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            </div>

            <p style={{ textAlign: 'center', fontSize: 14, color: '#9ca3af' }}>
              Don't have an account?{' '}
              <a href="/register" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Create one →</a>
            </p>
          </div>
        </div>

        <style>{`
          .auth-left { display: flex; }
          .mobile-brand { display: none !important; }

          @media (max-width: 768px) {
            .auth-left { display: none !important; }
            .mobile-brand { display: flex !important; height: 200px; }
            .auth-card {
              margin-top: 160px !important;
              border-radius: 24px !important;
              padding: 28px 24px !important;
              box-shadow: 0 -4px 40px rgba(0,0,0,0.08) !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}