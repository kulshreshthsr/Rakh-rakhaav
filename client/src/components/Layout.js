'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import UpgradeModal from './subscription/UpgradeModal';
import ReadOnlyOverlay from './subscription/ReadOnlyOverlay';
import SyncStatusBar from './SyncStatusBar';
import {
  API, FALLBACK_PLANS, clearTrialGateSeen, hasTrialGateSeen,
  hasWelcomePending, mergePlansWithFallback, readStoredSubscription,
  setWelcomePending, writeStoredSubscription,
} from '../lib/subscription';
import { useAppLocale } from './AppLocale';

/* ─── Nav config ─────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { href: '/dashboard', key: 'dashboard', shortLabel: 'Home',     tone: 'home'     },
  { href: '/product',   key: 'products',  shortLabel: 'Stock',    tone: 'stock'    },
  { href: '/sales',     key: 'sales',     shortLabel: 'Sale',     tone: 'sales'    },
  { href: '/purchases', key: 'purchases', shortLabel: 'Purchase', tone: 'purchase' },
  { href: '/udhaar',    key: 'udhaar',    shortLabel: 'Udhaar',   tone: 'credit'   },
  { href: '/gst',       key: 'gst',       shortLabel: 'GST',      tone: 'gst'      },
  { href: '/reports',   key: 'reports',   shortLabel: 'Reports',  tone: 'reports'  },
];

// ── 5-item bottom nav: Home | Sale | Reports | Udhaar | More ──
const MOBILE_BOTTOM_NAV = [
  { href: '/dashboard', key: 'dashboard', shortLabel: 'Home',    icon: 'dashboard' },
  { href: '/sales',     key: 'sales',     shortLabel: 'Sale',    icon: 'sales'     },
  { href: '/purchases', key: 'purchases', shortLabel: 'Purchase', icon: 'purchases' },
  { href: '/udhaar',    key: 'udhaar',    shortLabel: 'Udhaar',   icon: 'udhaar'    },
];

// ── More drawer items ──
const MORE_DRAWER_ITEMS = [
  { href: '/product',   key: 'products',  label: 'Stock',     sublabel: 'Products & Inventory', icon: 'products' },
  { href: '/gst',       key: 'gst',       label: 'GST',       sublabel: 'Tax Filing',           icon: 'gst'      },
  { href: '/reports',   key: 'reports',   label: 'रिपोर्ट',   sublabel: 'Reports',              icon: 'reports'  },
  { href: '/profile',   key: 'profile',   label: 'Profile',   sublabel: 'दुकान की जानकारी',     icon: 'profile'  },
];

const SUBSCRIPTION_REFRESH_TTL_MS = 60 * 1000;
const PREFETCH_ROUTES = [...new Set([...NAV_ITEMS.map((i) => i.href), '/pricing', '/reports', '/profile'])];

/* ─── Helpers ────────────────────────────────────────────────────── */
function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function shouldRefreshSubscriptionCache() {
  if (typeof window === 'undefined') return true;
  try {
    const t = Number(sessionStorage.getItem('subscription-status:last-refresh') || 0);
    return !t || Date.now() - t > SUBSCRIPTION_REFRESH_TTL_MS;
  } catch { return true; }
}
function markSubscriptionRefreshNow() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem('subscription-status:last-refresh', String(Date.now())); } catch {}
}

/* ─── Icons ──────────────────────────────────────────────────────── */
function Glyph({ name, size = 20, stroke = 1.8 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  };
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
    menu:       <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close:      <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
    more:       <><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/></>,
  };
  return <svg {...p}>{icons[name] || <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />}</svg>;
}

