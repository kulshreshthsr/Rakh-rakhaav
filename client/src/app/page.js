'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://rakh-rakhaav.onrender.com';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass]  = useState(false);
  const [error, setError]        = useState('');
  const [loading, setLoading]    = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
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
        setError(data.message || 'Login failed. Check credentials.');
      }
    } catch {
      setError('Server error. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Inter', sans-serif",
      background: '#F1F5F9',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── LEFT PANEL (branding) ── */}
      <div className="login-left" style={{
        flex: 1,
        background: 'linear-gradient(145deg, #0B1D35 0%, #122D4F 50%, #1A3F6F 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 40px',
        borderRight: '1px solid rgba(5,150,105,0.15)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(5,150,105,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(5,150,105,0.04)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <LogoMark size={64} />
          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1, marginTop: 16, fontFamily: 'serif' }}>
            रख<span style={{ color: '#10B981' }}>रखाव</span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(52,211,153,0.5)', fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
            Business Manager
          </div>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 280 }}>
          {[
            { icon: '📦', title: 'Stock Management', desc: 'Real-time inventory tracking' },
            { icon: '🧾', title: 'GST Billing',      desc: 'Auto B2B/B2C classification' },
            { icon: '📊', title: 'Profit Reports',   desc: 'Daily, weekly, monthly insights' },
            { icon: '🤝', title: 'Udhaar Ledger',    desc: 'Customer & supplier credit tracking' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{f.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div style={{
        width: '100%', maxWidth: 480,
        minWidth: 0,
        background: '#F1F5F9',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(24px, 5vw, 48px) clamp(20px, 6vw, 40px)',
      }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 6, letterSpacing: -0.5 }}>
            Welcome back 👋
          </h1>
          <p style={{ fontSize: 14, color: '#64748B' }}>
            Sign in to your Rakhaav account
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '11px 14px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              placeholder="your_username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: 'Inter, sans-serif' }}
              onFocus={e => e.target.style.borderColor = '#059669'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 46px 12px 14px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: 'Inter, sans-serif' }}
                onFocus={e => e.target.style.borderColor = '#059669'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: 0, color: '#94A3B8' }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? '#94A3B8' : 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
              transition: 'all 0.2s',
              fontFamily: 'Inter, sans-serif',
            }}>
            {loading ? '⏳ Signing in...' : 'Sign in →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13.5, color: '#64748B', marginTop: 24 }}>
          Don't have an account?{' '}
          <a href="/register" style={{ color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
            Create one free
          </a>
        </p>

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 32 }}>
          {['🔒 Secure', '⚡ Fast', '📱 Mobile Ready'].map((b, i) => (
            <div key={i} style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{b}</div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left { display: none !important; }
        }
        input:focus { box-shadow: 0 0 0 3px rgba(5,150,105,0.12); }
      `}</style>
    </div>
  );
}

function LogoMark({ size = 40 }) {
  const [err, setErr] = useState(false);
  if (!err) {
    return (
      <img src="/logo.png" alt="Rakhaav" width={size} height={size}
        style={{ borderRadius: size * 0.25, objectFit: 'contain', border: '1px solid rgba(5,150,105,0.3)' }}
        onError={() => setErr(true)} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25, background: 'linear-gradient(135deg, #122D4F, #1A3F6F)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(5,150,105,0.3)' }}>
      <span style={{ fontSize: size * 0.4, fontWeight: 800, color: '#10B981', fontFamily: 'serif' }}>र</span>
    </div>
  );
}