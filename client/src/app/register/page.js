'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const router = useRouter();

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    border: '1.5px solid #e5e7eb', borderRadius: 12,
    fontSize: 14, color: '#1a1a2e', background: '#fff',
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none',
    transition: 'border-color 0.15s', boxSizing: 'border-box',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Server error. Please try again.');
    } finally { setLoading(false); }
  };

  const resendVerification = async () => {
    setResendLoading(true); setResendMsg('');
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setResendMsg(data.message);
    } catch {
      setResendMsg('Failed to resend. Try again.');
    } finally { setResendLoading(false); }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f0f2f5', display: 'flex' }}>

        {/* ── LEFT PANEL ── */}
        <div className="auth-left" style={{
          flex: 1, background: '#0f172a', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 48, color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(99,102,241,0.06)' }} />
          <div style={{ maxWidth: 360, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>र</div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>रख<span style={{ color: '#818cf8' }}>रखाव</span></div>
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 40, lineHeight: 1.7 }}>
              Join thousands of businesses managing inventory smarter
            </div>
            {[
              { icon: '🆓', text: 'Free to get started' },
              { icon: '📱', text: 'Works on mobile & desktop' },
              { icon: '⚡', text: 'Set up in under 2 minutes' },
              { icon: '🔐', text: 'Secure & private' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{f.icon}</div>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', position: 'relative' }}>

          {/* Mobile top branding */}
          <div className="mobile-brand" style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            background: '#0f172a', padding: '0 0 40px',
            borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>र</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>रख<span style={{ color: '#818cf8' }}>रखाव</span></div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' }}>Inventory Manager</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {[1,2,3].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 1 ? '#6366f1' : 'rgba(255,255,255,0.2)' }} />)}
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

            {/* ── SUCCESS STATE ── */}
            {success ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Check your email!</h2>
                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                  We sent a verification link to <strong>{email}</strong>. Click the link to activate your account.
                </p>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#065f46' }}>
                  ✅ Link expires in 24 hours
                </div>
                {resendMsg && (
                  <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 10, padding: '10px', marginBottom: 16, fontSize: 13, color: '#6d28d9' }}>
                    {resendMsg}
                  </div>
                )}
                <button onClick={resendVerification} disabled={resendLoading} style={{
                  width: '100%', padding: '12px', background: 'transparent',
                  color: '#6366f1', border: '1.5px solid #6366f1', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
                }}>
                  {resendLoading ? 'Sending...' : '📨 Resend verification email'}
                </button>
                <a href="/login" style={{ display: 'block', textAlign: 'center', color: '#64748b', fontSize: 14, textDecoration: 'none' }}>
                  Back to login →
                </a>
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 }}>Create account 🚀</h1>
                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>Start managing your inventory today</p>

                {error && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ⚠️ {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Full Name</label>
                    <input type="text" placeholder="Tarun Gupta" value={name} onChange={e => setName(e.target.value)} required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Email</label>
                    <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Password</label>
                    <input type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <button type="submit" disabled={loading} style={{
                    width: '100%', padding: '14px',
                    background: loading ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                  }}>
                    {loading ? '⏳ Creating account...' : 'Create account →'}
                  </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                </div>

                <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
                  Already have an account?{' '}
                  <a href="/login" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Sign in →</a>
                </p>
              </>
            )}
          </div>
        </div>

        <style>{`
          .auth-left { display: flex; }
          .mobile-brand { display: none !important; }
          @media (max-width: 768px) {
            .auth-left { display: none !important; }
            .mobile-brand { display: flex !important; height: 190px; }
            .auth-card { margin-top: 150px !important; border-radius: 24px !important; padding: 28px 20px !important; }
          }
        `}</style>
      </div>
    </>
  );
}