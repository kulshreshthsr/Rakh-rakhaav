'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const DEVANAGARI_RE = /[\u0900-\u097F]/;

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

function pickLocalizedSegment(text, locale) {
  const parts = text.split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return text;
  if (locale === 'hi') return parts.find(s => DEVANAGARI_RE.test(s)) || parts[0];
  return parts.find(s => !DEVANAGARI_RE.test(s)) || parts[parts.length - 1];
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
  const refreshSubscription = async () => {
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
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const id = window.setTimeout(refreshSubscription, 0);
    return () => window.clearTimeout(id);
  }, [router]);
  /* eslint-enable react-hooks/exhaustive-deps */

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

  /* ── Locale text walker ──────────────── */
  useEffect(() => {
    const root = document.querySelector('.app-shell-root');
    if (!root) return;

    const skip = (node) => {
      const p = node.parentElement;
      return !p || !!p.closest('script, style, svg, option') || p.hasAttribute('data-locale-ignore');
    };

    const apply = (node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue?.includes('/') || skip(node)) return;
      node.__rakhaavOriginalText ??= node.nodeValue;
      node.nodeValue = pickLocalizedSegment(node.__rakhaavOriginalText, locale);
    };

    const walk = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) apply(walker.currentNode);
    };

    walk(root);

    const observer = new MutationObserver(mutations =>
      mutations.forEach(m =>
        m.addedNodes.forEach(n => n.nodeType === Node.TEXT_NODE ? apply(n) : n.nodeType === Node.ELEMENT_NODE && walk(n))
      )
    );
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

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

      <style>{`
        /* ── Visibility ───────────────────── */
        .desktop-sidebar  { display: flex; }
        .mobile-topbar    { display: none; }
        .mobile-bottom-nav { display: none; }

        /* ── Sidebar shell ────────────────── */
        .premium-sidebar {
          width: 288px; padding: 18px 12px;
          position: fixed; left: 0; top: 0; bottom: 0; z-index: 50;
        }

        .sidebar-panel {
          height: 100%; border-radius: 30px; padding: 16px;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 14px;
          background:
            radial-gradient(circle at 100% 0%,   rgba(245,158,11,0.18), transparent 28%),
            radial-gradient(circle at 0%   100%,  rgba(6,182,212,0.12),  transparent 28%),
            radial-gradient(circle at 50%  12%,   rgba(91,80,255,0.14),  transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,247,255,0.94) 44%, rgba(248,250,255,0.98));
          border: 1px solid rgba(148,163,184,0.18);
          box-shadow: 0 36px 90px rgba(15,23,42,0.12);
        }

        .sidebar-panel::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.72), transparent 22%),
                      linear-gradient(180deg, transparent, rgba(255,255,255,0.18));
        }

        .sidebar-orb {
          position: absolute; border-radius: 999px;
          pointer-events: none; filter: blur(20px); opacity: 0.9;
        }
        .sidebar-orb-top    { width: 180px; height: 180px; top: -70px; right: -70px; background: rgba(59,130,246,0.18); }
        .sidebar-orb-bottom { width: 160px; height: 160px; bottom: -80px; left: -50px; background: rgba(16,185,129,0.14); }

        /* ── Brand ────────────────────────── */
        .brand-lockup, .sidebar-user-card, .sidebar-shortcut,
        .sidebar-logout { position: relative; z-index: 1; }

        .brand-row { display: flex; align-items: center; gap: 12px; }

        .brand-logo-frame, .brand-logo-fallback {
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(91,80,255,0.16), rgba(124,58,237,0.08));
          border: 1px solid rgba(91,80,255,0.18);
          box-shadow: 0 16px 30px rgba(91,80,255,0.12);
          overflow: hidden; color: #4f46e5; position: relative;
        }
        .brand-logo-frame::after, .brand-logo-fallback::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.28), transparent 34%);
          pointer-events: none;
        }

        .brand-title {
          font-size: 23px; line-height: 1; font-weight: 900;
          color: #4f46e5; letter-spacing: -0.06em;
        }
        .brand-subtitle {
          font-size: 10px; margin-top: 4px; color: #64748b;
          font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
        }

        .brand-status-card {
          margin-top: 14px; border-radius: 20px; padding: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,250,255,0.76));
          border: 1px solid rgba(15,23,42,0.15);
          box-shadow: 0 14px 28px rgba(15,23,42,0.06);
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }

        .brand-status-label { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.14em; text-transform: uppercase; }
        .brand-status-copy  { font-size: 12.5px; color: #0f172a; font-weight: 700; margin-top: 4px; }
        .brand-live-pill    { background: rgba(91,80,255,0.08) !important; color: #5b50ff !important; border-color: rgba(91,80,255,0.16) !important; white-space: nowrap; }

        /* ── Quick shortcuts ──────────────── */
        .sidebar-quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .sidebar-shortcut {
          text-decoration: none; color: #0f172a; padding: 14px; border-radius: 20px;
          display: flex; gap: 12px; align-items: flex-start;
          background: linear-gradient(135deg, rgba(91,80,255,0.12), rgba(56,189,248,0.08), rgba(255,255,255,0.56));
          border: 1px solid rgba(15,23,42,0.15);
          box-shadow: 0 18px 34px rgba(15,23,42,0.08);
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .sidebar-shortcut.is-secondary {
          background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(74,222,128,0.06), rgba(255,255,255,0.54));
          border-color: rgba(15,23,42,0.15);
        }
        .sidebar-shortcut:hover { transform: translateY(-3px); border-color: rgba(91,80,255,0.2); box-shadow: 0 24px 46px rgba(15,23,42,0.12); }

        .sidebar-shortcut-icon {
          width: 38px; height: 38px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.72); color: #0f172a; flex-shrink: 0;
        }
        .sidebar-shortcut-title { font-size: 13px; font-weight: 800; }
        .sidebar-shortcut-copy  { font-size: 11px; margin-top: 4px; color: #64748b; }

        /* ── User card ────────────────────── */
        .sidebar-section-label { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.14em; text-transform: uppercase; }

        .sidebar-user-card {
          width: 100%; border-radius: 20px;
          border: 1px solid rgba(15,23,42,0.15);
          background: linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,250,255,0.76));
          padding: 12px; display: flex; align-items: center; gap: 12px;
          color: #0f172a; text-align: left; cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 16px 34px rgba(15,23,42,0.08);
        }

        .sidebar-avatar, .mobile-avatar {
          width: 42px; height: 42px; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          background: #4f46e5; color: white; font-size: 15px; font-weight: 900;
          box-shadow: 0 16px 30px rgba(91,80,255,0.18); flex-shrink: 0;
        }

        .sidebar-user-copy { flex: 1; min-width: 0; }
        .sidebar-user-name, .sidebar-user-email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-user-name  { font-size: 13.5px; font-weight: 800; color: #0f172a; }
        .sidebar-user-email { font-size: 11px; color: #64748b; margin-top: 2px; }

        .sidebar-chevron      { color: #94a3b8; transition: transform 0.18s; }
        .sidebar-chevron.is-open { transform: rotate(180deg); }

        /* ── Dropdown menu ────────────────── */
        .sidebar-user-menu {
          position: absolute; top: calc(100% + 8px); left: 0; right: 0;
          border-radius: 18px; overflow: hidden;
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(148,163,184,0.16);
          box-shadow: 0 18px 40px rgba(15,23,42,0.12); z-index: 15;
        }
        .sidebar-user-menu button,
        .sidebar-user-menu a {
          width: 100%; padding: 13px 14px; background: transparent; border: none;
          color: #0f172a; display: flex; align-items: center; gap: 10px;
          text-decoration: none; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .sidebar-user-menu button + button,
        .sidebar-user-menu button + a,
        .sidebar-user-menu a + button,
        .sidebar-user-menu a + a { border-top: 1px solid #e2e8f0; }
        .sidebar-user-menu .danger { color: #dc2626; }

        /* ── Nav links ────────────────────── */
        .sidebar-nav { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; padding-right: 2px; }

        .nav-link {
          position: relative; display: flex; align-items: center; gap: 12px;
          padding: 12px; border-radius: 18px; color: #475569;
          text-decoration: none; overflow: hidden;
          border: 1px solid transparent;
          transition: background 0.18s, color 0.18s;
        }
        .nav-link-accent {
          position: absolute; left: 0; top: 10px; bottom: 10px; width: 4px;
          border-radius: 0 999px 999px 0;
          background: linear-gradient(180deg, #60a5fa, #34d399);
          opacity: 0; transform: scaleY(0.6); transition: all 0.22s;
        }
        .nav-link.is-active {
          color: #111; border-color: rgba(91,80,255,0.18);
          box-shadow: 0 12px 24px rgba(91,80,255,0.08);
        }
        .nav-link.is-active .nav-link-accent { opacity: 1; transform: scaleY(1); }
        .nav-link:hover { color: #0f172a; background: rgba(255,255,255,0.7); }

        .nav-icon-wrap {
          width: 40px; height: 40px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.72); flex-shrink: 0;
        }
        .nav-link.is-active .nav-icon-wrap { background: rgba(255,255,255,0.85); }

        .nav-copy   { display: flex; flex-direction: column; min-width: 0; }
        .nav-label  { font-size: 13.5px; font-weight: 800; }
        .nav-short  { font-size: 10.5px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.12em; }

        /* Tone: active backgrounds */
        .nav-tone-home.is-active     { background: linear-gradient(135deg, rgba(59,130,246,0.14),  rgba(14,165,233,0.08)); }
        .nav-tone-stock.is-active    { background: linear-gradient(135deg, rgba(37,99,235,0.12),   rgba(99,102,241,0.08)); }
        .nav-tone-sales.is-active    { background: linear-gradient(135deg, rgba(16,185,129,0.14),  rgba(52,211,153,0.08)); }
        .nav-tone-purchase.is-active { background: linear-gradient(135deg, rgba(245,158,11,0.16),  rgba(251,191,36,0.08)); }
        .nav-tone-credit.is-active   { background: linear-gradient(135deg, rgba(239,68,68,0.14),   rgba(251,113,133,0.08)); }
        .nav-tone-gst.is-active      { background: linear-gradient(135deg, rgba(20,184,166,0.16),  rgba(45,212,191,0.08)); }
        .nav-tone-reports.is-active  { background: linear-gradient(135deg, rgba(124,58,237,0.14),  rgba(167,139,250,0.08)); }

        /* Tone: accent bar colors */
        .nav-tone-home .nav-link-accent     { background: linear-gradient(180deg, #3b82f6, #0ea5e9); }
        .nav-tone-stock .nav-link-accent    { background: linear-gradient(180deg, #2563eb, #6366f1); }
        .nav-tone-sales .nav-link-accent    { background: linear-gradient(180deg, #10b981, #34d399); }
        .nav-tone-purchase .nav-link-accent { background: linear-gradient(180deg, #f59e0b, #fbbf24); }
        .nav-tone-credit .nav-link-accent   { background: linear-gradient(180deg, #ef4444, #fb7185); }
        .nav-tone-gst .nav-link-accent      { background: linear-gradient(180deg, #14b8a6, #2dd4bf); }
        .nav-tone-reports .nav-link-accent  { background: linear-gradient(180deg, #7c3aed, #a78bfa); }

        /* ── Logout button ────────────────── */
        .sidebar-logout {
          margin-top: 6px; width: 100%; display: flex; align-items: center;
          justify-content: center; gap: 8px; border-radius: 18px;
          border: 1px solid #d1d5db; background: #fff; color: #dc2626;
          padding: 12px 14px; font-weight: 800; cursor: pointer;
        }

        /* ── Mobile topbar ────────────────── */
        .premium-topbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 60; padding: 14px;
          display: none; align-items: center; justify-content: space-between; gap: 10px;
          background: #fff; border-bottom: 1px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.2s;
        }
        .premium-topbar.is-scrolled { box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

        .mobile-topbar-brand, .mobile-topbar-actions { display: flex; align-items: center; gap: 10px; }
        .mobile-topbar-brand { flex: 1; min-width: 0; }

        .mobile-brand-title {
          font-size: 20px; font-weight: 700; color: #4f46e5;
          line-height: 1; white-space: nowrap;
        }
        .mobile-brand-subtitle { display: none; }

        .mobile-user-chip {
          padding: 6px 10px 6px 6px; border-radius: 999px;
          border: 1px solid #e2e8f0; background: #fff; color: #0f172a;
          display: flex; align-items: center; gap: 8px; cursor: pointer;
          font-size: 13px; font-weight: 700;
        }
        .mobile-avatar { width: 32px !important; height: 32px !important; font-size: 12px; }

        .top-upgrade-chip {
          position: relative; overflow: hidden; padding: 9px 14px; border-radius: 20px;
          font-size: 11px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase;
          text-decoration: none; flex-shrink: 0; display: flex; align-items: center; gap: 6px;
          background: transparent; border: 1.5px solid #4f46e5; color: #4f46e5;
        }
        .top-upgrade-chip.is-shining::after {
          content: ''; position: absolute; top: 0; bottom: 0; left: -30%; width: 32%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent);
          transform: skewX(-18deg); animation: premiumShine 2.7s ease-in-out infinite;
        }

        .mobile-user-menu { left: auto; right: 0; width: 220px; }

        /* ── Main content ─────────────────── */
        .premium-main-content {
          margin-left: 288px; padding: 30px 26px 108px;
          min-height: 100vh; position: relative;
        }
        .content-container { max-width: 1440px; margin: 0 auto; position: relative; }
        .content-container::before {
          content: ''; position: fixed; top: 110px; right: 40px;
          width: 260px; height: 260px; border-radius: 999px;
          background: radial-gradient(circle, rgba(91,80,255,0.12), transparent 70%);
          pointer-events: none; filter: blur(12px); z-index: -1;
        }

        /* ── Mobile bottom nav ────────────── */
        .premium-bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: none; }
        .mobile-bottom-nav-card {
          display: flex; gap: 6px;
          padding: 6px 4px calc(8px + env(safe-area-inset-bottom));
          background: #fff; border-top: 1px solid rgba(0,0,0,0.08);
        }

        .mobile-nav-link {
          position: relative; flex: 1; min-width: 0; color: #94a3b8;
          text-decoration: none; display: flex; flex-direction: column;
          align-items: center; gap: 4px;
          padding: 10px 4px 12px; overflow: hidden;
          font-size: 10px; font-weight: 800; border: none;
        }
        .mobile-nav-glow { display: none; }
        .mobile-nav-link.is-active { color: #4f46e5; }
        .mobile-nav-link.is-active::before {
          content: ''; position: absolute; top: 0; left: 18%; right: 18%;
          height: 2px; background: #4f46e5; border-radius: 0 0 999px 999px;
        }
        .mobile-nav-link > * { position: relative; z-index: 1; }

        /* Mobile tone active colors (match sidebar) */
        .mobile-nav-tone-home.is-active,
        .mobile-nav-tone-stock.is-active,
        .mobile-nav-tone-sales.is-active,
        .mobile-nav-tone-purchase.is-active,
        .mobile-nav-tone-credit.is-active,
        .mobile-nav-tone-gst.is-active,
        .mobile-nav-tone-reports.is-active { color: #4f46e5; }

        /* ── App shell bg ─────────────────── */
        .app-shell-root { background: #f8fafc !important; }

        /* ── Responsive ───────────────────── */
        @media (max-width: 900px) {
          .desktop-sidebar   { display: none !important; }
          .mobile-topbar     { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .premium-main-content { margin-left: 0 !important; padding: 86px 14px 116px !important; }
        }

        /* ── Animation ────────────────────── */
        @keyframes premiumShine {
          0%   { transform: translateX(-160%) skewX(-18deg); }
          45%  { transform: translateX(420%)  skewX(-18deg); }
          100% { transform: translateX(420%)  skewX(-18deg); }
        }

        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}

export default function Layout({ children }) {
  return <LayoutInner>{children}</LayoutInner>;
}