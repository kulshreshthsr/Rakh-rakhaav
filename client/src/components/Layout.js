'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

const navItems = [
  { href: '/dashboard', labelHi: 'होम',      labelEn: 'Home',      icon: '🏠' },
  { href: '/product',   labelHi: 'उत्पाद',    labelEn: 'Products',  icon: '📦' },
  { href: '/sales',     labelHi: 'बिक्री',    labelEn: 'Sales',     icon: '📈' },
  { href: '/purchases', labelHi: 'खरीद',      labelEn: 'Purchases', icon: '🛒' },
  { href: '/udhaar',    labelHi: 'उधार',      labelEn: 'Udhaar',    icon: '🤝' },
  { href: '/gst',       labelHi: 'GST',       labelEn: 'GST',       icon: '🧾' },
  { href: '/profile',   labelHi: 'प्रोफ़ाइल', labelEn: 'Profile',   icon: '👤' },
];

// ── Logo component — uses image if available, fallback to text ──────────────
function Logo({ size = 'md' }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const radius = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 20 : 16;

  if (!imgError) {
    return (
      <div style={{ width: dim, height: dim, borderRadius: radius, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        <img
          src="/logo.png"
          alt="Rakhaav Logo"
          width={dim}
          height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: text avatar
  return (
    <div style={{
      width: dim, height: dim, borderRadius: radius,
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>
      र
    </div>
  );
}

export default function Layout({ children }) {
  const [user, setUser]           = useState(null);
  const [scrolled, setScrolled]   = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const isActive = (href) => pathname === href;

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="desktop-sidebar" style={{
        width: 252, background: 'var(--sidebar)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
      }}>

        {/* Brand */}
        <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="md" />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                रख<span style={{ color: '#818cf8' }}>रखाव</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginTop: 1 }}>
                Inventory Manager
              </div>
            </div>
          </div>
        </div>

        {/* User card */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '0 8px 0', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {userInitial}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'Loading...'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 1.2, padding: '8px 10px 6px' }}>
            Menu
          </div>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, marginBottom: 1,
                textDecoration: 'none', fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                color: active ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.15s ease',
                borderLeft: `3px solid ${active ? '#6366f1' : 'transparent'}`,
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}}
              >
                <span style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <span>{item.labelHi} / {item.labelEn}</span>
                {active && (
                  <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.8)' }} />
                )}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '10px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', color: '#fca5a5',
            border: '1px solid rgba(239,68,68,0.12)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          >
            🚪 <span>Logout / निकलें</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: scrolled ? 'rgba(15,23,42,0.97)' : 'var(--sidebar)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size="sm" />
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
            रख<span style={{ color: '#818cf8' }}>रखाव</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            {user?.name?.split(' ')[0]}
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
            {userInitial}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{
        flex: 1, marginLeft: 252,
        padding: '28px',
        minHeight: '100vh',
        paddingBottom: 80,
      }}>
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--sidebar)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', padding: '5px 2px 7px' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', padding: '4px 2px',
                position: 'relative',
              }}>
                {active && (
                  <div style={{
                    position: 'absolute', top: 0, left: '8%', right: '8%', bottom: 0,
                    background: 'rgba(99,102,241,0.13)', borderRadius: 10,
                    border: '1px solid rgba(99,102,241,0.18)',
                  }} />
                )}
                {active && (
                  <div style={{
                    position: 'absolute', top: 0, left: '30%', right: '30%',
                    height: 2.5,
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    borderRadius: '0 0 4px 4px',
                    boxShadow: '0 0 10px rgba(99,102,241,0.8)',
                  }} />
                )}
                <span style={{
                  fontSize: 19, position: 'relative', zIndex: 1,
                  transform: active ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                  marginTop: 2,
                }}>{item.icon}</span>
                <span style={{
                  fontSize: 9, fontWeight: active ? 700 : 500,
                  color: active ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
                  position: 'relative', zIndex: 1,
                  letterSpacing: 0.1,
                }}>{item.labelEn}</span>
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        .mobile-topbar { display: none; }
        .mobile-bottom-nav { display: none; }
        .desktop-sidebar { display: flex !important; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content {
            margin-left: 0 !important;
            padding: 68px 14px 82px !important;
          }
        }

        * { -webkit-tap-highlight-color: transparent; }

        a { transition: opacity 0.15s ease; }
        .desktop-sidebar a:hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}