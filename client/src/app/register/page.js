'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API = 'https://rakh-rakhaav.onrender.com';

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(2);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Server error');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Invalid OTP');
      }
    } catch {
      setError('Server error');
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    try {
      await fetch(`${API}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setError('');
      alert('OTP resent!');
    } catch {
      setError('Failed to resend');
    }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'DM Sans', sans-serif", background: '#f5f5f0' }}>
        {/* Left panel */}
        <div style={{ flex: 1, background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, color: '#fff' }} className="auth-left">
          <div style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, letterSpacing: -1 }}>
              रख<span style={{ color: '#6366f1' }}>रखाव</span>
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 48 }}>Smart inventory management</div>
            {['Track stock in real-time', 'Record sales & purchases', 'Get profit & loss insights'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>✓</div>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ width: '100%', maxWidth: 400 }}>

            {step === 1 ? (
              <>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e', marginBottom: 6, letterSpacing: -0.5 }}>Create account</h1>
                <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 32 }}>Start managing your inventory today</p>

                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>{error}</div>}

                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" type="text" placeholder="Sonaa" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" placeholder="Sona@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Sending OTP...' : 'Continue'}
                  </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: 14, color: '#9ca3af', marginTop: 24 }}>
                  Already have an account?{' '}
                  <a href="/login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
                </p>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Enter OTP</h1>
                  <p style={{ color: '#9ca3af', fontSize: 14 }}>
                    We sent a 6-digit code to<br />
                    <strong style={{ color: '#1a1a2e' }}>{email}</strong>
                  </p>
                </div>

                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleVerifyOTP}>
                  <div className="form-group">
                    <label className="form-label">6-Digit OTP</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: 12 }}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading || otp.length !== 6} style={{ width: '100%', padding: '13px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (loading || otp.length !== 6) ? 0.7 : 1 }}>
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <button onClick={handleResendOTP} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Resend OTP
                  </button>
                  <span style={{ color: '#9ca3af', margin: '0 8px' }}>·</span>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}>
                    Change email
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) { .auth-left { display: none !important; } }
          .form-input { width: 100%; }
        `}</style>
      </div>
    </>
  );
}