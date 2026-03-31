'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UpgradeModal from './subscription/UpgradeModal';
import ReadOnlyOverlay from './subscription/ReadOnlyOverlay';
import SyncStatusBar from './SyncStatusBar';
import { API, FALLBACK_PLANS, hasTrialGateSeen, hasWelcomePending, readStoredSubscription, writeStoredSubscription } from '../lib/subscription';
import { useAppLocale } from './AppLocale';

const NAV_ITEMS = [
  { href: '/dashboard', key: 'dashboard', shortLabel: 'Home',    tone: 'home'     },
  { href: '/product',   key: 'products',  shortLabel: 'Stock',   tone: 'stock'    },
  { href: '/sales',     key: 'sales',     shortLabel: 'Sales',   tone: 'sales'    },
  { href: '/purchases', key: 'purchases', shortLabel: 'Buy',     tone: 'purchase' },
  { href: '/udhaar',    key: 'udhaar',    shortLabel: 'Ledger',  tone: 'credit'   },
  { href: '/gst',       key: 'gst',       shortLabel: 'GST',     tone: 'gst'      },
  { href: '/reports',   key: 'reports',   shortLabel: 'Reports', tone: 'reports'  },
];

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

/* ─── Icons ──────────────────────────────── */
function Glyph({ name, size = 20, stroke = 1.8 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const icons = {
    dashboard:  <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13V10.5" /><path d="M9.5 20v-5h5v5" /></>,
    products:   <><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /><path d="M12 12v9" /></>,
    sales:      <><path d="M12 2v20" /><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></>,
    purchases:  <><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" /></>,
    udhaar:     <><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3" /><path d="M6 3.5v20" /><path d="M9 7.5h6" /><path d="M9 11.5h6" /><path d="M9 15.5h4" /></>,
    gst:        <><path d="M7 4.5h10" /><path d="M7 9.5h10" /><path d="M7 14.5h5" /><path d="M16.5 13v7" /><path d="M13.5 16h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></>,
    reports:    <><path d="M5 19.5V10.5" /><path d="M12 19.5V5.5" /><path d="M19 19.5V13.5" /><path d="M3.5 19.5h17" /></>,
    profile:    <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    logout:     <><path d="M10 7V5.5A2.5 2.5 0 0 1 12.5 3H18a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21h-5.5A2.5 2.5 0 0 1 10 18.5V17" /><path d="M14 12H3.5" /><path d="m7.5 8-4 4 4 4" /></>,
    pricing:    <path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z" />,
    language:   <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></>,
  };
  return <svg {...p}>{icons[name] || <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />}</svg>;
}

/* ─── Logo ───────────────────────────────── */
function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim    = size === 'sm' ? 34 : size === 'lg' ? 58 : 46;
  const radius = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
  const style  = { width: dim, height: dim, borderRadius: radius };

  if (!err) {
    return (
      <div className="brand-logo-frame" style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Rakh-Rakhaav logo" width={dim} height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setErr(true)} />
      </div>
    );
  }

  return (
    <div className="brand-logo-fallback" style={style}>
      <span style={{ fontSize: size === 'sm' ? 14 : 20, fontWeight: 900 }}>R</span>
    </div>
  );
}

/* ─── User dropdown ──────────────────────── */
function UserDropdown({ onProfile, onLogout, extraItems }) {
  return (
    <div className="sidebar-user-menu">
      <button type="button" onClick={onProfile}><Glyph name="profile" size={16} /> Profile</button>
      {extraItems}
      <button type="button" onClick={onLogout} className="danger"><Glyph name="logout" size={16} /> Logout</button>
    </div>
  );
}

