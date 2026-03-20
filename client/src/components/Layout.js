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
      <span style={{ fontSize: fs, fontWeight: 800, color: '#10B981', fontFamily: 'serif' }}>र</span>
    </div>
  );
}

export default function Layout({ children }) {
  const [user, setUser]                   = useState(null);
  const [scrolled, setScrolled]           = useState(false);
  const [dropdownOpen, setDropdownOpen]   = useState(false);     // desktop sidebar
  const [mobileDropOpen, setMobileDropOpen] = useState(false);   // mobile topbar
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

  // ── Close dropdowns when clicking outside ───────────────────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (mobileDropRef.current && !mobileDropRef.current.contains(e.target)) {
        setMobileDropOpen(false);
      }
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════════════════════════════════════
          DESKTOP SIDEBAR
      ══════════════════════════════════════════ */}
      <aside className="desktop-sidebar" style={{
        width: 244,
        background: 'var(--navy)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        borderRight: '1px solid rgba(5,150,105,0.1)',
        boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
      }}>

        {/* Brand */}
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="md" />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', fontFamily: 'serif' }}>
                रख<span style={{ color: '#10B981' }}>रखाव</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(52,211,153,0.45)', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 1 }}>
                Business Manager
              </div>
            </div>
          </div>
        </div>

        {/* Emerald divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.35), transparent)', margin: '0 16px' }} />

        {/* ── USER CARD — now clickable, opens dropdown ── */}
        <div style={{ padding: '12px 12px 6px', position: 'relative' }} ref={dropdownRef}>
          <div
            onClick={() => setDropdownOpen(v => !v)}
            title="Click to view profile or logout"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: dropdownOpen ? 'rgba(5,150,105,0.12)' : 'rgba(255,255,255,0.04)',
              borderRadius: 10, padding: '9px 11px',
              border: `1px solid ${dropdownOpen ? 'rgba(5,150,105,0.3)' : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer', transition: 'all 0.18s ease',
              userSelect: 'none',
            }}
            onMouseEnter={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(5,150,105,0.15)'; }}}
            onMouseLeave={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #059669, #1A3F6F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: dropdownOpen ? '0 0 10px rgba(5,150,105,0.55)' : 'none',
              transition: 'box-shadow 0.18s',
            }}>
              {initial}
            </div>

            {/* Name + email */}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || '—'}
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || 'Shopkeeper'}
              </div>
            </div>

            {/* Animated chevron */}
            <span style={{
              fontSize: 9, color: 'rgba(52,211,153,0.5)', flexShrink: 0,
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}>▼</span>
          </div>

          {/* ── Desktop Dropdown ── */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: 12, right: 12,
              background: '#0d2240',
              border: '1px solid rgba(5,150,105,0.28)',
              borderRadius: 10,
              boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
              zIndex: 100,
              overflow: 'hidden',
              animation: 'dropFadeIn 0.15s ease',
            }}>
              {/* Profile option */}
              <button
                onClick={goToProfile}
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.82)', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 9,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(5,150,105,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 16 }}>👤</span>
                <div>
                  <div style={{ lineHeight: 1.3 }}>Profile / प्रोफाइल</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
                    Shop &amp; account settings
                  </div>
                </div>
              </button>

              {/* Logout option */}
              <button
                onClick={logout}
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'none', border: 'none',
                  color: 'rgba(252,165,165,0.85)', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 9,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 16 }}>🚪</span>
                <div style={{ lineHeight: 1.3 }}>Logout / निकलें</div>
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(52,211,153,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '6px 8px 10px' }}>
            Main Menu
          </div>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 10px', borderRadius: 9, marginBottom: 3,
                textDecoration: 'none',
                background: active ? 'rgba(5,150,105,0.15)' : 'transparent',
                color: active ? '#34D399' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.16s ease',
                borderLeft: `2px solid ${active ? '#059669' : 'transparent'}`,
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.78)';
                  e.currentTarget.style.borderLeftColor = 'rgba(5,150,105,0.28)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }
              }}
              >
                <span style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 400, lineHeight: 1.2, color: 'inherit' }}>
                    {item.labelEn}
                  </div>
                  <div style={{ fontSize: 9.5, opacity: 0.42, lineHeight: 1.2 }}>{item.labelHi}</div>
                </div>
                {active && (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#059669',
                    boxShadow: '0 0 8px rgba(5,150,105,0.9), 0 0 18px rgba(5,150,105,0.4)',
                    flexShrink: 0,
                  }} />
                )}
              </a>
            );
          })}
        </nav>

        {/* Bottom logout button */}
        <div style={{ padding: '8px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            background: 'rgba(220,38,38,0.08)', color: 'rgba(252,165,165,0.75)',
            border: '1px solid rgba(220,38,38,0.12)',
            cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.16)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = 'rgba(252,165,165,0.75)'; }}
          >
            🚪 <span>Logout / निकलें</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MOBILE TOP BAR
      ══════════════════════════════════════════ */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: scrolled ? 'rgba(11,29,53,0.97)' : 'var(--navy)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(5,150,105,0.18)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
        transition: 'all 0.2s',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size="sm" />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'serif' }}>
            रख<span style={{ color: '#10B981' }}>रखाव</span>
          </div>
        </div>

        {/* ── Mobile Avatar — clickable ── */}
        <div style={{ position: 'relative' }} ref={mobileDropRef}>
          <div
            onClick={() => setMobileDropOpen(v => !v)}
            title="Profile / Logout"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', padding: '4px 8px 4px 6px', borderRadius: 20,
              background: mobileDropOpen ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${mobileDropOpen ? 'rgba(5,150,105,0.35)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #059669, #1A3F6F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
              boxShadow: mobileDropOpen ? '0 0 8px rgba(5,150,105,0.5)' : 'none',
              transition: 'box-shadow 0.15s',
            }}>
              {initial}
            </div>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              {user?.name?.split(' ')[0]}
            </span>
            <span style={{
              fontSize: 8, color: 'rgba(52,211,153,0.5)',
              transform: mobileDropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s',
            }}>▼</span>
          </div>

          {/* Mobile Dropdown */}
          {mobileDropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 210,
              background: '#0d2240',
              border: '1px solid rgba(5,150,105,0.28)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
              zIndex: 200,
              overflow: 'hidden',
              animation: 'dropFadeIn 0.15s ease',
            }}>
              {/* User info header */}
              <div style={{
                padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(5,150,105,0.08)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{user?.name}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{user?.email}</div>
              </div>

              {/* Profile */}
              <button
                onClick={goToProfile}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.82)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 9,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(5,150,105,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 16 }}>👤</span>
                <span>Profile / प्रोफाइल</span>
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'none', border: 'none',
                  color: 'rgba(252,165,165,0.85)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 9,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 16 }}>🚪</span>
                <span>Logout / निकलें</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{ flex: 1, marginLeft: 244, padding: '28px', minHeight: '100vh', paddingBottom: 80 }}>
        {children}
      </main>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAV
      ══════════════════════════════════════════ */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--navy)',
        borderTop: '1px solid rgba(5,150,105,0.18)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', padding: '5px 0 7px' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', padding: '3px 1px', position: 'relative',
              }}>
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', bottom: 0, background: 'rgba(5,150,105,0.12)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.2)' }} />
                )}
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, background: 'linear-gradient(90deg, #059669, #34D399)', borderRadius: '0 0 3px 3px', boxShadow: '0 0 8px rgba(5,150,105,0.7)' }} />
                )}
                <span style={{ fontSize: 19, position: 'relative', zIndex: 1, transform: active ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.15s', marginTop: 2 }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? '#34D399' : 'rgba(255,255,255,0.3)', position: 'relative', zIndex: 1 }}>
                  {item.labelEn}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        .mobile-topbar     { display: none; }
        .mobile-bottom-nav { display: none; }
        .desktop-sidebar   { display: flex !important; }

        @media (max-width: 768px) {
          .desktop-sidebar   { display: none !important; }
          .mobile-topbar     { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content      { margin-left: 0 !important; padding: 66px 14px 80px !important; }
        }

        @keyframes dropFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}