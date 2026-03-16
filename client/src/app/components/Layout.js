'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '▦' },
    { href: '/product', label: 'Products', icon: '◈' },
    { href: '/sales', label: 'Sales', icon: '↑' },
    { href: '/purchases', label: 'Purchases', icon: '↓' },
    { href: '/profile', label: 'Profile', icon: '◉' },
  ];

  const isActive = (href) => pathname === href;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside style={{
        width: 240, background: '#1a1a2e', color: '#fff',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      }} className="desktop-sidebar">
        <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            रख<span style={{ color: '#6366f1' }}>रखाव</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Inventory Manager</div>
        </div>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{user?.email}</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px' }}>
          {navItems.map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10, marginBottom: 2,
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              background: isActive(item.href) ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: isActive(item.href) ? '#818cf8' : 'rgba(255,255,255,0.6)',
              borderLeft: isActive(item.href) ? '3px solid #6366f1' : '3px solid transparent',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.15)', color: '#f87171',
            border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          }}>⏻ Logout</button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: '#1a1a2e', padding: '14px 20px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
          रख<span style={{ color: '#6366f1' }}>रखाव</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{user?.name}</div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{ flex: 1, marginLeft: 240, padding: '32px', minHeight: '100vh', paddingBottom: 100 }}>
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#1a1a2e',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '6px 0 10px', zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      }}>
        {navItems.map(item => (
          <a key={item.href} href={item.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, textDecoration: 'none', padding: '4px 0',
            color: isActive(item.href) ? '#818cf8' : 'rgba(255,255,255,0.45)',
          }}>
            {/* Active indicator dot */}
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: isActive(item.href) ? '#6366f1' : 'transparent',
              marginBottom: 2,
            }} />
            <span style={{
              fontSize: 20,
              filter: isActive(item.href) ? 'drop-shadow(0 0 6px #6366f1)' : 'none',
            }}>{item.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: isActive(item.href) ? 700 : 500,
              color: isActive(item.href) ? '#818cf8' : 'rgba(255,255,255,0.45)',
            }}>{item.label}</span>
          </a>
        ))}
        <button onClick={logout} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.45)', padding: '4px 0',
        }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'transparent', marginBottom: 2 }} />
          <span style={{ fontSize: 20 }}>⏻</span>
          <span style={{ fontSize: 10, fontWeight: 500 }}>Logout</span>
        </button>
      </nav>

      <style>{`
        .mobile-topbar { display: none; }
        .mobile-bottom-nav { display: none; flex-direction: row; }
        .desktop-sidebar { display: flex; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content {
            margin-left: 0 !important;
            padding: 80px 16px 90px !important;
          }

          /* Mobile card fix */
          .card {
            border-radius: 12px !important;
            padding: 16px !important;
          }

          /* Mobile table fix */
          .table-container {
            border-radius: 12px !important;
          }

          /* Mobile button fix */
          .btn-primary, .btn-success, .btn-warning {
            padding: 10px 16px !important;
            font-size: 13px !important;
            border-radius: 10px !important;
          }

          /* Mobile stat card fix */
          .stat-card {
            padding: 16px !important;
          }
          .stat-value {
            font-size: 26px !important;
          }

          /* Mobile modal fix */
          .modal {
            padding: 20px !important;
            border-radius: 16px !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
          }
        }

        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}