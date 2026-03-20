'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', labelHi: 'होम', labelEn: 'Dashboard', icon: '🏠', tone: '#4F46E5' },
  { href: '/product', labelHi: 'उत्पाद', labelEn: 'Products', icon: '📦', tone: '#6366F1' },
  { href: '/sales', labelHi: 'बिक्री', labelEn: 'Sales', icon: '📈', tone: '#22C55E' },
  { href: '/purchases', labelHi: 'खरीद', labelEn: 'Purchases', icon: '🛒', tone: '#F59E0B' },
  { href: '/udhaar', labelHi: 'उधार', labelEn: 'Udhaar', icon: '🤝', tone: '#EF4444' },
  { href: '/gst', labelHi: 'GST', labelEn: 'GST', icon: '🧾', tone: '#8B5CF6' },
  { href: '/reports', labelHi: 'रिपोर्ट', labelEn: 'Reports', icon: '📊', tone: '#06B6D4' },
];

function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 30 : size === 'lg' ? 52 : 40;
  const radius = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fs = size === 'sm' ? 12 : size === 'lg' ? 22 : 16;

  if (!err) {
    return (
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: radius,
          overflow: 'hidden',
          flexShrink: 0,
          background:
            'linear-gradient(135deg, rgba(79,70,229,0.18), rgba(34,197,94,0.18))',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 10px 30px rgba(15,23,42,0.22)',
        }}
      >
        <img
          src="/logo.png"
          alt="Rakhaav"
          width={dim}
          height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setErr(true)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        flexShrink: 0,
        background: 'linear-gradient(135deg, #4F46E5 0%, #22C55E 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 12px 30px rgba(79,70,229,0.35)',
      }}
    >
      <span
        style={{
          fontSize: fs,
          fontWeight: 800,
          color: '#fff',
          fontFamily: 'var(--font-display)',
          lineHeight: 1,
        }}
      >
        र
      </span>
    </div>
  );
}