/* ─── Logo ───────────────────────────────────────────────────────── */
function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 34 : size === 'lg' ? 58 : 46;
  const frameClass = size === 'sm'
    ? 'h-[34px] w-[34px] rounded-[12px]'
    : size === 'lg'
      ? 'h-[58px] w-[58px] rounded-[20px]'
      : 'h-[46px] w-[46px] rounded-[16px]';
  const fallbackTextClass = size === 'sm' ? 'text-[14px] font-black' : 'text-[20px] font-black';

  if (!err) {
    return (
      <div className={`brand-logo-frame ${frameClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Rakh-Rakhaav logo" width={dim} height={dim}
          className="h-full w-full object-contain"
          onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className={`brand-logo-fallback ${frameClass}`}>
      <span className={fallbackTextClass}>R</span>
    </div>
  );
}

/* ─── User dropdown (desktop) ────────────────────────────────────── */
function UserDropdown({ onProfile, onLogout, extraItems, className = '' }) {
  return (
    <div className={`sidebar-user-menu${className ? ` ${className}` : ''}`}>
      <button type="button" onClick={onProfile}><Glyph name="profile" size={16} /> Profile</button>
      {extraItems}
      <button type="button" onClick={onLogout} className="danger"><Glyph name="logout" size={16} /> Logout</button>
    </div>
  );
}

/* ─── More drawer (mobile) ───────────────────────────────────────── */
function MoreDrawer({ open, onClose, pathname, onLogout, subscription }) {
  const drawerRef = useRef(null);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const iconColors = {
    products:  'bg-violet-50 text-violet-600',
    reports:   'bg-violet-50 text-violet-600',
    gst:       'bg-amber-50 text-amber-600',
    profile:   'bg-slate-100 text-slate-600',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Sheet — slides up from bottom */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="More options"
        className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl shadow-slate-900/20 border-t border-slate-100 max-h-[85dvh] overflow-y-auto">

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Quick Access</p>
              <h2 className="text-[18px] font-black text-slate-900 mt-0.5">और विकल्प</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <Glyph name="close" size={16} stroke={2} />
            </button>
          </div>

          {/* Nav items grid */}
          <div className="px-4 pb-3 grid grid-cols-1 gap-2">
            {MORE_DRAWER_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-cyan-200 bg-cyan-50'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-cyan-500 text-white' : iconColors[item.key] || 'bg-slate-100 text-slate-600'
                  }`}>
                    <Glyph name={item.icon} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[15px] font-black leading-tight ${isActive ? 'text-cyan-700' : 'text-slate-900'}`}>
                      {item.label}
                    </div>
                    <div className="text-[12px] text-slate-400 mt-0.5">{item.sublabel}</div>
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
                  )}
                  {!isActive && (
                    <span className="text-slate-300 flex-shrink-0">
                      <Glyph name="close" size={12} stroke={2} />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Upgrade card */}
          <div className="px-4 pb-3 pt-2">
            <Link href="/pricing" onClick={onClose}
              className="relative flex items-center gap-4 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-200/70"
            >
              <div className="pointer-events-none absolute inset-y-0 -left-1 w-24 bg-gradient-to-r from-white/70 via-white/20 to-transparent skew-x-[-18deg] animate-[premiumShine_2.7s_ease-in-out_infinite]" />
              <div className="relative z-10 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Glyph name="pricing" size={18} />
              </div>
              <div className="relative z-10 flex-1">
                <div className="text-[15px] font-black text-amber-900">
                  {subscription?.isPro ? 'Manage Plan' : 'Upgrade करें'}
                </div>
                <div className="text-[12px] text-amber-600">
                  {subscription?.isPro ? 'Pro plan active ✓' : 'Pro features unlock करें'}
                </div>
              </div>
              <div className="relative z-10 text-amber-500">
                <Glyph name="pricing" size={16} />
              </div>
            </Link>
          </div>

          {/* Logout */}
          <div className="px-4 pb-6 pt-1">
            <button
              type="button"
              onClick={() => { onClose(); onLogout(); }}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-rose-100 bg-rose-50 text-[14px] font-black text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <Glyph name="logout" size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main layout ────────────────────────────────────────────────── */
function LayoutInner({ children }) {
  const { locale, t } = useAppLocale();
  const [user, setUser]                     = useState(() => readStoredUser());
  const [subscription, setSubscription]     = useState(() => readStoredSubscription());
  const [plans, setPlans]                   = useState(FALLBACK_PLANS);
  const [razorpayKeyId, setRazorpayKeyId]   = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paywallPlan, setPaywallPlan]       = useState('weekly');
  const [scrolled, setScrolled]             = useState(false);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen]             = useState(false);  // ← new More drawer

  const dropdownRef    = useRef(null);
  const mobileProfileRef = useRef(null);
  const router         = useRouter();
  const pathname       = usePathname();

  /* ── Auth & subscription ──────────────────────────────────────── */
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
        clearTrialGateSeen();
        setWelcomePending(false);
        router.push('/login');
        return false;
      }
      if (!res.ok) return false;
      const data = await res.json();
      if (data.user) { setUser(data.user); localStorage.setItem('user', JSON.stringify(data.user)); }
      setSubscription(data.subscription || null);
      writeStoredSubscription(data.subscription || null);
      setPlans(mergePlansWithFallback(data.plans));
      setRazorpayKeyId(data.razorpayKeyId || '');
      markSubscriptionRefreshNow();
      return true;
    } catch { return false; }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    if (!shouldRefreshSubscriptionCache()) return;
    const id = window.setTimeout(refreshSubscription, 0);
    return () => window.clearTimeout(id);
  }, [refreshSubscription, router]);

  /* ── Scroll ───────────────────────────────────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    PREFETCH_ROUTES.forEach((href) => router.prefetch(href));
  }, [router]);

  /* ── Click-outside desktop dropdown ──────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (mobileProfileRef.current && !mobileProfileRef.current.contains(e.target)) setMobileProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Route guards ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!pathname || ['/pricing', '/welcome', '/trial-status'].includes(pathname)) return;
    if (hasWelcomePending()) { router.replace('/welcome'); return; }
    if (subscription && !subscription.isPro && !hasTrialGateSeen()) router.replace('/trial-status');
  }, [pathname, router, subscription]);

  /* ── Actions ──────────────────────────────────────────────────── */
  const logout = () => {
    setDropdownOpen(false); setMobileProfileOpen(false); setMoreOpen(false);
    localStorage.removeItem('token'); localStorage.removeItem('user');
    clearTrialGateSeen();
    setWelcomePending(false);
    router.push('/login');
  };

  const goToProfile = () => {
    setDropdownOpen(false);
    setMobileProfileOpen(false);
    router.push('/profile');
  };

  const handleUpgradeSuccess = async (next) => {
    setSubscription(next || null);
    writeStoredSubscription(next || null);
    setShowUpgradeModal(false);
    await refreshSubscription();
  };

  /* ── Derived ──────────────────────────────────────────────────── */
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  const bilingualLabels = useMemo(() => ({
    dashboard: 'होम / Dashboard',
    products:  'स्टॉक / Products',
    sales:     'बेचिए / Sales',
    purchases: 'खरीदिए / Purchases',
    udhaar:    'उधार / Credit',
    gst:       'GST / Tax',
    reports:   'रिपोर्ट / Hisaab',
  }), []);

  const translatedNav = useMemo(
    () => NAV_ITEMS.map((item) => ({ ...item, label: bilingualLabels[item.key] || t(item.key) })),
    [bilingualLabels, t]
  );

  const upgradeLabel = subscription?.isPro ? 'Manage Plan' : 'Upgrade';

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div className="app-shell-root rr-workspace-premium">
      <div className={subscription?.isReadOnly ? 'shell-readonly-content' : ''}>

        {/* ══ Desktop sidebar (unchanged) ═══════════════════════════ */}
        <aside className={`desktop-sidebar premium-sidebar${locale === 'hi' ? ' sidebar-locale-hi' : ''}`}>
          <div className="sidebar-panel">
            <div className="sidebar-orb sidebar-orb-top" />
            <div className="sidebar-orb sidebar-orb-bottom" />

            {/* Brand */}
            <div className="brand-lockup">
              <div className="brand-row">
                <Logo />
                <div>
                  <div className="brand-title brand-title-hindi">रखरखाव</div>
                </div>
              </div>
            </div>

            {/* User card */}
            <div ref={dropdownRef} className="relative">
              <button type="button" className="sidebar-user-card" onClick={() => setDropdownOpen(v => !v)}>
                <div className="sidebar-avatar">{initial}</div>
                <div className="sidebar-user-copy">
                  <div className="sidebar-user-name">{user?.name || 'Shopkeeper'}</div>
                  <div className="sidebar-user-email">{user?.email || 'Business account'}</div>
                </div>
                <div className={`sidebar-chevron${dropdownOpen ? ' is-open' : ''}`}>⌄</div>
              </button>
              {dropdownOpen && (
                <UserDropdown
                  onProfile={goToProfile}
                  onLogout={logout}
                  extraItems={<Link href="/pricing"><Glyph name="pricing" size={16} /> Rakhrakhaav Pro</Link>}
                />
              )}
            </div>

            <div className="sidebar-section-label">{t('mainMenu')}</div>

            <nav className="sidebar-nav">
              {translatedNav.map(item => (
                <Link key={item.href} href={item.href}
                  className={`nav-link nav-tone-${item.tone}${pathname === item.href ? ' is-active' : ''}`}>
                  <span className="nav-link-accent" />
                  <span className="nav-icon-wrap"><Glyph name={item.key} size={18} /></span>
                  <span className="nav-copy">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-short">{item.shortLabel}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* ══ Mobile top bar ════════════════════════════════════════ */}
        <div className={`mobile-topbar premium-topbar${scrolled ? ' is-scrolled' : ''}`}>
          <div className="mobile-topbar-brand">
            <Logo size="sm" />
            <div className="mobile-brand-copy">
              <div className="mobile-brand-title">रखरखाव</div>
              <div className="mobile-brand-subtitle">Simple business app</div>
            </div>
          </div>

          {/* Right side: upgrade badge + profile avatar */}
          <div className="relative flex items-center gap-2" ref={mobileProfileRef}>
            {!subscription?.isPro && (
              <Link href="/pricing"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-black text-amber-700 hover:bg-amber-100 transition-colors"
              >
                ⚡ Upgrade
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileProfileOpen((v) => !v)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-[13px] shadow-md hover:shadow-lg hover:-translate-y-px transition-all"
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={mobileProfileOpen}
            >
              {initial}
            </button>
            {mobileProfileOpen && (
              <UserDropdown
                onProfile={goToProfile}
                onLogout={logout}
                className="mobile-user-menu"
              />
            )}
          </div>
        </div>

        <SyncStatusBar />

        {/* ══ More drawer ════════════════════════════════════════════ */}
        <MoreDrawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          pathname={pathname}
          onLogout={logout}
          subscription={subscription}
        />

        {/* ══ Main content ══════════════════════════════════════════ */}
        <main className="main-content premium-main-content">
          <div className="content-container">{children}</div>
        </main>

        {/* ══ Mobile bottom nav — 5 items ═══════════════════════════ */}
        <nav className="mobile-bottom-nav premium-bottom-nav">
          <div className="mobile-bottom-nav-card">

            {/* First 4 items */}
            {MOBILE_BOTTOM_NAV.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link mobile-nav-tone-${item.key}${isActive ? ' is-active' : ''}`}
                >
                  <span className="mobile-nav-icon-wrap">
                    <span className="mobile-nav-glow" />
                    <Glyph name={item.icon} size={20} />
                  </span>
                  <span className="mobile-nav-label">{item.shortLabel}</span>
                </Link>
              );
            })}

            {/* 5th item — More button */}
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              className={`mobile-nav-link${moreOpen ? ' is-active' : ''}`}
              aria-label="More options"
              aria-expanded={moreOpen}
            >
              <span className="mobile-nav-icon-wrap">
                <span className="mobile-nav-glow" />
                {moreOpen
                  ? <Glyph name="close" size={20} stroke={2} />
                  : <Glyph name="menu" size={20} />
                }
              </span>
              <span className="mobile-nav-label">और</span>
            </button>

          </div>
        </nav>
      </div>

      {/* ══ Overlays (unchanged) ═══════════════════════════════════ */}
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
