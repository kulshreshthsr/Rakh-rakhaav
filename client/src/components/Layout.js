'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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
        <img src="/logo.png" alt="Logo" width={dim} height={dim} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div style={{ width: dim, height: dim, borderRadius: r, flexShrink: 0, background: 'linear-gradient(135deg, #059669, #0B1D35)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(5,150,105,0.3)', boxShadow: '0 0 12px rgba(5,150,105,0.2)' }}>
      <span style={{ fontSize: fs, fontWeight: 800, color: '#fff', fontFamily: 'Playfair Display, serif' }}>र</span>
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
    setDropdownOpen(false); setMobileDropOpen(false);
    localStorage.removeItem('token'); localStorage.removeItem('user');
    router.push('/login');
  };

  const goToProfile = () => {
    setDropdownOpen(false); setMobileDropOpen(false);
    router.push('/profile');
  };

  const isActive = (href) => pathname === href;
  const initial  = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F0F4F8', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ══ DESKTOP SIDEBAR ══ */}
      <aside className="desktop-sidebar" style={{
        width: 252, background: '#060D1A',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        borderRight: '1px solid rgba(5,150,105,0.12)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
      }}>

        {/* Brand */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="md" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', fontFamily: 'Playfair Display, serif' }}>
                रख<span style={{ color: '#10B981' }}>रखाव</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(52,211,153,0.4)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>
                Business Manager
              </div>
            </div>
          </div>
        </div>

        {/* Emerald line */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.4), transparent)', margin: '0 16px' }} />

        {/* User card */}
        <div style={{ padding: '12px 12px 6px', position: 'relative' }} ref={dropdownRef}>
          <div onClick={() => setDropdownOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: dropdownOpen ? 'rgba(5,150,105,0.12)' : 'rgba(255,255,255,0.04)',
            borderRadius: 12, padding: '10px 12px',
            border: `1px solid ${dropdownOpen ? 'rgba(5,150,105,0.3)' : 'rgba(255,255,255,0.05)'}`,
            cursor: 'pointer', transition: 'all 0.18s',
          }}
          onMouseEnter={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}}
          onMouseLeave={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg, #059669, #1A3F6F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: dropdownOpen ? '0 0 14px rgba(5,150,105,0.5)' : 'none',
              transition: 'box-shadow 0.18s',
            }}>{initial}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || '—'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || 'Shopkeeper'}</div>
            </div>
            <span style={{ fontSize: 8, color: 'rgba(52,211,153,0.5)', flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </div>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% - 4px)', left: 12, right: 12,
              background: '#0B1D35', border: '1px solid rgba(5,150,105,0.25)',
              borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              zIndex: 100, overflow: 'hidden', animation: 'dropFadeIn 0.15s ease',
            }}>
              <button onClick={goToProfile} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(5,150,105,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ fontSize: 15 }}>👤</span>
                <div>
                  <div>Profile / प्रोफाइल</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Shop & account settings</div>
                </div>
              </button>
              <button onClick={logout} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: 'rgba(252,165,165,0.85)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ fontSize: 15 }}>🚪</span> Logout / निकलें
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(52,211,153,0.3)', textTransform: 'uppercase', letterSpacing: 2, padding: '8px 8px 10px' }}>Main Menu</div>
          {navItems.map((item, idx) => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 10px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'rgba(5,150,105,0.14)' : 'transparent',
                color: active ? '#34D399' : 'rgba(255,255,255,0.42)',
                transition: 'all 0.15s',
                borderLeft: `2px solid ${active ? '#059669' : 'transparent'}`,
                animation: `slideIn 0.3s ease ${idx * 0.04}s both`,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.42)'; }}}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: 'inherit', lineHeight: 1.2 }}>{item.labelEn}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.4, lineHeight: 1.2 }}>{item.labelHi}</div>
                </div>
                {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', boxShadow: '0 0 8px rgba(5,150,105,0.9)', flexShrink: 0 }} />}
              </a>
            );
          })}
        </nav>

        {/* Bottom logout */}
        <div style={{ padding: '8px 10px 18px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 9,
            background: 'rgba(220,38,38,0.07)', color: 'rgba(252,165,165,0.65)',
            border: '1px solid rgba(220,38,38,0.1)', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.14)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.07)'; e.currentTarget.style.color = 'rgba(252,165,165,0.65)'; }}>
            🚪 <span>Logout / निकलें</span>
          </button>
        </div>
      </aside>

      {/* ══ MOBILE TOP BAR ══ */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: scrolled ? 'rgba(6,13,26,0.97)' : '#060D1A',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(5,150,105,0.15)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.25)',
        transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size="sm" />
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'Playfair Display, serif' }}>
            रख<span style={{ color: '#10B981' }}>रखाव</span>
          </div>
        </div>

        <div style={{ position: 'relative' }} ref={mobileDropRef}>
          <div onClick={() => setMobileDropOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', padding: '4px 8px 4px 6px', borderRadius: 20,
            background: mobileDropOpen ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${mobileDropOpen ? 'rgba(5,150,105,0.35)' : 'rgba(255,255,255,0.08)'}`,
            transition: 'all 0.15s',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #059669, #1A3F6F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>{initial}</div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{user?.name?.split(' ')[0]}</span>
            <span style={{ fontSize: 8, color: 'rgba(52,211,153,0.5)', transform: mobileDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>▼</span>
          </div>

          {mobileDropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 210,
              background: '#0B1D35', border: '1px solid rgba(5,150,105,0.25)',
              borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              zIndex: 200, overflow: 'hidden', animation: 'dropFadeIn 0.15s ease',
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,150,105,0.07)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{user?.email}</div>
              </div>
              <button onClick={goToProfile} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(5,150,105,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span>👤</span> Profile / प्रोफाइल
              </button>
              <button onClick={logout} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: 'rgba(252,165,165,0.85)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span>🚪</span> Logout / निकलें
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ MAIN CONTENT ══ */}
      <main className="main-content" style={{ flex: 1, marginLeft: 252, padding: '28px', minHeight: '100vh', paddingBottom: 80 }}>
        {children}
      </main>

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#060D1A',
        borderTop: '1px solid rgba(5,150,105,0.15)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', padding: '4px 0 6px' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', padding: '4px 2px', position: 'relative',
              }}>
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, background: 'linear-gradient(90deg, transparent, #059669, transparent)', borderRadius: '0 0 4px 4px' }} />
                )}
                {active && (
                  <div style={{ position: 'absolute', inset: '2px 6%', background: 'rgba(5,150,105,0.1)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.18)' }} />
                )}
                <span style={{ fontSize: 20, position: 'relative', zIndex: 1, transform: active ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.15s', marginTop: 3 }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? '#34D399' : 'rgba(255,255,255,0.28)', position: 'relative', zIndex: 1 }}>
                  {item.labelEn}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');

        .mobile-topbar     { display: none; }
        .mobile-bottom-nav { display: none; }
        .desktop-sidebar   { display: flex !important; }

        @media (max-width: 768px) {
          .desktop-sidebar   { display: none !important; }
          .mobile-topbar     { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content      { margin-left: 0 !important; padding: 68px 14px 84px !important; }
        }

        @keyframes dropFadeIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}