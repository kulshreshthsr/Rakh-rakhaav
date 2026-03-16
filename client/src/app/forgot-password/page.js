'use client';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch('https://rakh-rakhaav.onrender.com/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setSuccess(true);
      else setError(data.message || 'Failed');
    } catch { setError('Server error. Try again.'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', maxWidth: 420, width: '100%', boxShadow: '0 4px 40px rgba(0,0,0,0.08)' }}>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>रख<span style={{ color: '#6366f1' }}>रखाव</span></div>
          </div>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Check your email!</h2>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                We sent a password reset link to <strong>{email}</strong>. Link expires in 1 hour.
              </p>
              <a href="/login" style={{ display: 'block', textAlign: 'center', color: '#6366f1', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Back to login →</a>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Forgot password? 🔐</h1>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>Enter your email and we'll send you a reset link.</p>

              {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={{
                    width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: 12,
                    fontSize: 14, color: '#1a1a2e', background: '#fff', outline: 'none',
                    fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: 'border-box',
                  }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '14px',
                  background: loading ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.35)', marginBottom: 16,
                }}>
                  {loading ? '⏳ Sending...' : 'Send reset link →'}
                </button>
              </form>
              <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
                Remember your password?{' '}
                <a href="/login" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Sign in →</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}