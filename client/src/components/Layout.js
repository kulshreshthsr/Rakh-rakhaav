'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UpgradeModal from './subscription/UpgradeModal';
import ReadOnlyOverlay from './subscription/ReadOnlyOverlay';
import TrialWarningModal from './subscription/TrialWarningModal';
import { API, FALLBACK_PLANS, getTrialWarningKey } from '../lib/subscription';

const navItems = [
  { href: '/dashboard', labelHi: 'होम', labelEn: 'Dashboard', icon: '🏠' },
  { href: '/product', labelHi: 'उत्पाद', labelEn: 'Products', icon: '📦' },
  { href: '/sales', labelHi: 'बिक्री', labelEn: 'Sales', icon: '📈' },
  { href: '/purchases', labelHi: 'खरीद', labelEn: 'Purchases', icon: '🛒' },
  { href: '/udhaar', labelHi: 'उधार', labelEn: 'Udhaar', icon: '🤝' },
  { href: '/gst', labelHi: 'GST', labelEn: 'GST', icon: '🧾' },
  { href: '/reports', labelHi: 'रिपोर्ट', labelEn: 'Reports', icon: '📊' },
];

function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 34 : size === 'lg' ? 54 : 42;
  const radius = size === 'sm' ? 12 : size === 'lg' ? 18 : 15;
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  if (!err) {
    return (
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: radius,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(67,56,202,0.92), rgba(16,185,129,0.18))',
          border: '1px solid rgba(165,180,252,0.22)',
          boxShadow: '0 12px 28px rgba(79,70,229,0.18)',
        }}
      >
        <img
          src="/logo.png"
          alt="Logo"
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
        background: 'linear-gradient(135deg, #4338ca, #0ea5e9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(165,180,252,0.24)',
        boxShadow: '0 14px 30px rgba(79,70,229,0.18)',
      }}
    >
      <span style={{ fontSize, fontWeight: 800, color: '#f8fafc', fontFamily: 'serif' }}>र</span>
    </div>
  );
}

const linkBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 12px',
  borderRadius: 16,
  textDecoration: 'none',
  transition: 'all 0.18s ease',
  position: 'relative',
};

