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

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColor = ['#E2E8F0', '#EF4444', '#F59E0B', '#10B981'][strength];
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'][strength];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060D1A; }

        .reg-root {
          min-height: 100vh;
          background: #060D1A;
          display: flex; flex-direction: column;
          font-family: 'DM Sans', sans-serif;
          position: relative; overflow: hidden;
        }

        .blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.1; pointer-events: none; animation: blobFloat 10s ease-in-out infinite; }
        .blob-1 { width: 450px; height: 450px; background: #059669; top: -80px; right: -80px; animation-delay: 0s; }
        .blob-2 { width: 350px; height: 350px; background: #1E40AF; bottom: 100px; left: -100px; animation-delay: -4s; }
        .blob-3 { width: 250px; height: 250px; background: #10B981; top: 40%; left: 40%; animation-delay: -7s; }

        @keyframes blobFloat {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(-20px, 30px) scale(1.06); }
          66% { transform: translate(15px, -20px) scale(0.94); }
        }

        .grid-overlay {
          position: fixed; inset: 0; pointer-events: none;
          background-image: linear-gradient(rgba(5,150,105,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(5,150,105,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .top-section {
          padding: 40px 24px 28px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; position: relative; z-index: 1;
        }

        .logo-mark {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #059669, #0B1D35);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 24px; color: #fff; font-weight: 800;
          margin-bottom: 16px;
          box-shadow: 0 0 0 1px rgba(5,150,105,0.3), 0 16px 32px rgba(5,150,105,0.2);
          animation: logoIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes logoIn {
          from { opacity: 0; transform: scale(0.4) rotate(15deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 800; color: #fff; letter-spacing: -0.5px;
          margin-bottom: 4px;
          animation: fadeUp 0.5s ease 0.2s both;
        }
        .brand-name span { color: #10B981; }
        .brand-sub { font-size: 12px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; animation: fadeUp 0.5s ease 0.3s both; }

        .feature-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; animation: fadeUp 0.5s ease 0.4s both; }
        .feat-chip {
          background: rgba(5,150,105,0.1); border: 1px solid rgba(5,150,105,0.2);
          border-radius: 100px; padding: 5px 12px;
          font-size: 11px; color: #6EE7B7; font-weight: 500;
        }

        @keyframes fadeUp { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform: translateY(0); } }

        .wave-divider { position: relative; z-index: 1; line-height: 0; }

        .card-section {
          flex: 1; background: #F8FAFC;
          padding: 32px 24px 48px;
          position: relative; z-index: 1;
          animation: cardIn 0.5s ease 0.3s both;
        }
        @keyframes cardIn { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform: translateY(0); } }

        .card-inner { max-width: 420px; margin: 0 auto; }

        .greeting { font-size: 26px; font-weight: 700; color: #0F172A; letter-spacing: -0.5px; margin-bottom: 4px; }
        .greeting-sub { font-size: 14px; color: #94A3B8; margin-bottom: 24px; }

        .error-box {
          background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px;
          padding: 12px 16px; font-size: 13px; color: #DC2626;
          margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
          animation: shake 0.4s ease;
        }
        @keyframes shake { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-4px); } 40%,80% { transform:translateX(4px); } }

        .field-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 7px; }
        .field-wrap { margin-bottom: 16px; }
        .hint { font-size: 11px; color: #CBD5E1; margin-top: 5px; padding-left: 2px; }

        .input-box {
          width: 100%; padding: 13px 16px;
          border: 2px solid #E2E8F0; border-radius: 13px;
          font-size: 15px; color: #0F172A; background: #fff; outline: none;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-box:focus { border-color: #059669; box-shadow: 0 0 0 4px rgba(5,150,105,0.08); }
        .input-box::placeholder { color: #CBD5E1; }

        .pass-wrap { position: relative; }
        .pass-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; color: #94A3B8; padding: 0; transition: color 0.2s; }
        .pass-toggle:hover { color: #059669; }

        .strength-bar { margin-top: 8px; }
        .strength-track { height: 4px; background: #E2E8F0; border-radius: 99px; overflow: hidden; }
        .strength-fill { height: 100%; border-radius: 99px; transition: width 0.3s ease, background 0.3s; }
        .strength-label { font-size: 11px; margin-top: 4px; font-weight: 600; }

        .submit-btn {
          width: 100%; padding: 15px;
          background: linear-gradient(135deg, #059669, #047857);
          color: #fff; border: none; border-radius: 14px;
          font-size: 16px; font-weight: 700; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 20px rgba(5,150,105,0.35);
          transition: all 0.2s; position: relative; overflow: hidden;
          margin-top: 4px;
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(5,150,105,0.45); }
        .submit-btn:disabled { background: #94A3B8; box-shadow: none; cursor: not-allowed; }
        .submit-btn::after { content:''; position:absolute; inset:0; background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent); pointer-events:none; }

        .login-link { text-align: center; font-size: 14px; color: #64748B; margin-top: 22px; }
        .login-link a { color: #059669; font-weight: 700; text-decoration: none; }
        .login-link a:hover { text-decoration: underline; }

        .benefits-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          margin-top: 28px; padding-top: 24px; border-top: 1px solid #F1F5F9;
        }
        .benefit-item {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: #94A3B8; font-weight: 500;
        }
        .benefit-icon {
          width: 28px; height: 28px; border-radius: 8px;
          background: #F1F5F9;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; flex-shrink: 0;
        }
      `}</style>

      <div className="reg-root">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="grid-overlay" />

        <div className="top-section">
          <div className="logo-mark">र</div>
          <div className="brand-name">रख<span>रखाव</span></div>
          <div className="brand-sub">Smart Business Manager</div>
          <div className="feature-row">
            {['✓ Free Forever', '✓ GST Ready', '✓ Mobile First', '✓ Instant Setup'].map((f, i) => (
              <div key={i} className="feat-chip">{f}</div>
            ))}
          </div>
        </div>

        <div className="wave-divider">
          <svg viewBox="0 0 375 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0 0 C80 48 295 48 375 0 L375 48 L0 48 Z" fill="#F8FAFC"/>
          </svg>
        </div>

        <div className="card-section">
          <div className="card-inner">
            <div className="greeting">Create account 🚀</div>
            <div className="greeting-sub">Start managing your business today — free</div>

            {error && <div className="error-box"><span>⚠️</span> {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field-wrap">
                <label className="field-label">Full Name</label>
                <input className="input-box" type="text" placeholder="Sonaa" value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div className="field-wrap">
                <label className="field-label">Username</label>
                <input className="input-box" type="text" placeholder="sona_shop" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))} required />
                <div className="hint">Sirf lowercase letters, numbers aur underscore</div>
              </div>

              <div className="field-wrap">
                <label className="field-label">Password</label>
                <div className="pass-wrap">
                  <input className="input-box" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 48 }} />
                  <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="strength-bar">
                    <div className="strength-track">
                      <div className="strength-fill" style={{ width: `${[0, 33, 66, 100][strength]}%`, background: strengthColor }} />
                    </div>
                    <div className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</div>
                  </div>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? '⏳ Creating account...' : 'Create account →'}
              </button>
            </form>

            <div className="login-link">
              Already have an account? <a href="/login">Sign in</a>
            </div>

            <div className="benefits-row">
              {[
                { icon: '📦', text: 'Stock Management' },
                { icon: '🧾', text: 'GST Invoices' },
                { icon: '📒', text: 'Udhaar Ledger' },
                { icon: '📊', text: 'Profit Reports' },
              ].map((b, i) => (
                <div key={i} className="benefit-item">
                  <div className="benefit-icon">{b.icon}</div>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}