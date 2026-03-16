'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('Invalid verification link.'); return; }
    verifyEmail(token);
  }, []);

  const verifyEmail = async (token) => {
    try {
      const res = await fetch(`https://rakh-rakhaav.onrender.com/api/auth/verify-email?token=${token}`);
      const data = await res.json();
      if (res.ok) { setStatus('success'); setMessage(data.message); }
      else { setStatus('error'); setMessage(data.message); }
    } catch {
      setStatus('error'); setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 40px rgba(0,0,0,0.08)' }}>

          {status === 'loading' && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Verifying your email...</h2>
              <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Email Verified!</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>{message}</p>
              <button onClick={() => router.push('/login')} style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}>
                Go to Login →
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Verification Failed</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>{message}</p>
              <button onClick={() => router.push('/register')} style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                Back to Register →
              </button>
            </>
          )}

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>रख<span style={{ color: '#6366f1' }}>रखाव</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
