'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#6366f1' : 'none'} stroke={active ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { href: '/product', label: 'Products', icon: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#6366f1' : 'none'} stroke={active ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    </svg>
  )},
  { href: '/sales', label: 'Sales', icon: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#6366f1' : 'none'} stroke={active ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  )},
  { href: '/purchases', label: 'Purchases', icon: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#6366f1' : 'none'} stroke={active ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
    </svg>
  )},
  { href: '/profile', label: 'Profile', icon: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#6366f1' : 'none'} stroke={active ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )},
];

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const isActive = (href) => pathname === href;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="desktop-sidebar" style={{
        width: 248, background: 'var(--sidebar)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>र</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>रख<span style={{ color: '#818cf8' }}>रखाव</span></div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500, letterSpacing: 0.5 }}>INVENTORY MANAGER</div>
            </div>
          </div>
        </div>

        {/* User */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 700 : 500,
                background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: active ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
                borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
              }}>
                {item.icon(active)}
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
            border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'var(--sidebar)',
        padding: '12px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>र</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>रख<span style={{ color: '#818cf8' }}>रखाव</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{user?.name?.split(' ')[0]}</div>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{ flex: 1, marginLeft: 248, padding: '28px', minHeight: '100vh', paddingBottom: 80 }}>
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
        <div style={{ display: 'flex', padding: '6px 4px 8px' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, textDecoration: 'none', padding: '6px 2px',
                position: 'relative',
              }}>
                {active && (
                  <div style={{
                    position: 'absolute', top: 2, left: '15%', right: '15%',
                    height: '100%', borderRadius: 10,
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }} />
                )}
                {active && (
                  <div style={{
                    position: 'absolute', top: 0, left: '35%', right: '35%',
                    height: 2.5, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    borderRadius: '0 0 4px 4px',
                    boxShadow: '0 0 10px rgba(99,102,241,0.8)',
                  }} />
                )}
                <div style={{ position: 'relative', zIndex: 1, transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s' }}>
                  {item.icon(active)}
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: active ? 700 : 500,
                  color: active ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                  position: 'relative', zIndex: 1,
                  letterSpacing: 0.2,
                }}>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        .mobile-topbar { display: none; }
        .mobile-bottom-nav { display: none; }
        .desktop-sidebar { display: flex; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content {
            margin-left: 0 !important;
            padding: 72px 14px 80px !important;
          }
        }

        a { transition: opacity 0.15s; }
        a:hover { opacity: 0.85; }

        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}