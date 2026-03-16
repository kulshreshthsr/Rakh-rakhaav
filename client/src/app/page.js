'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
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
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: '100vh', display: 'flex', fontFamily: "'DM Sans', sans-serif",
        background: '#f5f5f0',
      }}>
        {/* Left panel */}
        <div style={{
          flex: 1, background: '#1a1a2e', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 48, color: '#fff',
        }} className="auth-left">
          <div style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, letterSpacing: -1 }}>
              रख<span style={{ color: '#6366f1' }}>रखाव</span>
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 48, lineHeight: 1.6 }}>
              Smart inventory management for your business
            </div>
            {['Track stock in real-time', 'Record sales & purchases', 'Get profit & loss insights'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontSize: 14 }}>✓</div>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 32,
        }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e', marginBottom: 6, letterSpacing: -0.5 }}>Welcome back</h1>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 32 }}>Sign in to your account</p>

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px', background: '#6366f1', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 14, color: '#9ca3af', marginTop: 24 }}>
              Don't have an account?{' '}
              <a href="/register" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Create one</a>
            </p>
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .auth-left { display: none !important; }
          }
          .form-input { width: 100%; }
        `}</style>
      </div>
    </>
  );
}