function ShellGlow() {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: -90,
          left: -60,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.20), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.14), transparent 72%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropOpen, setMobileDropOpen] = useState(false);

  const dropdownRef = useRef(null);
  const mobileDropRef = useRef(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!stored || !token) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

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
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';
  const firstName = user?.name?.split(' ')?.[0] || 'User';

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(79,70,229,0.09), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,0.08), transparent 24%), #F8FAFC',
        fontFamily: 'var(--font-body)',
        color: 'var(--text)',
      }}
    >
      <aside
        className="desktop-sidebar"
        style={{
          width: 280,
          position: 'fixed',
          top: 14,
          left: 14,
          bottom: 14,
          zIndex: 50,
          borderRadius: 28,
          overflow: 'hidden',
          background:
            'linear-gradient(180deg, #0B1220 0%, #111C34 45%, #101A30 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow:
            '0 24px 60px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ShellGlow />

        <div
          style={{
            position: 'relative',
            padding: '24px 20px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo size="md" />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-0.04em',
                  fontFamily: 'var(--font-display)',
                  lineHeight: 1,
                }}
              >
                रख<span style={{ color: '#22C55E' }}>रखाव</span>
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.46)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.22em',
                  fontWeight: 700,
                }}
              >
                Inventory and GST Suite
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: '14px 15px',
              borderRadius: 18,
              background:
                'linear-gradient(135deg, rgba(79,70,229,0.16), rgba(255,255,255,0.04))',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.58)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 6,
              }}
            >
              Control Center
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.82)',
                fontWeight: 500,
              }}
            >
              Sales, purchases, stock, GST, and reports in one premium workspace.
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 16px 10px', position: 'relative' }} ref={dropdownRef}>
          <div
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 14px',
              borderRadius: 18,
              background: dropdownOpen
                ? 'linear-gradient(135deg, rgba(79,70,229,0.26), rgba(79,70,229,0.12))'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${
                dropdownOpen ? 'rgba(99,102,241,0.34)' : 'rgba(255,255,255,0.08)'
              }`,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              userSelect: 'none',
              boxShadow: dropdownOpen ? '0 14px 34px rgba(79,70,229,0.18)' : 'none',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #4F46E5 0%, #22C55E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 10px 24px rgba(79,70,229,0.35)',
              }}
            >
              {initial}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || '—'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.42)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 2,
                }}
              >
                {user?.email || 'Shop account'}
              </div>
            </div>

            <svg
              width="12"
              height="12"
              viewBox="0 0 10 10"
              style={{
                flexShrink: 0,
                transition: 'transform 0.18s ease',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                color: 'rgba(255,255,255,0.48)',
              }}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 16,
                right: 16,
                background: 'rgba(12,19,35,0.98)',
                border: '1px solid rgba(99,102,241,0.28)',
                borderRadius: 18,
                boxShadow: '0 24px 48px rgba(0,0,0,0.38)',
                overflow: 'hidden',
                zIndex: 100,
                animation: 'dropFadeIn 0.16s ease',
                backdropFilter: 'blur(16px)',
              }}
            >
              <button
                onClick={goToProfile}
                style={{
                  width: '100%',
                  padding: '13px 15px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.90)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: 'var(--font-body)',
                }}
              >
                <span style={{ fontSize: 15 }}>👤</span>
                <div>
                  <div>Profile / प्रोफाइल</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
                    Shop settings, invoice info, account details
                  </div>
                </div>
              </button>

              <button
                onClick={logout}
                style={{
                  width: '100%',
                  padding: '13px 15px',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(252,165,165,0.92)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: 'var(--font-body)',
                }}
              >
                <span style={{ fontSize: 15 }}>🚪</span>
                <div>
                  <div>Logout / निकलें</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(252,165,165,0.42)', marginTop: 2 }}>
                    End this session securely
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 14px 14px', overflowY: 'auto', position: 'relative' }}>
          <div
            style={{
              padding: '0 10px 10px',
              fontSize: 10,
              color: 'rgba(255,255,255,0.32)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
            }}
          >
            Workspace
          </div>

          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 13px',
                  borderRadius: 18,
                  marginBottom: 6,
                  textDecoration: 'none',
                  position: 'relative',
                  background: active
                    ? 'linear-gradient(135deg, rgba(79,70,229,0.26), rgba(79,70,229,0.12))'
                    : 'transparent',
                  border: `1px solid ${
                    active ? 'rgba(99,102,241,0.24)' : 'transparent'
                  }`,
                  boxShadow: active ? '0 16px 34px rgba(79,70,229,0.18)' : 'none',
                  transition: 'all 0.18s ease',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: active
                      ? `linear-gradient(135deg, ${item.tone}, rgba(255,255,255,0.16))`
                      : 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: active ? `0 12px 24px ${item.tone}44` : 'none',
                    fontSize: 17,
                  }}
                >
                  {item.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: active ? 700 : 600,
                      color: active ? '#fff' : 'rgba(255,255,255,0.76)',
                      lineHeight: 1.2,
                    }}
                  >
                    {item.labelEn}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: active ? 'rgba(199,210,254,0.90)' : 'rgba(255,255,255,0.34)',
                      marginTop: 3,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.labelHi}
                  </div>
                </div>

                {active && (
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: `0 0 0 4px ${item.tone}44, 0 0 18px ${item.tone}`,
                      flexShrink: 0,
                    }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div
          style={{
            padding: '14px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
          }}
        >
          <div
            style={{
              padding: '14px 14px 12px',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.40)',
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                marginBottom: 6,
              }}
            >
              Rakhaav Cloud
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
              Business data, GST records, and day-to-day billing in one secure flow.
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 14,
              background: 'rgba(239,68,68,0.10)',
              color: '#FCA5A5',
              border: '1px solid rgba(239,68,68,0.16)',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'var(--font-body)',
            }}
          >
            🚪 Logout / निकलें
          </button>
        </div>
      </aside>

      <div
        className="mobile-topbar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: scrolled ? '12px 16px' : '14px 16px',
          background: scrolled
            ? 'rgba(248,250,252,0.86)'
            : 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(248,250,252,0.82))',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(148,163,184,0.16)',
          boxShadow: scrolled ? '0 10px 30px rgba(15,23,42,0.08)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size="sm" />
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#0F172A',
                fontFamily: 'var(--font-display)',
                lineHeight: 1,
              }}
            >
              रख<span style={{ color: '#22C55E' }}>रखाव</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, marginTop: 2 }}>
              Smart Billing Workspace
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }} ref={mobileDropRef}>
          <div
            onClick={() => setMobileDropOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px 6px 6px',
              borderRadius: 999,
              cursor: 'pointer',
              background: mobileDropOpen ? 'rgba(79,70,229,0.10)' : '#fff',
              border: `1px solid ${
                mobileDropOpen ? 'rgba(79,70,229,0.22)' : 'rgba(148,163,184,0.18)'
              }`,
              boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4F46E5 0%, #22C55E 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {initial}
            </div>
            <span
              style={{
                fontSize: 12,
                color: '#0F172A',
                fontWeight: 700,
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {firstName}
            </span>
          </div>

          {mobileDropOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 230,
                background: '#fff',
                border: '1px solid rgba(226,232,240,0.95)',
                borderRadius: 18,
                boxShadow: '0 24px 48px rgba(15,23,42,0.16)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  background:
                    'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(34,197,94,0.08))',
                  borderBottom: '1px solid rgba(226,232,240,0.9)',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{user?.email}</div>
              </div>

              <button
                onClick={goToProfile}
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(241,245,249,1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0F172A',
                  fontFamily: 'var(--font-body)',
                }}
              >
                👤 Profile / प्रोफाइल
              </button>

              <button
                onClick={logout}
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#DC2626',
                  fontFamily: 'var(--font-body)',
                }}
              >
                🚪 Logout / निकलें
              </button>
            </div>
          )}
        </div>
      </div>

      <main
        className="main-content"
        style={{
          marginLeft: 308,
          minHeight: '100vh',
          padding: '22px 22px 110px',
        }}
      >
        <div
          style={{
            minHeight: 'calc(100vh - 44px)',
            borderRadius: 30,
            background: 'rgba(255,255,255,0.56)',
            border: '1px solid rgba(226,232,240,0.72)',
            boxShadow: '0 24px 60px rgba(15,23,42,0.08)',
            padding: '26px',
            backdropFilter: 'blur(14px)',
          }}
        >
          {children}
        </div>
      </main>

      <nav
        className="mobile-bottom-nav"
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 60,
          display: 'none',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
          background: 'rgba(11,18,32,0.92)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 4px',
                  borderRadius: 18,
                  background: active ? 'rgba(79,70,229,0.18)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(99,102,241,0.22)' : 'transparent'}`,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    transform: active ? 'translateY(-1px)' : 'translateY(0)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: active ? 700 : 600,
                    color: active ? '#C7D2FE' : 'rgba(255,255,255,0.40)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.labelEn}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      <style>{`
        .desktop-sidebar { display: flex !important; }
        .mobile-topbar,
        .mobile-bottom-nav { display: none !important; }

        @media (max-width: 900px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content {
            margin-left: 0 !important;
            padding: 76px 12px 102px !important;
          }
          .main-content > div {
            border-radius: 24px !important;
            padding: 18px 14px !important;
          }
        }

        @keyframes dropFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