export default function Layout({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTrialWarning, setShowTrialWarning] = useState(false);
  const [paywallPlan, setPaywallPlan] = useState('six_month');
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropOpen, setMobileDropOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileDropRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  const refreshSubscriptionStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API}/api/auth/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      setSubscription(data.subscription || null);
      setPlans(data.plans?.length ? data.plans : FALLBACK_PLANS);
      setRazorpayKeyId(data.razorpayKeyId || '');
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user || !token) {
      router.push('/login');
      return;
    }
    refreshSubscriptionStatus();
  }, [router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  useEffect(() => {
    if (!subscription?.shouldWarnTrial || subscription?.isReadOnly) {
      setShowTrialWarning(false);
      return;
    }

    const warningKey = getTrialWarningKey();
    if (!localStorage.getItem(warningKey)) {
      setShowTrialWarning(true);
      localStorage.setItem(warningKey, 'shown');
    }
  }, [subscription]);

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

  const handleUpgradeSuccess = async (nextSubscription) => {
    setSubscription(nextSubscription || null);
    setShowUpgradeModal(false);
    setShowTrialWarning(false);
    await refreshSubscriptionStatus();
  };

  const isActive = (href) => pathname === href;
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';
  const firstName = user?.name?.split(' ')?.[0] || 'Profile';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'transparent',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className={subscription?.isReadOnly ? 'shell-readonly-content' : ''}>
      <aside
        className="desktop-sidebar"
        style={{
          width: 268,
          padding: '16px 12px 14px',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 28,
            background:
              'linear-gradient(180deg, rgba(11,16,35,0.98), rgba(20,28,62,0.97) 48%, rgba(11,16,35,0.99))',
            border: '1px solid rgba(165,180,252,0.08)',
            boxShadow: '0 28px 80px rgba(13,19,43,0.28)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -70,
              right: -50,
              width: 170,
              height: 170,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.22), transparent 65%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px 14px' }}>
            <Logo size="md" />
            <div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-0.04em',
                  fontFamily: 'serif',
                }}
              >
                रख<span style={{ color: '#a5b4fc' }}>रखाव</span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(226,232,240,0.46)',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                Business Manager
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.42)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Workspace
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)', fontWeight: 700, marginTop: 2 }}>
                Inventory, billing and GST
              </div>
            </div>
            <div className="badge" style={{ background: 'rgba(99,102,241,0.16)', color: '#c7d2fe', border: '1px solid rgba(165,180,252,0.16)' }}>Live</div>
          </div>

          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setDropdownOpen((value) => !value)}
              style={{
                width: '100%',
                border: '1px solid rgba(165,180,252,0.1)',
                background: dropdownOpen
                  ? 'linear-gradient(180deg, rgba(99,102,241,0.18), rgba(99,102,241,0.08))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                borderRadius: 18,
                padding: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                color: '#fff',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4338ca, #0ea5e9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: '0 12px 26px rgba(79,70,229,0.2)',
                }}
              >
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.name || 'Shopkeeper'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.46)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.email || 'Business account'}
                </div>
              </div>
              <span
                style={{
                  color: 'rgba(165,180,252,0.78)',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                }}
              >
                ▼
              </span>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  borderRadius: 18,
                  overflow: 'hidden',
                  border: '1px solid rgba(165,180,252,0.14)',
                  background: 'linear-gradient(180deg, rgba(16,23,53,0.98), rgba(11,16,35,0.98))',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={goToProfile}
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.86)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 16 }}>👤</span>
                  <span>Profile / प्रोफाइल</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🚪</span>
                  <span>Logout / निकलें</span>
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(226,232,240,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              padding: '10px 8px 8px',
            }}
          >
            Main Menu
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    ...linkBase,
                    marginBottom: 6,
                    color: active ? '#f8fafc' : 'rgba(226,232,240,0.62)',
                    background: active
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))'
                      : 'transparent',
                    border: `1px solid ${active ? 'rgba(165,180,252,0.12)' : 'transparent'}`,
                    boxShadow: active ? '0 20px 34px rgba(8,21,40,0.24)' : 'none',
                  }}
                >
                  {active && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 10,
                        bottom: 10,
                        width: 4,
                        borderRadius: '0 999px 999px 0',
                        background: 'linear-gradient(180deg, #818cf8, #38bdf8)',
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: active ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.04)',
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.15 }}>{item.labelEn}</div>
                    <div style={{ fontSize: 10.5, color: active ? 'rgba(226,232,240,0.78)' : 'rgba(226,232,240,0.4)' }}>
                      {item.labelHi}
                    </div>
                  </div>
                  {active && (
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: '#a5b4fc',
                        boxShadow: '0 0 12px rgba(165,180,252,0.8)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={logout}
            style={{
              marginTop: 10,
              width: '100%',
              borderRadius: 18,
              border: '1px solid rgba(248,113,113,0.14)',
              background: 'linear-gradient(180deg, rgba(127,29,29,0.2), rgba(127,29,29,0.12))',
              color: '#fecaca',
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Logout / निकलें
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
          gap: 12,
          padding: '14px 14px 12px',
          background: scrolled ? 'rgba(8,21,40,0.92)' : 'rgba(8,21,40,0.84)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(165,180,252,0.1)',
          boxShadow: '0 12px 32px rgba(13,19,43,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size="sm" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: 'serif' }}>
              रख<span style={{ color: '#a5b4fc' }}>रखाव</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Business Manager</div>
          </div>
        </div>

        <div ref={mobileDropRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMobileDropOpen((value) => !value)}
            style={{
              border: '1px solid rgba(165,180,252,0.12)',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              padding: '6px 8px 6px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4338ca, #0ea5e9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {initial}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{firstName}</span>
            <span
              style={{
                fontSize: 10,
                transform: mobileDropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.18s ease',
                color: '#a5b4fc',
              }}
            >
              ▼
            </span>
          </button>

          {mobileDropOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 220,
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid rgba(165,180,252,0.16)',
                background: 'linear-gradient(180deg, rgba(16,23,53,0.98), rgba(11,16,35,0.98))',
                boxShadow: '0 24px 50px rgba(0,0,0,0.34)',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  background: 'rgba(99,102,241,0.1)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{user?.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11, marginTop: 2 }}>{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={goToProfile}
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.86)',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                👤 Profile / प्रोफाइल
              </button>
              <button
                type="button"
                onClick={logout}
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: '#fecaca',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
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
          marginLeft: 268,
          padding: '28px 24px 92px',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: 1380,
            margin: '0 auto',
          }}
        >
          {subscription?.shouldWarnTrial && !subscription?.isReadOnly && (
            <div className="trial-banner">
              <div className="trial-banner-copy">
                <div className="trial-banner-title">Your free trial ends in {subscription.trialDaysLeft} day{subscription.trialDaysLeft === 1 ? '' : 's'}</div>
                <div className="trial-banner-subtitle">Upgrade now to keep GST exports, reports, udhaar and premium workflows active without interruption.</div>
              </div>
              <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowUpgradeModal(true)}>
                Upgrade
              </button>
            </div>
          )}
          {children}
        </div>
      </main>

      <nav
        className="mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 10,
          left: 12,
          right: 12,
          zIndex: 60,
          display: 'none',
        }}
      >
        <div
          style={{
            borderRadius: 24,
            background: 'rgba(11,16,35,0.94)',
            border: '1px solid rgba(165,180,252,0.12)',
            boxShadow: '0 24px 60px rgba(13,19,43,0.28)',
            padding: '7px 6px calc(7px + env(safe-area-inset-bottom))',
            display: 'flex',
          }}
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  flex: 1,
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '8px 2px',
                  borderRadius: 18,
                  position: 'relative',
                  color: active ? '#fff' : 'rgba(226,232,240,0.46)',
                  background: active ? 'linear-gradient(180deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))' : 'transparent',
                }}
              >
                <span style={{ fontSize: 18, transform: active ? 'translateY(-1px)' : 'none' }}>{item.icon}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700 }}>{item.labelEn}</span>
              </a>
            );
          })}
        </div>
      </nav>
      </div>

      <ReadOnlyOverlay
        visible={Boolean(subscription?.isReadOnly)}
        plans={plans}
        selectedPlan={paywallPlan}
        onSelectPlan={setPaywallPlan}
        onUpgrade={() => setShowUpgradeModal(true)}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        plans={plans}
        subscription={subscription}
        razorpayKeyId={razorpayKeyId}
        onSuccess={handleUpgradeSuccess}
        initialPlan={paywallPlan}
        title={subscription?.isReadOnly ? 'Reactivate full access' : 'Upgrade to premium'}
        subtitle={subscription?.isReadOnly
          ? 'Your data is safe and visible. Upgrade now to unlock billing actions, GST exports, reports and customer credit workflows again.'
          : 'Choose a plan that keeps your business records, exports and workflows fully active.'}
      />

      <TrialWarningModal
        open={showTrialWarning}
        daysLeft={subscription?.trialDaysLeft}
        onClose={() => setShowTrialWarning(false)}
        onUpgrade={() => {
          setShowTrialWarning(false);
          setShowUpgradeModal(true);
        }}
      />

      <style>{`
        .desktop-sidebar { display: flex; }
        .mobile-topbar { display: none; }
        .mobile-bottom-nav { display: none; }

        @media (max-width: 900px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .main-content {
            margin-left: 0 !important;
            padding: 84px 14px 112px !important;
          }
        }

        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
