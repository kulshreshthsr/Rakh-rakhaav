'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ── Profile removed from navItems — accessible via user avatar dropdown ──────
const navItems = [
  { href: '/dashboard', labelHi: 'होम',       labelEn: 'Dashboard', icon: '🏠' },
  { href: '/product',   labelHi: 'उत्पाद',    labelEn: 'Products',  icon: '📦' },
  { href: '/sales',     labelHi: 'बिक्री',    labelEn: 'Sales',     icon: '📈' },
  { href: '/purchases', labelHi: 'खरीद',      labelEn: 'Purchases', icon: '🛒' },
  { href: '/udhaar',    labelHi: 'उधार',      labelEn: 'Udhaar',    icon: '🤝' },
  { href: '/gst',       labelHi: 'GST',        labelEn: 'GST',       icon: '🧾' },
  { href: '/reports',   labelHi: 'रिपोर्ट',   labelEn: 'Reports',   icon: '📊' },
];

function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const r   = size === 'sm' ? 8  : size === 'lg' ? 14 : 10;
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 20 : 15;

  if (!err) {
    return (
      <div style={{ width: dim, height: dim, borderRadius: r, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #122D4F, #05966922)', border: '1px solid rgba(5,150,105,0.3)' }}>
        <img src="/logo.png" alt="Logo" width={dim} height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div style={{ width: dim, height: dim, borderRadius: r, flexShrink: 0, background: 'linear-gradient(135deg, #0B1D35, #1A3F6F)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(5,150,105,0.3)' }}>
      <span style={{ fontSize: fs, fontWeight: 800, color: '#10B981', fontFamily: 'Sora, serif' }}>र</span>
    </div>
  );
}

export default function Layout({ children }) {
  const [user, setUser]                     = useState(null);
  const [scrolled, setScrolled]             = useState(false);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [mobileDropOpen, setMobileDropOpen] = useState(false);
  const dropdownRef   = useRef(null);
  const mobileDropRef = useRef(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (!stored || !token) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (mobileDropRef.current && !mobileDropRef.current.contains(e.target)) setMobileDropOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const logout = () => {
    setDropdownOpen(false);
    setMobileDropOpen(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const goToProfile = () => {
    setDropdownOpen(false);
    setMobileDropOpen(false);
    router.push('/profile');
  };

  const isActive = (href) => pathname === href;
  const initial  = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ══════════════════════════════════════════
          DESKTOP SIDEBAR — Premium dark navy
      ══════════════════════════════════════════ */}
      <aside className="desktop-sidebar" style={{
        width: 248,
        background: 'linear-gradient(180deg, #0B1D35 0%, #0D2240 100%)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        borderRight: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.25)',
      }}>

        {/* ── Brand bar ── */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="md" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
                रख<span style={{ color: '#10B981' }}>रखाव</span>
              </div>
              <div style={{ fontSize: 8.5, color: 'rgba(52,211,153,0.4)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>
                Business Manager
              </div>
            </div>
          </div>
        </div>

        {/* ── Gradient divider ── */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.4), transparent)', margin: '0 14px' }} />

        {/* ── USER CARD — clickable dropdown ── */}
        <div style={{ padding: '14px 14px 8px', position: 'relative' }} ref={dropdownRef}>
          <div
            onClick={() => setDropdownOpen(v => !v)}
            title="Click to view profile or logout"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: dropdownOpen ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)',
              borderRadius: 12, padding: '10px 12px',
              border: `1px solid ${dropdownOpen ? 'rgba(79,70,229,0.35)' : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer', transition: 'all 0.18s ease',
              userSelect: 'none',
            }}
            onMouseEnter={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(79,70,229,0.2)'; }}}
            onMouseLeave={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}}
          >
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #4F46E5, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
              boxShadow: dropdownOpen ? '0 0 14px rgba(79,70,229,0.6)' : '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'box-shadow 0.18s',
            }}>
              {initial}
            </div>

            {/* Name + email */}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || '—'}
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                {user?.email || 'Shopkeeper'}
              </div>
            </div>

            {/* Chevron */}
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(52,211,153,0.5)' }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          {/* Desktop Dropdown */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% - 2px)', left: 14, right: 14,
              background: '#0D2240',
              border: '1px solid rgba(79,70,229,0.25)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              zIndex: 100, overflow: 'hidden',
              animation: 'dropFadeIn 0.15s ease',
            }}>
              <button onClick={goToProfile} style={{
                width: '100%', padding: '12px 14px',
                background: 'none', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.12s', fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ fontSize: 15 }}>👤</span>
                <div>
                  <div style={{ lineHeight: 1.3 }}>Profile / प्रोफाइल</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Shop &amp; account settings</div>
                </div>
              </button>
              <button onClick={logout} style={{
                width: '100%', padding: '12px 14px',
                background: 'none', border: 'none',
                color: 'rgba(252,165,165,0.8)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.12s', fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ fontSize: 15 }}>🚪</span>
                <div style={{ lineHeight: 1.3 }}>Logout / निकलें</div>
              </button>
            </div>
          )}
        </div>

        {/* ── Nav items ── */}
        <nav style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(52,211,153,0.3)', textTransform: 'uppercase', letterSpacing: 2, padding: '4px 10px 10px' }}>
            Navigation
          </div>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 11, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'rgba(79,70,229,0.18)' : 'transparent',
                color: active ? '#A5B4FC' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s ease',
                borderLeft: `3px solid ${active ? '#4F46E5' : 'transparent'}`,
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                  e.currentTarget.style.borderLeftColor = 'rgba(79,70,229,0.3)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }
              }}>
                <span style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: active ? 700 : 500, lineHeight: 1.2, color: 'inherit' }}>
                    {item.labelEn}
                  </div>
                  <div style={{ fontSize: 9.5, opacity: 0.4, lineHeight: 1.2 }}>{item.labelHi}</div>
                </div>
                {active && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#4F46E5',
                    boxShadow: '0 0 10px rgba(79,70,229,0.9), 0 0 20px rgba(79,70,229,0.4)',
                    flexShrink: 0,
                  }} />
                )}
              </a>
            );
          })}
        </nav>

        {/* ── Bottom logout ── */}
        <div style={{ padding: '10px 12px 18px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.07)', color: 'rgba(252,165,165,0.65)',
            border: '1px solid rgba(239,68,68,0.1)',
            cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s', fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.color = 'rgba(252,165,165,0.65)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.1)'; }}>
            🚪 <span>Logout / निकलें</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MOBILE TOP BAR
      ══════════════════════════════════════════ */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: scrolled ? 'rgba(11,29,53,0.97)' : '#0B1D35',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.25)',
        transition: 'all 0.22s',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size="sm" />
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Sora', sans-serif" }}>
            रख<span style={{ color: '#10B981' }}>रखाव</span>
          </div>
        </div>

        {/* Mobile Avatar */}
        <div style={{ position: 'relative' }} ref={mobileDropRef}>
          <div
            onClick={() => setMobileDropOpen(v => !v)}
            title="Profile / Logout"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', padding: '5px 9px 5px 6px', borderRadius: 22,
              background: mobileDropOpen ? 'rgba(79,70,229,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${mobileDropOpen ? 'rgba(79,70,229,0.4)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s',
            }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #4F46E5, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
              boxShadow: mobileDropOpen ? '0 0 10px rgba(79,70,229,0.5)' : 'none',
              transition: 'box-shadow 0.15s',
            }}>
              {initial}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              {user?.name?.split(' ')[0]}
            </span>
            <svg width="9" height="9" viewBox="0 0 9 9" style={{ transition: 'transform 0.18s', transform: mobileDropOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(52,211,153,0.5)' }}>
              <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          {/* Mobile Dropdown */}
          {mobileDropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 210, background: '#0D2240',
              border: '1px solid rgba(79,70,229,0.25)',
              borderRadius: 14,
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
              zIndex: 200, overflow: 'hidden',
              animation: 'dropFadeIn 0.15s ease',
            }}>
              <div style={{ padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(79,70,229,0.08)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{user?.name}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{user?.email}</div>
              </div>
              <button onClick={goToProfile} style={{
                width: '100%', padding: '12px 14px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 9,
                transition: 'background 0.12s', fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ fontSize: 15 }}>👤</span>
                <span>Profile / प्रोफाइल</span>
              </button>
              <button onClick={logout} style={{
                width: '100%', padding: '12px 14px', background: 'none', border: 'none',
                color: 'rgba(252,165,165,0.85)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 9,
                transition: 'background 0.12s', fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ fontSize: 15 }}>🚪</span>
                <span>Logout / निकलें</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{
        flex: 1, marginLeft: 248, padding: '28px 28px 80px',
        minHeight: '100vh',
      }}>
        {children}
      </main>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAV
      ══════════════════════════════════════════ */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#0B1D35',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', padding: '6px 0 8px' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', padding: '3px 2px', position: 'relative',
              }}>
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', bottom: 0, background: 'rgba(79,70,229,0.14)', borderRadius: 9, border: '1px solid rgba(79,70,229,0.22)' }} />
                )}
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '22%', right: '22%', height: 2.5, background: 'linear-gradient(90deg, #4F46E5, #6366F1)', borderRadius: '0 0 3px 3px', boxShadow: '0 0 10px rgba(79,70,229,0.7)' }} />
                )}
                <span style={{ fontSize: 20, position: 'relative', zIndex: 1, transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s', marginTop: 2 }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? '#A5B4FC' : 'rgba(255,255,255,0.28)', position: 'relative', zIndex: 1 }}>
                  {item.labelEn}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap');

        .mobile-topbar     { display: none; }
        .mobile-bottom-nav { display: none; }
        .desktop-sidebar   { display: flex !important; }

        @media (max-width: 768px) {
          .desktop-sidebar   { display: none !important; }
          .mobile-topbar     { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content      { margin-left: 0 !important; padding: 70px 14px 88px !important; }
        }

        @keyframes dropFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        * { -webkit-tap-highlight-color: transparent; }

        /* ── Global Design System ── */
        :root {
          --primary: #4F46E5; --primary-light: #6366F1; --primary-dim: rgba(79,70,229,0.1);
          --emerald: #059669; --emerald-light: #10B981; --emerald-dim: rgba(5,150,105,0.1);
          --success: #22C55E; --success-dim: rgba(34,197,94,0.1);
          --warning: #F59E0B; --warning-dim: rgba(245,158,11,0.1);
          --danger: #EF4444; --danger-dim: rgba(239,68,68,0.1);
          --purple: #8B5CF6; --purple-dim: rgba(139,92,246,0.1);
          --bg: #F1F5F9; --surface: #FFFFFF; --surface-2: #F8FAFC; --surface-3: #F1F5F9;
          --navy: #0B1D35; --navy-2: #0D2240;
          --text: #0F172A; --text-2: #334155; --text-3: #64748B; --text-4: #94A3B8; --text-5: #CBD5E1;
          --border: #E2E8F0; --border-2: #F1F5F9;
          --radius: 14px; --radius-sm: 10px; --radius-xs: 7px; --radius-lg: 20px;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --shadow: 0 4px 16px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.04);
          --shadow-lg: 0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06);
          --shadow-xl: 0 24px 60px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.08);
          --font-body: 'Plus Jakarta Sans', sans-serif;
          --font-display: 'Sora', sans-serif;
        }

        *, *::before, *::after { box-sizing: border-box; }
        html { -webkit-font-smoothing: antialiased; }
        body { font-family: var(--font-body); background: var(--bg); color: var(--text); }

        .page-title {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 800; color: var(--text);
          letter-spacing: -0.4px; line-height: 1.2;
        }

        .card {
          background: var(--surface); border-radius: var(--radius);
          padding: 20px 22px; border: 1px solid var(--border);
          box-shadow: var(--shadow-sm); transition: box-shadow 0.2s;
        }
        .card:hover { box-shadow: var(--shadow); }

        .btn-primary, .btn-success, .btn-warning, .btn-danger {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: var(--radius-sm); border: none;
          font-family: var(--font-body); font-size: 13.5px; font-weight: 700;
          cursor: pointer; transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
          white-space: nowrap; letter-spacing: -0.1px;
        }
        .btn-primary  { background: var(--primary);  color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.3); }
        .btn-success  { background: var(--emerald);  color: #fff; box-shadow: 0 2px 8px rgba(5,150,105,0.3); }
        .btn-warning  { background: var(--warning);  color: #fff; box-shadow: 0 2px 8px rgba(245,158,11,0.3); }
        .btn-danger   { background: var(--danger);   color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.3); }
        .btn-primary:hover  { background: #4338CA; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
        .btn-success:hover  { background: #047857; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(5,150,105,0.4); }
        .btn-warning:hover  { background: #D97706; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(245,158,11,0.4); }
        .btn-danger:hover   { background: #DC2626; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(239,68,68,0.4); }
        .btn-primary:active,.btn-success:active,.btn-warning:active,.btn-danger:active { transform: translateY(0); }
        .btn-primary:disabled,.btn-success:disabled,.btn-warning:disabled,.btn-danger:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; box-shadow: none; }

        .form-group { margin-bottom: 14px; }
        .form-label { display: block; font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
        .form-input {
          width: 100%; padding: 10px 14px; border: 1.5px solid var(--border);
          border-radius: var(--radius-sm); font-size: 14px; font-family: var(--font-body);
          color: var(--text); background: var(--surface); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; appearance: none;
        }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-dim); }
        .form-input::placeholder { color: var(--text-5); }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 480px) { .grid-2 { grid-template-columns: 1fr; } }

        .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; }
        .badge-green  { background: var(--success-dim); color: #15803D; }
        .badge-yellow { background: var(--warning-dim); color: #B45309; }
        .badge-red    { background: var(--danger-dim);  color: #B91C1C; }
        .badge-indigo { background: var(--primary-dim); color: #4338CA; }

        .table-container {
          background: var(--surface); border-radius: var(--radius);
          border: 1px solid var(--border); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .table-container table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table-container thead { background: var(--surface-2); border-bottom: 1.5px solid var(--border); }
        .table-container th { padding: 12px 16px; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-3); white-space: nowrap; }
        .table-container td { padding: 13px 16px; border-bottom: 1px solid var(--border-2); color: var(--text-2); vertical-align: middle; }
        .table-container tbody tr:last-child td { border-bottom: none; }
        .table-container tbody tr { transition: background 0.12s; }
        .table-container tbody tr:hover { background: var(--surface-2); }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.65);
          backdrop-filter: blur(6px); display: flex; align-items: center;
          justify-content: center; z-index: 1000; padding: 16px;
          animation: overlayIn 0.18s ease;
        }
        @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
        .modal {
          background: var(--surface); border-radius: var(--radius-lg);
          padding: 28px; width: 100%; max-width: 520px;
          box-shadow: var(--shadow-xl); border: 1px solid var(--border);
          animation: modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes modalIn { from { opacity:0; transform: scale(0.94) translateY(16px); } to { opacity:1; transform: scale(1) translateY(0); } }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
      `}</style>
    </div>
  );
}