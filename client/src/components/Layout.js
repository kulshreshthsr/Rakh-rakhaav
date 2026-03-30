'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UpgradeModal from './subscription/UpgradeModal';
import ReadOnlyOverlay from './subscription/ReadOnlyOverlay';
import SyncStatusBar from './SyncStatusBar';
import { API, FALLBACK_PLANS, hasTrialGateSeen, hasWelcomePending, readStoredSubscription, writeStoredSubscription } from '../lib/subscription';
import { useAppLocale } from './AppLocale';

const navItems = [
  { href: '/dashboard', key: 'dashboard', shortLabel: 'Home', tone: 'home' },
  { href: '/product', key: 'products', shortLabel: 'Stock', tone: 'stock' },
  { href: '/sales', key: 'sales', shortLabel: 'Sales', tone: 'sales' },
  { href: '/purchases', key: 'purchases', shortLabel: 'Buy', tone: 'purchase' },
  { href: '/udhaar', key: 'udhaar', shortLabel: 'Ledger', tone: 'credit' },
  { href: '/gst', key: 'gst', shortLabel: 'GST', tone: 'gst' },
  { href: '/reports', key: 'reports', shortLabel: 'Reports', tone: 'reports' },
];

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('user');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function Glyph({ name, size = 20, stroke = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13V10.5" /><path d="M9.5 20v-5h5v5" /></svg>;
    case 'products':
      return <svg {...common}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" /><path d="M12 12v9" /></svg>;
    case 'sales':
      return <svg {...common}><path d="M12 2v20" /><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></svg>;
    case 'purchases':
      return <svg {...common}><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" /></svg>;
    case 'udhaar':
      return <svg {...common}><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3" /><path d="M6 3.5v20" /><path d="M9 7.5h6" /><path d="M9 11.5h6" /><path d="M9 15.5h4" /></svg>;
    case 'gst':
      return <svg {...common}><path d="M7 4.5h10" /><path d="M7 9.5h10" /><path d="M7 14.5h5" /><path d="M16.5 13v7" /><path d="M13.5 16h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></svg>;
    case 'reports':
      return <svg {...common}><path d="M5 19.5V10.5" /><path d="M12 19.5V5.5" /><path d="M19 19.5V13.5" /><path d="M3.5 19.5h17" /></svg>;
    case 'profile':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case 'logout':
      return <svg {...common}><path d="M10 7V5.5A2.5 2.5 0 0 1 12.5 3H18a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21h-5.5A2.5 2.5 0 0 1 10 18.5V17" /><path d="M14 12H3.5" /><path d="m7.5 8-4 4 4 4" /></svg>;
    case 'pricing':
      return <svg {...common}><path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z" /></svg>;
    case 'language':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></svg>;
  }
}

function Logo({ size = 'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 34 : size === 'lg' ? 58 : 46;
  const radius = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;

  if (!err) {
    return (
      <div className="brand-logo-frame" style={{ width: dim, height: dim, borderRadius: radius }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Rakh-Rakhaav logo"
          width={dim}
          height={dim}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setErr(true)}
        />
      </div>
    );
  }

  return (
    <div className="brand-logo-fallback" style={{ width: dim, height: dim, borderRadius: radius }}>
      <span style={{ fontSize: size === 'sm' ? 14 : 20, fontWeight: 900 }}>R</span>
    </div>
  );
}

function pickLocalizedSegment(text, locale) {
  const segments = text
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) return text;

  const devanagari = /[\u0900-\u097F]/;
  if (locale === 'hi') {
    return segments.find((segment) => devanagari.test(segment)) || segments[0];
  }

  return segments.find((segment) => !devanagari.test(segment)) || segments[segments.length - 1];
}