/* ─── Main layout ────────────────────────── */
function LayoutInner({ children }) {
  const { locale, t } = useAppLocale();
  const [user, setUser]                   = useState(() => readStoredUser());
  const [subscription, setSubscription]   = useState(() => readStoredSubscription());
  const [plans, setPlans]                 = useState(FALLBACK_PLANS);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paywallPlan, setPaywallPlan]     = useState('six_month');
  const [scrolled, setScrolled]           = useState(false);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [mobileDropOpen, setMobileDropOpen] = useState(false);

  const dropdownRef   = useRef(null);
  const mobileDropRef = useRef(null);
  const router   = useRouter();
  const pathname = usePathname();

  /* ── Auth & subscription ─────────────── */
  const refreshSubscription = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const res = await fetch(`${API}/api/auth/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return false;
      }
      if (!res.ok) return false;

      const data = await res.json();
      if (data.user) { setUser(data.user); localStorage.setItem('user', JSON.stringify(data.user)); }
      setSubscription(data.subscription || null);
      writeStoredSubscription(data.subscription || null);
      setPlans(data.plans?.length ? data.plans : FALLBACK_PLANS);
      setRazorpayKeyId(data.razorpayKeyId || '');
      return true;
    } catch { return false; }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const id = window.setTimeout(refreshSubscription, 0);
    return () => window.clearTimeout(id);
  }, [refreshSubscription, router]);

  /* ── Scroll ──────────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Click-outside dropdowns ─────────── */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))     setDropdownOpen(false);
      if (mobileDropRef.current && !mobileDropRef.current.contains(e.target)) setMobileDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Route guards ────────────────────── */
  useEffect(() => {
    if (!pathname || ['/pricing', '/welcome', '/trial-status'].includes(pathname)) return;
    if (hasWelcomePending()) { router.replace('/welcome'); return; }
    if (subscription && !subscription.isPro && !hasTrialGateSeen()) router.replace('/trial-status');
  }, [pathname, router, subscription]);

  /* ── Actions ─────────────────────────── */
  const logout = () => {
    setDropdownOpen(false); setMobileDropOpen(false);
    localStorage.removeItem('token'); localStorage.removeItem('user');
    router.push('/login');
  };

  const goToProfile = () => {
    setDropdownOpen(false); setMobileDropOpen(false);
    router.push('/profile');
  };

  const handleUpgradeSuccess = async (next) => {
    setSubscription(next || null);
    writeStoredSubscription(next || null);
    setShowUpgradeModal(false);
    await refreshSubscription();
  };

  /* ── Derived ─────────────────────────── */
  const initial   = user?.name?.charAt(0)?.toUpperCase() || '?';
  const firstName = user?.name?.split(' ')?.[0] || 'Profile';

  const translatedNav = useMemo(() => NAV_ITEMS.map(item => ({ ...item, label: t(item.key) })), [t]);
  const upgradeLabel  = subscription?.isPro ? 'Manage Plan' : 'Upgrade';

  return (
    <div className="app-shell-root">
      <div className={subscription?.isReadOnly ? 'shell-readonly-content' : ''}>

        {/* ── Desktop sidebar ───────────────────── */}
        <aside className="desktop-sidebar premium-sidebar">
          <div className="sidebar-panel">
            <div className="sidebar-orb sidebar-orb-top" />
            <div className="sidebar-orb sidebar-orb-bottom" />

            {/* Brand */}
            <div className="brand-lockup">
              <div className="brand-row">
                <div>
                  <div className="brand-title brand-title-hindi">रखरखाव</div>
                  <div className="brand-subtitle">आपके व्यापार का भरोसेमंद साथी</div>
                </div>
              </div>
              <div className="brand-status-card">
                <div>
                  <div className="brand-status-label">{t('workspace')}</div>
                  <div className="brand-status-copy">{t('workspaceCopy')}</div>
                </div>
                <div className="badge badge-blue brand-live-pill">{t('live')}</div>
              </div>
            </div>

            {/* Quick shortcuts */}
            <div className="sidebar-quick-grid">
              <a href="/pricing" className="sidebar-shortcut">
                <div className="sidebar-shortcut-icon"><Glyph name="pricing" size={18} /></div>
                <div>
                  <div className="sidebar-shortcut-title">{t('pricing')}</div>
                  <div className="sidebar-shortcut-copy">{t('plans')}</div>
                </div>
              </a>
              <a href="/reports" className="sidebar-shortcut is-secondary">
                <div className="sidebar-shortcut-icon"><Glyph name="reports" size={18} /></div>
                <div>
                  <div className="sidebar-shortcut-title">{t('reports')}</div>
                  <div className="sidebar-shortcut-copy">{t('reportsShortcut')}</div>
                </div>
              </a>
            </div>

            {/* User card */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button type="button" className="sidebar-user-card" onClick={() => setDropdownOpen(v => !v)}>
                <div className="sidebar-avatar">{initial}</div>
                <div className="sidebar-user-copy">
                  <div className="sidebar-user-name">{user?.name || 'Shopkeeper'}</div>
                  <div className="sidebar-user-email">{user?.email || 'Business account'}</div>
                </div>
                <div className={`sidebar-chevron${dropdownOpen ? ' is-open' : ''}`}>⌄</div>
              </button>
              {dropdownOpen && <UserDropdown onProfile={goToProfile} onLogout={logout} />}
            </div>

            <div className="sidebar-section-label">{t('mainMenu')}</div>

            {/* Nav */}
            <nav className="sidebar-nav">
              {translatedNav.map(item => (
                <a key={item.href} href={item.href}
                  className={`nav-link nav-tone-${item.tone}${pathname === item.href ? ' is-active' : ''}`}>
                  <span className="nav-link-accent" />
                  <span className="nav-icon-wrap"><Glyph name={item.key} size={18} /></span>
                  <span className="nav-copy">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-short">{item.shortLabel}</span>
                  </span>
                </a>
              ))}
            </nav>

            <button type="button" onClick={logout} className="sidebar-logout">
              <Glyph name="logout" size={16} /> Logout
            </button>
          </div>
        </aside>

        {/* ── Mobile top bar ────────────────────── */}
        <div className={`mobile-topbar premium-topbar${scrolled ? ' is-scrolled' : ''}`}>
          <div className="mobile-topbar-brand">
            <div>
              <div className="mobile-brand-title brand-title-hindi">रखरखाव</div>
              <div className="mobile-brand-subtitle">आपके व्यापार का भरोसेमंद साथी</div>
            </div>
          </div>

          <div className="mobile-topbar-actions">
            <div ref={mobileDropRef} style={{ position: 'relative' }}>
              <button type="button" className="mobile-user-chip" onClick={() => setMobileDropOpen(v => !v)}>
                <div className="mobile-avatar">{initial}</div>
                <span>{firstName}</span>
              </button>
              {mobileDropOpen && (
                <UserDropdown onProfile={goToProfile} onLogout={logout}
                  extraItems={<>
                    <a href="/reports"><Glyph name="reports" size={16} /> Reports</a>
                    <a href="/pricing"><Glyph name="pricing" size={16} /> Pricing</a>
                  </>}
                />
              )}
            </div>
            <a href="/pricing" className={`top-upgrade-chip${subscription?.isPro ? ' is-manage' : ' is-shining'}`}>
              <Glyph name="pricing" size={14} /> {upgradeLabel}
            </a>
          </div>
        </div>

        <SyncStatusBar />

        {/* ── Main content ──────────────────────── */}
        <main className="main-content premium-main-content">
          <div className="content-container">{children}</div>
        </main>

        {/* ── Mobile bottom nav ─────────────────── */}
        <nav className="mobile-bottom-nav premium-bottom-nav">
          <div className="mobile-bottom-nav-card">
            {translatedNav.map(item => (
              <a key={item.href} href={item.href}
                className={`mobile-nav-link mobile-nav-tone-${item.tone}${pathname === item.href ? ' is-active' : ''}`}>
                <span className="mobile-nav-glow" />
                <Glyph name={item.key} size={18} />
                <span>{item.shortLabel}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>

      {/* ── Overlays ──────────────────────────── */}
      <ReadOnlyOverlay
        visible={Boolean(subscription?.isReadOnly)}
        plans={plans} selectedPlan={paywallPlan}
        onSelectPlan={setPaywallPlan}
        onUpgrade={() => setShowUpgradeModal(true)}
        onLogout={logout}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        plans={plans} subscription={subscription}
        razorpayKeyId={razorpayKeyId}
        onSuccess={handleUpgradeSuccess}
        initialPlan={paywallPlan}
        title={subscription?.isReadOnly ? 'Reactivate full access' : 'Unlock premium access'}
        subtitle={
          subscription?.isReadOnly
            ? 'Your data is safe and visible. Upgrade now to unlock billing actions, GST exports, reports and customer credit workflows again.'
            : 'Choose a membership plan that keeps billing, GST, reports and customer workflows fully active.'
        }
      />
    </div>
  );
}

export default function Layout({ children }) {
  return <LayoutInner>{children}</LayoutInner>;
}
