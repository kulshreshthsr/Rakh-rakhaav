'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', labelHi: 'होम',       labelEn: 'Dashboard', icon: '⊞' },
  { href: '/product',   labelHi: 'उत्पाद',    labelEn: 'Products',  icon: '◫' },
  { href: '/sales',     labelHi: 'बिक्री',    labelEn: 'Sales',     icon: '↑' },
  { href: '/purchases', labelHi: 'खरीद',      labelEn: 'Purchases', icon: '↓' },
  { href: '/udhaar',    labelHi: 'उधार',      labelEn: 'Udhaar',    icon: '⇄' },
  { href: '/gst',       labelHi: 'GST',        labelEn: 'GST',       icon: '₹' },
  { href: '/reports',   labelHi: 'रिपोर्ट',   labelEn: 'Reports',   icon: '▤' },
  { href: '/profile',   labelHi: 'प्रोफाइल',  labelEn: 'Profile',   icon: '◉' },
];

function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const r   = size === 'sm' ? 8  : size === 'lg' ? 14 : 10;

  if (!err) {
    return (
      <div style={{ width: dim, height: dim, borderRadius: r, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #1B3A6B, #C9A84C22)', border: '1px solid rgba(201,168,76,0.3)' }}>
        <img src="/logo.png" alt="Logo" width={dim} height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div style={{ width: dim, height: dim, borderRadius: r, flexShrink: 0, background: 'linear-gradient(135deg, #112240, #1B3A6B)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.3)' }}>
      <span style={{ fontSize: size === 'sm' ? 12 : 15, fontWeight: 800, color: '#C9A84C', fontFamily: 'serif' }}>र</span>
    </div>
  );
}

export default function Layout({ children }) {
  const [user, setUser]       = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
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
        width: 240,
        background: 'var(--navy)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        borderRight: '1px solid rgba(201,168,76,0.12)',
        boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
      }}>

        {/* Brand */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size="md" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px', fontFamily: 'serif' }}>
                रख<span style={{ color: 'var(--gold)' }}>रखाव</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.5)', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 1 }}>
                Business Manager
              </div>
            </div>
          </div>
        </div>

        {/* Gold divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)', margin: '0 18px' }} />

        {/* User */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '9px 11px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--navy-3), #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || '—'}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || ''}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(201,168,76,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '6px 8px 8px' }}>
            Navigation
          </div>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                textDecoration: 'none',
                background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
                color: active ? 'var(--gold-2)' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.15s ease',
                borderLeft: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0, fontWeight: 600, color: active ? 'var(--gold)' : 'inherit' }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, lineHeight: 1.2 }}>{item.labelEn}</div>
                  <div style={{ fontSize: 10, opacity: 0.55, lineHeight: 1.2 }}>{item.labelHi}</div>
                </div>
                {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)', flexShrink: 0 }} />}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '10px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(220,38,38,0.08)',
            color: 'rgba(252,165,165,0.8)',
            border: '1px solid rgba(220,38,38,0.12)',
            cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = 'rgba(252,165,165,0.8)'; }}
          >
            ← <span>Logout / निकलें</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: scrolled ? 'rgba(10,22,40,0.96)' : 'var(--navy)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(201,168,76,0.15)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
        transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size="sm" />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'serif' }}>
            रख<span style={{ color: 'var(--gold)' }}>रखाव</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{user?.name?.split(' ')[0]}</span>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--navy-3), #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {initial}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{ flex: 1, marginLeft: 240, padding: '28px', minHeight: '100vh', paddingBottom: 80 }}>
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--navy)',
        borderTop: '1px solid rgba(201,168,76,0.15)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', padding: '5px 0 7px' }}>
          {navItems.slice(0, 7).map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', padding: '4px 1px', position: 'relative',
              }}>
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', bottom: 0, background: 'rgba(201,168,76,0.1)', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)' }} />
                )}
                {active && (
                  <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, background: 'var(--gold)', borderRadius: '0 0 3px 3px', boxShadow: '0 0 8px rgba(201,168,76,0.6)' }} />
                )}
                <span style={{ fontSize: 16, position: 'relative', zIndex: 1, color: active ? 'var(--gold)' : 'rgba(255,255,255,0.35)', transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.15s', marginTop: 2 }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? 'var(--gold-2)' : 'rgba(255,255,255,0.3)', position: 'relative', zIndex: 1 }}>
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