function LayoutInner({ children }) {
  const { locale, t } = useAppLocale();
  const [user, setUser] = useState(() => readStoredUser());
  const [subscription, setSubscription] = useState(() => readStoredSubscription());
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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
    if (!token) {
      return false;
    }

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
      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      setSubscription(data.subscription || null);
      writeStoredSubscription(data.subscription || null);
      setPlans(data.plans?.length ? data.plans : FALLBACK_PLANS);
      setRazorpayKeyId(data.razorpayKeyId || '');
      return true;
    } catch {
      return false;
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      refreshSubscriptionStatus();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (mobileDropRef.current && !mobileDropRef.current.contains(event.target)) {
        setMobileDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!pathname || pathname === '/pricing' || pathname === '/welcome' || pathname === '/trial-status') {
      return;
    }

    if (hasWelcomePending()) {
      router.replace('/welcome');
      return;
    }

    if (!subscription) {
      return;
    }

    if (!subscription?.isPro && !hasTrialGateSeen()) {
      router.replace('/trial-status');
    }
  }, [pathname, router, subscription]);

  useEffect(() => {
    const root = document.querySelector('.app-shell-root');
    if (!root) return undefined;

    const shouldSkip = (node) => {
      const parent = node.parentElement;
      if (!parent) return true;
      if (parent.closest('script, style, svg, option')) return true;
      if (parent.hasAttribute('data-locale-ignore')) return true;
      return false;
    };

    const applyLocaleToNode = (node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const value = node.nodeValue;
      if (!value || !value.includes('/')) return;
      if (shouldSkip(node)) return;

      const original = node.__rakhaavOriginalText || value;
      node.__rakhaavOriginalText = original;
      node.nodeValue = pickLocalizedSegment(original, locale);
    };

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      applyLocaleToNode(walker.currentNode);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((addedNode) => {
          if (addedNode.nodeType === Node.TEXT_NODE) {
            applyLocaleToNode(addedNode);
            return;
          }

          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            const childWalker = document.createTreeWalker(addedNode, NodeFilter.SHOW_TEXT);
            while (childWalker.nextNode()) {
              applyLocaleToNode(childWalker.currentNode);
            }
          }
        });
      });
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

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
    writeStoredSubscription(nextSubscription || null);
    setShowUpgradeModal(false);
    await refreshSubscriptionStatus();
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';
  const firstName = user?.name?.split(' ')?.[0] || 'Profile';
  const translatedNav = useMemo(
    () =>
      navItems.map((item) => ({
        ...item,
        label: t(item.key),
      })),
    [t]
  );

  const upgradeButtonLabel = subscription?.isPro ? 'Manage Plan' : 'Upgrade';
  return (
    <div className="app-shell-root">
      <div className={subscription?.isReadOnly ? 'shell-readonly-content' : ''}>
        <aside className="desktop-sidebar premium-sidebar">
          <div className="sidebar-panel">
            <div className="sidebar-orb sidebar-orb-top" />
            <div className="sidebar-orb sidebar-orb-bottom" />

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

            <div className="sidebar-quick-grid">
              <a href="/pricing" className="sidebar-shortcut">
                <div className="sidebar-shortcut-icon">
                  <Glyph name="pricing" size={18} />
                </div>
                <div>
                  <div className="sidebar-shortcut-title">{t('pricing')}</div>
                  <div className="sidebar-shortcut-copy">{t('plans')}</div>
                </div>
              </a>
              <a href="/reports" className="sidebar-shortcut is-secondary">
                <div className="sidebar-shortcut-icon">
                  <Glyph name="reports" size={18} />
                </div>
                <div>
                  <div className="sidebar-shortcut-title">{t('reports')}</div>
                  <div className="sidebar-shortcut-copy">{t('reportsShortcut')}</div>
                </div>
              </a>
            </div>

            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button type="button" className="sidebar-user-card" onClick={() => setDropdownOpen((value) => !value)}>
                <div className="sidebar-avatar">{initial}</div>
                <div className="sidebar-user-copy">
                  <div className="sidebar-user-name">{user?.name || 'Shopkeeper'}</div>
                  <div className="sidebar-user-email">{user?.email || 'Business account'}</div>
                </div>
                <div className={`sidebar-chevron ${dropdownOpen ? 'is-open' : ''}`}>⌄</div>
              </button>

              {dropdownOpen && (
                <div className="sidebar-user-menu">
                  <button type="button" onClick={goToProfile}>
                    <Glyph name="profile" size={16} />
                    Profile
                  </button>
                  <button type="button" onClick={logout} className="danger">
                    <Glyph name="logout" size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>

            <div className="sidebar-section-label">{t('mainMenu')}</div>

            <nav className="sidebar-nav">
              {translatedNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <a key={item.href} href={item.href} className={`nav-link nav-tone-${item.tone} ${active ? 'is-active' : ''}`}>
                    <span className="nav-link-accent" />
                    <span className="nav-icon-wrap">
                      <Glyph name={item.key} size={18} />
                    </span>
                    <span className="nav-copy">
                      <span className="nav-label">{item.label}</span>
                      <span className="nav-short">{item.shortLabel}</span>
                    </span>
                  </a>
                );
              })}
            </nav>

            <button type="button" onClick={logout} className="sidebar-logout">
              <Glyph name="logout" size={16} />
              Logout
            </button>
          </div>
        </aside>

        <div className={`mobile-topbar premium-topbar ${scrolled ? 'is-scrolled' : ''}`}>
          <div className="mobile-topbar-brand">
            <div>
              <div className="mobile-brand-title brand-title-hindi">रखरखाव</div>
              <div className="mobile-brand-subtitle">आपके व्यापार का भरोसेमंद साथी</div>
            </div>
          </div>

          <div className="mobile-topbar-actions">
            <div ref={mobileDropRef} style={{ position: 'relative' }}>
              <button type="button" className="mobile-user-chip" onClick={() => setMobileDropOpen((value) => !value)}>
                <div className="mobile-avatar">{initial}</div>
                <span>{firstName}</span>
              </button>
              {mobileDropOpen && (
                <div className="sidebar-user-menu mobile-user-menu">
                  <button type="button" onClick={goToProfile}>
                    <Glyph name="profile" size={16} />
                    Profile
                  </button>
                  <a href="/reports">
                    <Glyph name="reports" size={16} />
                    Reports
                  </a>
                  <a href="/pricing">
                    <Glyph name="pricing" size={16} />
                    Pricing
                  </a>
                  <button type="button" onClick={logout} className="danger">
                    <Glyph name="logout" size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
            <a href="/pricing" className={`top-upgrade-chip ${subscription?.isPro ? 'is-manage' : 'is-shining'}`}>
              <Glyph name="pricing" size={14} />
              {upgradeButtonLabel}
            </a>
          </div>
        </div>

        <SyncStatusBar />
        <main className="main-content premium-main-content">
          <div className="content-container">
            {children}
          </div>
        </main>

        <nav className="mobile-bottom-nav premium-bottom-nav">
          <div className="mobile-bottom-nav-card">
            {translatedNav.map((item) => {
              const active = pathname === item.href;
              return (
                <a key={item.href} href={item.href} className={`mobile-nav-link mobile-nav-tone-${item.tone} ${active ? 'is-active' : ''}`}>
                  <span className="mobile-nav-glow" />
                  <Glyph name={item.key} size={18} />
                  <span>{item.shortLabel}</span>
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
        onLogout={logout}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        plans={plans}
        subscription={subscription}
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
        .desktop-sidebar { display: flex; }
        .mobile-topbar { display: none; }
        .mobile-bottom-nav { display: none; }

        .premium-sidebar {
          width: 288px;
          padding: 18px 12px;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 50;
        }

        .sidebar-panel {
          height: 100%;
          border-radius: 30px;
          padding: 16px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background:
            radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.12), transparent 28%),
            radial-gradient(circle at 0% 100%, rgba(45, 212, 191, 0.1), transparent 28%),
            radial-gradient(circle at 50% 12%, rgba(91, 80, 255, 0.12), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,255,0.88));
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 24px 50px rgba(15, 23, 42, 0.09);
        }

        .sidebar-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 22%),
            linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.02));
          pointer-events: none;
        }

        .sidebar-orb {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(20px);
          opacity: 0.9;
        }

        .sidebar-orb-top {
          width: 180px;
          height: 180px;
          top: -70px;
          right: -70px;
          background: rgba(59, 130, 246, 0.18);
        }

        .sidebar-orb-bottom {
          width: 160px;
          height: 160px;
          bottom: -80px;
          left: -50px;
          background: rgba(16, 185, 129, 0.14);
        }

        .brand-lockup,
        .language-switch-card,
        .sidebar-user-card,
        .sidebar-shortcut,
        .sidebar-logout {
          position: relative;
          z-index: 1;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo-frame,
        .brand-logo-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(91,80,255,0.16), rgba(124,58,237,0.08));
          border: 1px solid rgba(91,80,255,0.18);
          box-shadow: 0 16px 30px rgba(91, 80, 255, 0.12);
          overflow: hidden;
          color: #4f46e5;
          position: relative;
        }

        .brand-logo-frame::after,
        .brand-logo-fallback::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.28), transparent 34%);
          pointer-events: none;
        }

        .brand-title {
          font-size: 23px;
          line-height: 1;
          font-weight: 900;
          color: #5b50ff;
          letter-spacing: -0.06em;
          text-shadow: none;
        }

        .brand-subtitle {
          font-size: 10px;
          margin-top: 4px;
          color: #64748b;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .brand-status-card,
        .language-switch-card {
          margin-top: 14px;
          border-radius: 20px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,250,255,0.76));
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .brand-status-label,
        .sidebar-section-label,
        .language-title {
          font-size: 10px;
          font-weight: 700;
          color: rgba(226, 232, 240, 0.42);
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .brand-status-copy,
        .language-subtitle {
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.84);
          font-weight: 700;
          margin-top: 4px;
        }

        .brand-live-pill {
          white-space: nowrap;
          background: rgba(37, 99, 235, 0.14) !important;
          color: #bfdbfe !important;
          border-color: rgba(147, 197, 253, 0.16) !important;
        }

        .sidebar-quick-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .sidebar-shortcut {
          text-decoration: none;
          color: #0f172a;
          padding: 14px;
          border-radius: 20px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: linear-gradient(135deg, rgba(91,80,255,0.12), rgba(56,189,248,0.08), rgba(255,255,255,0.56));
          border: 1px solid rgba(148,163,184,0.16);
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
          transform: translateY(0);
        }

        .sidebar-shortcut.is-secondary {
          background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(74,222,128,0.06), rgba(255,255,255,0.54));
          border-color: rgba(16,185,129,0.14);
        }

        .sidebar-shortcut:hover {
          transform: translateY(-3px);
          border-color: rgba(91,80,255,0.2);
          box-shadow: 0 24px 46px rgba(15, 23, 42, 0.12);
        }

        .sidebar-shortcut-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(91,80,255,0.1);
          color: #5b50ff;
          flex-shrink: 0;
        }

        .sidebar-shortcut-title {
          font-size: 13px;
          font-weight: 800;
        }

        .sidebar-shortcut-copy {
          font-size: 11px;
          margin-top: 4px;
          color: #64748b;
        }

        .language-toggle {
          min-width: 96px;
        }

        .language-toggle .segmented-option {
          min-height: 40px;
          color: rgba(226, 232, 240, 0.72);
        }

        .language-toggle .segmented-option.is-active {
          color: white;
          background: linear-gradient(135deg, rgba(37,99,235,0.22), rgba(16,185,129,0.18));
          border-color: rgba(125, 211, 252, 0.22);
        }

        .sidebar-user-card {
          width: 100%;
          border-radius: 20px;
          border: 1px solid rgba(148,163,184,0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(248,250,255,0.72));
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 16px 34px rgba(15, 23, 42, 0.08);
        }

        .sidebar-avatar,
        .mobile-avatar {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #5b50ff, #14b8a6);
          color: white;
          font-size: 15px;
          font-weight: 900;
          box-shadow: 0 16px 30px rgba(91, 80, 255, 0.18);
          flex-shrink: 0;
        }

        .sidebar-user-copy {
          flex: 1;
          min-width: 0;
        }

        .sidebar-user-name,
        .sidebar-user-email {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-user-name {
          font-size: 13.5px;
          font-weight: 800;
        }

        .sidebar-user-email {
          font-size: 11px;
          color: rgba(226, 232, 240, 0.5);
          margin-top: 2px;
        }

        .sidebar-chevron {
          color: rgba(191, 219, 254, 0.7);
          transition: transform 0.18s ease;
        }

        .sidebar-chevron.is-open {
          transform: rotate(180deg);
        }

        .sidebar-user-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(14,26,51,0.99), rgba(8,16,34,0.99));
          border: 1px solid rgba(148,163,184,0.12);
          box-shadow: 0 24px 48px rgba(2, 8, 23, 0.34);
          z-index: 15;
        }

        .sidebar-user-menu button,
        .sidebar-user-menu a {
          width: 100%;
          padding: 13px 14px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.86);
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .sidebar-user-menu button + button,
        .sidebar-user-menu button + a,
        .sidebar-user-menu a + button,
        .sidebar-user-menu a + a {
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .sidebar-user-menu .danger {
          color: #fecaca;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          overflow-y: auto;
          padding-right: 2px;
        }

        .nav-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 18px;
          color: rgba(226,232,240,0.68);
          text-decoration: none;
          overflow: hidden;
          border: 1px solid transparent;
          background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
        }

        .nav-link-accent {
          position: absolute;
          left: 0;
          top: 10px;
          bottom: 10px;
          width: 4px;
          border-radius: 0 999px 999px 0;
          background: linear-gradient(180deg, #60a5fa, #34d399);
          opacity: 0;
          transform: scaleY(0.6);
          transition: all 0.22s ease;
        }

        .nav-link.is-active {
          color: white;
          background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(20,184,166,0.16), rgba(255,255,255,0.03));
          border-color: rgba(147,197,253,0.16);
          box-shadow: 0 18px 34px rgba(2,8,23,0.24);
        }

        .nav-link.is-active .nav-link-accent {
          opacity: 1;
          transform: scaleY(1);
        }

        .nav-link:hover {
          color: white;
          background: linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
        }

        .nav-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          flex-shrink: 0;
        }

        .nav-link.is-active .nav-icon-wrap {
          background: rgba(255,255,255,0.1);
        }

        .nav-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .nav-label {
          font-size: 13.5px;
          font-weight: 800;
        }

        .nav-short {
          font-size: 10.5px;
          color: rgba(226,232,240,0.44);
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .sidebar-logout {
          margin-top: 6px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 18px;
          border: 1px solid rgba(248,113,113,0.16);
          background: linear-gradient(180deg, rgba(127,29,29,0.22), rgba(127,29,29,0.12));
          color: #fecaca;
          padding: 12px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .premium-topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          padding: 14px;
          display: none;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(148,163,184,0.16);
        }

        .premium-topbar.is-scrolled {
          background: rgba(255,255,255,0.88);
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
        }

        .mobile-topbar-brand,
        .mobile-topbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mobile-topbar-actions {
          gap: 8px;
        }

        .mobile-brand-title {
          font-size: 17px;
          font-weight: 900;
          color: #4f46e5;
          line-height: 1;
        }

        .mobile-brand-subtitle {
          font-size: 10px;
          color: #64748b;
          margin-top: 4px;
        }

        .mobile-user-chip,
        .language-compact,
        .top-upgrade-chip {
          border: 1px solid rgba(148,163,184,0.18);
          background: rgba(255,255,255,0.8);
          color: #0f172a;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: none;
        }

        .mobile-user-chip {
          padding: 6px 10px 6px 6px;
        }

        .language-compact {
          padding: 9px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .top-upgrade-chip {
          position: relative;
          overflow: hidden;
          padding: 9px 14px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          flex-shrink: 0;
          box-shadow: none;
          background: transparent;
          border-color: rgba(91,80,255,0.28);
          color: #5b50ff;
        }

        .top-upgrade-chip.is-manage {
          background: transparent;
          box-shadow: none;
        }

        .top-upgrade-chip.is-shining::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: -30%;
          width: 32%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent);
          transform: skewX(-18deg);
          animation: premiumShine 2.7s ease-in-out infinite;
        }

        .mobile-avatar {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          font-size: 12px;
        }

        .mobile-user-menu {
          left: auto;
          right: 0;
          width: 220px;
        }

        .premium-main-content {
          margin-left: 288px;
          padding: 30px 26px 108px;
          min-height: 100vh;
          position: relative;
        }

        .content-container {
          max-width: 1440px;
          margin: 0 auto;
          position: relative;
        }

        .content-container::before {
          content: '';
          position: fixed;
          top: 110px;
          right: 40px;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(91,80,255,0.12), transparent 70%);
          pointer-events: none;
          filter: blur(12px);
          z-index: -1;
        }

        .content-top-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 18px;
          padding: 14px 16px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(248,250,255,0.64));
          border: 1px solid rgba(148,163,184,0.16);
          box-shadow: 0 14px 30px rgba(15,23,42,0.06);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .content-top-actions-kicker {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #64748b;
        }

        .content-top-actions-subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: #64748b;
        }

        .desktop-upgrade-chip {
          width: auto;
        }

        .premium-trial-banner {
          border: 1px solid rgba(29, 78, 216, 0.16);
          background: linear-gradient(135deg, rgba(8,32,50,0.08), rgba(13,148,136,0.08));
        }

        .membership-spotlight-banner {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
          gap: 18px;
          padding: 22px;
          margin: 0 0 18px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 30px 70px rgba(7, 17, 31, 0.12);
          overflow: hidden;
          position: relative;
          background:
            radial-gradient(circle at top right, rgba(245,158,11,0.2), transparent 28%),
            radial-gradient(circle at 0% 100%, rgba(45,212,191,0.14), transparent 30%),
            linear-gradient(135deg, rgba(7,17,31,0.99), rgba(12,28,49,0.97), rgba(15,118,110,0.9));
        }

        .membership-spotlight-banner.accent-expired {
          background:
            radial-gradient(circle at top right, rgba(248,113,113,0.22), transparent 28%),
            linear-gradient(135deg, rgba(69,10,10,0.98), rgba(15,23,42,0.96));
        }

        .membership-spotlight-banner.accent-active {
          background:
            radial-gradient(circle at top right, rgba(52,211,153,0.18), transparent 28%),
            linear-gradient(135deg, rgba(3,105,84,0.98), rgba(15,23,42,0.96));
        }

        .membership-spotlight-copy h2 {
          color: white;
          margin: 14px 0 0;
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.06em;
        }

        .membership-spotlight-copy p {
          color: rgba(226,232,240,0.82);
          margin-top: 12px;
          max-width: 720px;
          line-height: 1.65;
        }

        .membership-spotlight-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .membership-spotlight-pills span {
          padding: 10px 12px;
          border-radius: 999px;
          color: white;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 11.5px;
          font-weight: 700;
        }

        .membership-spotlight-side {
          border-radius: 24px;
          padding: 16px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
        }

        .membership-spotlight-planrow {
          display: grid;
          gap: 10px;
        }

        .membership-mini-plan {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.06);
          color: white;
          text-align: left;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .membership-mini-plan strong,
        .membership-mini-plan span {
          display: block;
        }

        .membership-mini-plan strong {
          font-size: 13px;
        }

        .membership-mini-plan span {
          font-size: 12px;
          color: rgba(226,232,240,0.76);
          font-weight: 700;
        }

        .membership-mini-plan.is-selected {
          background: rgba(255,255,255,0.16);
          border-color: rgba(191,219,254,0.4);
          box-shadow: 0 16px 34px rgba(2, 8, 23, 0.18);
        }

        .membership-spotlight-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .premium-bottom-nav {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 10px;
          z-index: 60;
          display: none;
        }

        .mobile-bottom-nav-card {
          display: flex;
          gap: 6px;
          padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
          border-radius: 26px;
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(148,163,184,0.18);
          box-shadow: 0 18px 34px rgba(15,23,42,0.1);
          backdrop-filter: blur(18px);
        }

        .mobile-nav-link {
          position: relative;
          flex: 1;
          min-width: 0;
          color: #64748b;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding: 10px 4px;
          border-radius: 18px;
          overflow: hidden;
          font-size: 10px;
          font-weight: 800;
          border: 1px solid transparent;
        }

        .mobile-nav-glow {
          position: absolute;
          inset: 0;
          opacity: 0;
          background: linear-gradient(180deg, rgba(91,80,255,0.18), rgba(20,184,166,0.08));
          transition: opacity 0.2s ease;
        }

        .mobile-nav-link.is-active {
          color: #5b50ff;
          transform: translateY(-1px);
          border-color: rgba(91,80,255,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);
        }

        .mobile-nav-link.is-active .mobile-nav-glow {
          opacity: 1;
        }

        .mobile-nav-link > * {
          position: relative;
          z-index: 1;
        }

        .app-shell-root {
          background:
            radial-gradient(circle at top right, rgba(91, 80, 255, 0.12), transparent 24%),
            radial-gradient(circle at bottom left, rgba(6, 182, 212, 0.09), transparent 24%),
            radial-gradient(circle at 15% 20%, rgba(16, 185, 129, 0.08), transparent 18%),
            linear-gradient(180deg, #f8f9ff 0%, #f3f6fd 100%);
        }

        .app-shell-root .sidebar-panel {
          background:
            radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.18), transparent 28%),
            radial-gradient(circle at 0% 100%, rgba(6, 182, 212, 0.12), transparent 28%),
            radial-gradient(circle at 50% 12%, rgba(91, 80, 255, 0.14), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,247,255,0.94) 44%, rgba(248,250,255,0.98));
          border: 1px solid rgba(148,163,184,0.18);
          box-shadow: 0 36px 90px rgba(15, 23, 42, 0.12);
        }

        .app-shell-root .sidebar-panel::before {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.72), transparent 22%),
            linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.18));
        }

        .app-shell-root .brand-title,
        .app-shell-root .mobile-brand-title {
          color: #0f172a;
          text-shadow: 0 10px 26px rgba(91, 80, 255, 0.1);
        }

        .app-shell-root .brand-subtitle,
        .app-shell-root .mobile-brand-subtitle,
        .app-shell-root .brand-status-label,
        .app-shell-root .sidebar-section-label,
        .app-shell-root .language-title,
        .app-shell-root .sidebar-shortcut-copy,
        .app-shell-root .sidebar-user-email,
        .app-shell-root .nav-short,
        .app-shell-root .content-top-actions-kicker,
        .app-shell-root .content-top-actions-subtitle {
          color: #475569;
        }

        .app-shell-root .brand-status-copy,
        .app-shell-root .language-subtitle,
        .app-shell-root .sidebar-shortcut-title,
        .app-shell-root .sidebar-user-name,
        .app-shell-root .nav-link,
        .app-shell-root .sidebar-user-menu button,
        .app-shell-root .sidebar-user-menu a,
        .app-shell-root .mobile-user-chip,
        .app-shell-root .language-compact {
          color: #0f172a;
        }

        .app-shell-root .brand-status-card,
        .app-shell-root .language-switch-card,
        .app-shell-root .sidebar-user-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,250,255,0.76));
          border: 1px solid rgba(15,23,42,0.15);
          box-shadow: 0 14px 28px rgba(15,23,42,0.06);
        }

        .app-shell-root .brand-live-pill {
          background: rgba(91,80,255,0.08) !important;
          color: #5b50ff !important;
          border-color: rgba(91,80,255,0.16) !important;
        }

        .app-shell-root .sidebar-shortcut {
          color: #0f172a;
          background: linear-gradient(135deg, rgba(91,80,255,0.12), rgba(56,189,248,0.08), rgba(255,255,255,0.56));
          border: 1px solid rgba(15,23,42,0.15);
          box-shadow: 0 18px 34px rgba(15,23,42,0.08);
        }

        .app-shell-root .sidebar-shortcut.is-secondary {
          background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(74,222,128,0.06), rgba(255,255,255,0.54));
          border-color: rgba(15,23,42,0.15);
        }

        .app-shell-root .sidebar-shortcut-icon,
        .app-shell-root .nav-icon-wrap,
        .app-shell-root .language-toggle .segmented-option,
        .app-shell-root .mobile-user-chip,
        .app-shell-root .language-compact {
          background: rgba(255,255,255,0.72);
          border-color: rgba(148,163,184,0.18);
          color: #0f172a;
        }

        .app-shell-root .language-toggle .segmented-option.is-active,
        .app-shell-root .nav-link.is-active {
          color: #111111;
          border-color: rgba(91,80,255,0.18);
          box-shadow: 0 12px 24px rgba(91,80,255,0.08);
        }

        .app-shell-root .nav-tone-home.is-active,
        .app-shell-root .mobile-nav-tone-home.is-active {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.08));
        }

        .app-shell-root .nav-tone-stock.is-active,
        .app-shell-root .mobile-nav-tone-stock.is-active {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(99, 102, 241, 0.08));
        }

        .app-shell-root .nav-tone-sales.is-active,
        .app-shell-root .mobile-nav-tone-sales.is-active {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(52, 211, 153, 0.08));
        }

        .app-shell-root .nav-tone-purchase.is-active,
        .app-shell-root .mobile-nav-tone-purchase.is-active {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(251, 191, 36, 0.08));
        }

        .app-shell-root .nav-tone-credit.is-active,
        .app-shell-root .mobile-nav-tone-credit.is-active {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(251, 113, 133, 0.08));
        }

        .app-shell-root .nav-tone-gst.is-active,
        .app-shell-root .mobile-nav-tone-gst.is-active {
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.16), rgba(45, 212, 191, 0.08));
        }

        .app-shell-root .nav-tone-reports.is-active,
        .app-shell-root .mobile-nav-tone-reports.is-active {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(167, 139, 250, 0.08));
        }

        .app-shell-root .nav-tone-home .nav-link-accent {
          background: linear-gradient(180deg, #3b82f6, #0ea5e9);
        }

        .app-shell-root .nav-tone-stock .nav-link-accent {
          background: linear-gradient(180deg, #2563eb, #6366f1);
        }

        .app-shell-root .nav-tone-sales .nav-link-accent {
          background: linear-gradient(180deg, #10b981, #34d399);
        }

        .app-shell-root .nav-tone-purchase .nav-link-accent {
          background: linear-gradient(180deg, #f59e0b, #fbbf24);
        }

        .app-shell-root .nav-tone-credit .nav-link-accent {
          background: linear-gradient(180deg, #ef4444, #fb7185);
        }

        .app-shell-root .nav-tone-gst .nav-link-accent {
          background: linear-gradient(180deg, #14b8a6, #2dd4bf);
        }

        .app-shell-root .nav-tone-reports .nav-link-accent {
          background: linear-gradient(180deg, #7c3aed, #a78bfa);
        }

        .app-shell-root .nav-link:hover {
          color: #0f172a;
          background: rgba(255,255,255,0.7);
        }

        .app-shell-root .sidebar-user-menu {
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(148,163,184,0.16);
          box-shadow: 0 18px 40px rgba(15,23,42,0.12);
        }

        .app-shell-root .sidebar-user-menu button + button,
        .app-shell-root .sidebar-user-menu button + a,
        .app-shell-root .sidebar-user-menu a + button,
        .app-shell-root .sidebar-user-menu a + a {
          border-top: 1px solid #e2e8f0;
        }

        .app-shell-root .sidebar-user-menu .danger,
        .app-shell-root .sidebar-logout {
          color: #dc2626;
        }

        .app-shell-root .sidebar-logout {
          border-color: #d1d5db;
          background: #ffffff;
        }

        .app-shell-root .premium-topbar {
          background: rgba(255,255,255,0.78);
          border-bottom: 1px solid rgba(148,163,184,0.16);
        }

        .app-shell-root .premium-topbar.is-scrolled {
          background: rgba(255,255,255,0.88);
          box-shadow: 0 14px 32px rgba(15,23,42,0.08);
        }

        .app-shell-root .top-upgrade-chip {
          box-shadow: 0 10px 20px rgba(91,80,255,0.08);
          background: rgba(255,255,255,0.82);
          border-color: rgba(91,80,255,0.18);
          color: #5b50ff;
        }

        .app-shell-root .top-upgrade-chip.is-manage {
          background: rgba(255,255,255,0.82);
          border-color: rgba(91,80,255,0.18);
          box-shadow: 0 10px 20px rgba(91,80,255,0.08);
          color: #5b50ff;
        }

        .app-shell-root .premium-trial-banner {
          border: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .app-shell-root .membership-spotlight-banner {
          border: 1px solid #e5e7eb;
          box-shadow: none;
          background: #ffffff;
        }

        .app-shell-root .membership-spotlight-banner.accent-expired {
          background: #ffffff;
        }

        .app-shell-root .membership-spotlight-banner.accent-active {
          background: #ffffff;
        }

        .app-shell-root .membership-spotlight-copy h2,
        .app-shell-root .membership-mini-plan,
        .app-shell-root .membership-spotlight-pills span {
          color: #0f172a;
        }

        .app-shell-root .membership-spotlight-copy p,
        .app-shell-root .membership-mini-plan span {
          color: #475569;
        }

        .app-shell-root .membership-spotlight-pills span,
        .app-shell-root .membership-spotlight-side,
        .app-shell-root .membership-mini-plan,
        .app-shell-root .mobile-bottom-nav-card {
          background: #ffffff;
          border-color: rgba(15,23,42,0.15);
          box-shadow: none;
        }

        .app-shell-root .mobile-nav-link {
          color: #475569;
        }

        .app-shell-root .mobile-nav-link.is-active {
          color: #111111;
          border-color: #d1d5db;
          box-shadow: none;
          background: #ffffff;
        }

        .app-shell-root .premium-topbar {
          background: #ffffff !important;
          border-bottom: 1px solid #e2e8f0 !important;
          box-shadow: none !important;
        }

        .app-shell-root .premium-topbar.is-scrolled {
          background: #ffffff !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
        }

        .app-shell-root .mobile-topbar-brand {
          flex: 1;
          min-width: 0;
          align-items: center;
        }

        .app-shell-root .mobile-topbar-brand > div {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .app-shell-root .brand-title.brand-title-hindi,
        .app-shell-root .mobile-brand-title.brand-title-hindi,
        .app-shell-root .mobile-brand-title,
        .app-shell-root .brand-title {
          color: #4f46e5 !important;
          text-shadow: none !important;
        }

        .app-shell-root .mobile-brand-title.brand-title-hindi {
          font-size: 22px !important;
          line-height: 1 !important;
          white-space: nowrap;
        }

        .app-shell-root .brand-subtitle,
        .app-shell-root .mobile-brand-subtitle {
          color: #64748b !important;
        }

        .app-shell-root .mobile-brand-subtitle {
          display: none !important;
        }

        .app-shell-root .mobile-user-chip,
        .app-shell-root .top-upgrade-chip {
          color: #0f172a !important;
        }

        .app-shell-root {
          background: #f8fafc !important;
        }

        .app-shell-root .premium-topbar,
        .app-shell-root .premium-topbar.is-scrolled {
          background: #ffffff !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
          box-shadow: none !important;
        }

        .app-shell-root .mobile-brand-title,
        .app-shell-root .brand-title,
        .app-shell-root .brand-title.brand-title-hindi,
        .app-shell-root .mobile-brand-title.brand-title-hindi {
          color: #4f46e5 !important;
          text-shadow: none !important;
        }

        .app-shell-root .mobile-user-chip,
        .app-shell-root .sidebar-user-name,
        .app-shell-root .nav-label {
          color: #0f172a !important;
          text-shadow: none !important;
        }

        .app-shell-root .brand-subtitle,
        .app-shell-root .mobile-brand-subtitle,
        .app-shell-root .sidebar-user-email,
        .app-shell-root .nav-short {
          color: #64748b !important;
        }

        .app-shell-root .mobile-avatar,
        .app-shell-root .sidebar-avatar {
          background: #4f46e5 !important;
          color: #ffffff !important;
          border-radius: 999px !important;
        }

        .app-shell-root .mobile-avatar {
          width: 32px !important;
          height: 32px !important;
        }

        .app-shell-root .brand-title.brand-title-hindi,
        .app-shell-root .mobile-brand-title.brand-title-hindi {
          font-size: 20px !important;
          font-weight: 700 !important;
        }

        .app-shell-root .top-upgrade-chip,
        .app-shell-root .top-upgrade-chip.is-manage {
          background: transparent !important;
          border: 1.5px solid #4f46e5 !important;
          color: #4f46e5 !important;
          border-radius: 20px !important;
          box-shadow: none !important;
        }

        .app-shell-root .top-upgrade-chip.is-shining::after {
          display: none !important;
        }

        .app-shell-root .mobile-user-chip {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          color: #0f172a !important;
        }

        .app-shell-root .mobile-bottom-nav-card {
          background: #ffffff !important;
          border: none !important;
          border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 6px 4px calc(8px + env(safe-area-inset-bottom)) !important;
        }

        .app-shell-root .premium-bottom-nav {
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
        }

        .app-shell-root .mobile-nav-link {
          color: #94a3b8 !important;
          border-radius: 0 !important;
          border: none !important;
          padding: 10px 4px 12px !important;
          gap: 4px !important;
        }

        .app-shell-root .mobile-nav-glow {
          display: none !important;
        }

        .app-shell-root .mobile-nav-link.is-active {
          color: #4f46e5 !important;
          background: transparent !important;
          box-shadow: none !important;
          transform: none !important;
        }

        .app-shell-root .mobile-nav-link.is-active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 18%;
          right: 18%;
          height: 2px;
          background: #4f46e5;
          border-radius: 0 0 999px 999px;
        }

        @media (max-width: 900px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: block !important; }
          .premium-main-content {
            margin-left: 0 !important;
            padding: 86px 14px 116px !important;
          }
          .content-top-actions {
            display: none;
          }
        }

        @keyframes premiumShine {
          0% { transform: translateX(-160%) skewX(-18deg); }
          45% { transform: translateX(420%) skewX(-18deg); }
          100% { transform: translateX(420%) skewX(-18deg); }
        }

        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}

export default function Layout({ children }) {
  return <LayoutInner>{children}</LayoutInner>;
}


