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
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060D1A; }

        .login-root {
          min-height: 100vh;
          background: #060D1A;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Animated background blobs */
        .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.12;
          pointer-events: none;
          animation: blobFloat 8s ease-in-out infinite;
        }
        .blob-1 { width: 500px; height: 500px; background: #059669; top: -100px; left: -100px; animation-delay: 0s; }
        .blob-2 { width: 400px; height: 400px; background: #0B1D35; top: 50%; right: -150px; animation-delay: -3s; }
        .blob-3 { width: 300px; height: 300px; background: #10B981; bottom: -50px; left: 30%; animation-delay: -6s; }

        @keyframes blobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.05); }
          66% { transform: translate(-15px, 20px) scale(0.95); }
        }

        /* Grid pattern overlay */
        .grid-overlay {
          position: fixed; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(5,150,105,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(5,150,105,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        /* Top section */
        .top-section {
          padding: 48px 24px 32px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; position: relative; z-index: 1;
        }

        .logo-mark {
          width: 64px; height: 64px;
          background: linear-gradient(135deg, #059669 0%, #0B1D35 100%);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 28px; color: #fff; font-weight: 800;
          margin-bottom: 20px;
          box-shadow: 0 0 0 1px rgba(5,150,105,0.3), 0 20px 40px rgba(5,150,105,0.2);
          animation: logoAppear 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }

        @keyframes logoAppear {
          from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 36px; font-weight: 800;
          color: #fff;
          letter-spacing: -1px;
          margin-bottom: 6px;
          animation: fadeUp 0.5s ease 0.2s both;
        }
        .brand-name span { color: #10B981; }

        .brand-sub {
          font-size: 13px; color: rgba(255,255,255,0.35);
          font-weight: 400; letter-spacing: 2px; text-transform: uppercase;
          margin-bottom: 28px;
          animation: fadeUp 0.5s ease 0.3s both;
        }

        .feature-pills {
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
          animation: fadeUp 0.5s ease 0.4s both;
        }
        .pill {
          background: rgba(5,150,105,0.1);
          border: 1px solid rgba(5,150,105,0.25);
          border-radius: 100px; padding: 6px 14px;
          font-size: 12px; color: #6EE7B7; font-weight: 500;
          backdrop-filter: blur(8px);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Wave divider */
        .wave-divider { position: relative; z-index: 1; line-height: 0; }

        /* Card section */
        .card-section {
          flex: 1;
          background: #F8FAFC;
          padding: 36px 24px 48px;
          position: relative; z-index: 1;
          animation: cardSlide 0.5s ease 0.3s both;
        }

        @keyframes cardSlide {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .card-inner { max-width: 420px; margin: 0 auto; }

        .greeting { font-size: 28px; font-weight: 700; color: #0F172A; letter-spacing: -0.5px; margin-bottom: 4px; }
        .greeting-sub { font-size: 14px; color: #94A3B8; margin-bottom: 28px; font-weight: 400; }

        /* Error */
        .error-box {
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 12px; padding: 12px 16px;
          font-size: 13px; color: #DC2626;
          margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
          animation: shake 0.4s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }

        /* Form */
        .field-label {
          font-size: 11px; font-weight: 700; color: #64748B;
          text-transform: uppercase; letter-spacing: 1px;
          display: block; margin-bottom: 8px;
        }

        .field-wrap { margin-bottom: 18px; }

        .input-box {
          width: 100%; padding: 14px 16px;
          border: 2px solid #E2E8F0; border-radius: 14px;
          font-size: 15px; color: #0F172A;
          background: #fff; outline: none;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-box:focus {
          border-color: #059669;
          box-shadow: 0 0 0 4px rgba(5,150,105,0.08);
        }
        .input-box::placeholder { color: #CBD5E1; }

        .pass-wrap { position: relative; }
        .pass-toggle {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          font-size: 18px; padding: 0; color: #94A3B8;
          transition: color 0.2s;
        }
        .pass-toggle:hover { color: #059669; }

        .submit-btn {
          width: 100%; padding: 15px;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: #fff; border: none; border-radius: 14px;
          font-size: 16px; font-weight: 700; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 20px rgba(5,150,105,0.35);
          transition: all 0.2s;
          position: relative; overflow: hidden;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(5,150,105,0.45);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled {
          background: #94A3B8; box-shadow: none; cursor: not-allowed;
        }
        .submit-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
          pointer-events: none;
        }

        .signup-link {
          text-align: center; font-size: 14px; color: #64748B; margin-top: 24px;
        }
        .signup-link a { color: #059669; font-weight: 700; text-decoration: none; }
        .signup-link a:hover { text-decoration: underline; }

        .trust-badges {
          display: flex; justify-content: center; gap: 24px; margin-top: 32px;
          padding-top: 24px; border-top: 1px solid #F1F5F9;
        }
        .trust-item { font-size: 11px; color: #CBD5E1; font-weight: 500; display: flex; align-items: center; gap: 4px; }

        /* Decorative dots */
        .dots-deco {
          position: absolute; right: 20px; top: 20px;
          display: grid; grid-template-columns: repeat(5, 6px); gap: 5px;
          opacity: 0.15; pointer-events: none;
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #059669; }

        @media (min-width: 640px) {
          .top-section { padding: 60px 32px 40px; }
          .brand-name { font-size: 44px; }
          .card-section { padding: 48px 32px 60px; }
        }
      `}</style>

      <div className="login-root">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="grid-overlay" />

        {/* Top Brand Section */}
        <div className="top-section">
          <div className="logo-mark">र</div>
          <div className="brand-name">रख<span>रखाव</span></div>
          <div className="brand-sub">Business Manager</div>
          <div className="feature-pills">
            {['📦 Stock Track', '💰 Sales & GST', '📊 Profit Reports', '📒 Udhaar'].map((f, i) => (
              <div key={i} className="pill">{f}</div>
            ))}
          </div>
        </div>

        {/* Wave */}
        <div className="wave-divider">
          <svg viewBox="0 0 375 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0 0 C80 48 295 48 375 0 L375 48 L0 48 Z" fill="#F8FAFC"/>
          </svg>
        </div>

        {/* Card */}
        <div className="card-section">
          <div className="card-inner" style={{ position: 'relative' }}>
            {/* Decorative dots */}
            <div className="dots-deco">
              {Array(20).fill(0).map((_, i) => <div key={i} className="dot" />)}
            </div>

            <div className="greeting">Welcome back! 👋</div>
            <div className="greeting-sub">Sign in to your account</div>

            {error && (
              <div className="error-box">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field-wrap">
                <label className="field-label">Username</label>
                <input
                  className="input-box"
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="field-wrap">
                <label className="field-label">Password</label>
                <div className="pass-wrap">
                  <input
                    className="input-box"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: 48 }}
                  />
                  <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? '⏳ Signing in...' : 'Sign in →'}
              </button>
            </form>

            <div className="signup-link">
              Don't have an account?{' '}
              <a href="/register">Create one free</a>
            </div>

            <div className="trust-badges">
              <div className="trust-item">🔒 Secure</div>
              <div className="trust-item">⚡ Fast</div>
              <div className="trust-item">📱 Mobile Ready</div>
              <div className="trust-item">🇮🇳 GST Ready</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}