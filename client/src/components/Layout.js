'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', labelHi: 'होम',       labelEn: 'Dashboard', icon: '🏠' },
  { href: '/product',   labelHi: 'उत्पाद',    labelEn: 'Products',  icon: '📦' },
  { href: '/sales',     labelHi: 'बिक्री',    labelEn: 'Sales',     icon: '📈' },
  { href: '/purchases', labelHi: 'खरीद',      labelEn: 'Purchases', icon: '🛒' },
  { href: '/udhaar',    labelHi: 'उधार',      labelEn: 'Udhaar',    icon: '🤝' },
  { href: '/gst',       labelHi: 'GST',        labelEn: 'GST',       icon: '🧾' },
  { href: '/reports',   labelHi: 'रिपोर्ट',   labelEn: 'Reports',   icon: '📊' },
  { href: '/profile',   labelHi: 'प्रोफाइल',  labelEn: 'Profile',   icon: '👤' },
];

function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const r   = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;
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
  const [user, setUser]         = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (!stored || !token) {
      window.location.href = '/login';
      return;
    }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const isActive = (href) => pathname === href;
  const initial  = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>

      {/* ── DESKTOP SIDEBAR ── */}
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

        {/* User card */}
        <div style={{ padding: '12px 12px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '9px 11px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #059669, #1A3F6F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || '—'}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || 'Shopkeeper'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(52,211,153,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '6px 8px 8px' }}>
            Main Menu
          </div>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'rgba(5,150,105,0.15)' : 'transparent',
                color: active ? '#34D399' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.15s ease',
                borderLeft: `2px solid ${active ? '#059669' : 'transparent'}`,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}}
              >
                <span style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, lineHeight: 1.2, color: 'inherit' }}>{item.labelEn}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.5, lineHeight: 1.2 }}>{item.labelHi}</div>
                </div>
                {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', boxShadow: '0 0 6px rgba(5,150,105,0.8)', flexShrink: 0 }} />}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '8px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(220,38,38,0.08)', color: 'rgba(252,165,165,0.75)',
            border: '1px solid rgba(220,38,38,0.12)',
            cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = 'rgba(252,165,165,0.75)'; }}
          >
            🚪 <span>Logout / निकलें</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size="sm" />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'serif' }}>
            रख<span style={{ color: '#10B981' }}>रखाव</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>{user?.name?.split(' ')[0]}</span>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #059669, #1A3F6F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {initial}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{ flex: 1, marginLeft: 244, padding: '28px', minHeight: '100vh', paddingBottom: 80 }}>
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--navy)',
        borderTop: '1px solid rgba(5,150,105,0.18)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', padding: '5px 0 7px' }}>
          {navItems.slice(0, 7).map(item => {
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
        .mobile-topbar { display: none; }
        .mobile-bottom-nav { display: none; }
        .desktop-sidebar { display: flex !important; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content { margin-left: 0 !important; padding: 66px 14px 80px !important; }
        }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}