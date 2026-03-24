'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UpgradeModal from './subscription/UpgradeModal';
import ReadOnlyOverlay from './subscription/ReadOnlyOverlay';
import { API, FALLBACK_PLANS, hasTrialGateSeen, hasWelcomePending, readStoredSubscription, writeStoredSubscription } from '../lib/subscription';
import { useAppLocale } from './AppLocale';

const navItems = [
  { href: '/dashboard', key: 'dashboard', shortLabel: 'Home' },
  { href: '/product', key: 'products', shortLabel: 'Stock' },
  { href: '/sales', key: 'sales', shortLabel: 'Sales' },
  { href: '/purchases', key: 'purchases', shortLabel: 'Buy' },
  { href: '/udhaar', key: 'udhaar', shortLabel: 'Ledger' },
  { href: '/gst', key: 'gst', shortLabel: 'GST' },
  { href: '/reports', key: 'reports', shortLabel: 'Reports' },
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
  const emojiStyle = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size - 1,
    lineHeight: 1,
  };

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
      return <span style={emojiStyle} aria-hidden="true">🏠</span>;
    case 'products':
      return <span style={emojiStyle} aria-hidden="true">📦</span>;
    case 'sales':
      return <span style={emojiStyle} aria-hidden="true">💰</span>;
    case 'purchases':
      return <span style={emojiStyle} aria-hidden="true">🛒</span>;
    case 'udhaar':
      return <span style={emojiStyle} aria-hidden="true">📒</span>;
    case 'gst':
      return <span style={emojiStyle} aria-hidden="true">🧾</span>;
    case 'reports':
      return <span style={emojiStyle} aria-hidden="true">📊</span>;
    case 'profile':
      return <span style={emojiStyle} aria-hidden="true">👤</span>;
    case 'logout':
      return <span style={emojiStyle} aria-hidden="true">🚪</span>;
    case 'pricing':
      return <span style={emojiStyle} aria-hidden="true">⭐</span>;
    case 'language':
      return <span style={emojiStyle} aria-hidden="true">🌐</span>;
    default:
      return <span style={emojiStyle} aria-hidden="true">•</span>;
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
      <span style={{ fontSize: size === 'sm' ? 14 : 20, fontWeight: 900 }}>र</span>
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
  const { locale, setLocale, t } = useAppLocale();
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
  const firstName = user?.name?.split(' ')?.[0] || t('profile');
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
                <Logo size="md" />
                <div>
                  <div className="brand-title">रखरखाव</div>
                  <div className="brand-subtitle">{t('brand')}</div>
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

            <div className="language-switch-card">
              <div className="language-copy">
                <div className="language-title">{t('language')}</div>
                <div className="language-subtitle">{locale === 'hi' ? t('hindi') : t('english')}</div>
              </div>
              <div className="segmented-group language-toggle">
                <button
                  type="button"
                  onClick={() => setLocale('hi')}
                  className={`segmented-option ${locale === 'hi' ? 'is-active' : ''}`}
                >
                  हिं
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`segmented-option ${locale === 'en' ? 'is-active' : ''}`}
                >
                  EN
                </button>
              </div>
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
                    {t('profile')}
                  </button>
                  <button type="button" onClick={logout} className="danger">
                    <Glyph name="logout" size={16} />
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>

            <div className="sidebar-section-label">{t('mainMenu')}</div>

            <nav className="sidebar-nav">
              {translatedNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <a key={item.href} href={item.href} className={`nav-link ${active ? 'is-active' : ''}`}>
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
              {t('logout')}
            </button>
          </div>
        </aside>

        <div className={`mobile-topbar premium-topbar ${scrolled ? 'is-scrolled' : ''}`}>
          <div className="mobile-topbar-brand">
            <Logo size="sm" />
            <div>
              <div className="mobile-brand-title">रखरखाव</div>
              <div className="mobile-brand-subtitle">{t('brand')}</div>
            </div>
          </div>

          <div className="mobile-topbar-actions">
            <a href="/pricing" className={`top-upgrade-chip ${subscription?.isPro ? 'is-manage' : 'is-shining'}`}>
              <Glyph name="pricing" size={14} />
              {upgradeButtonLabel}
            </a>
            <button type="button" className="language-compact" onClick={() => setLocale(locale === 'hi' ? 'en' : 'hi')}>
              <Glyph name="language" size={14} />
              {locale === 'hi' ? 'हिं' : 'EN'}
            </button>

            <div ref={mobileDropRef} style={{ position: 'relative' }}>
              <button type="button" className="mobile-user-chip" onClick={() => setMobileDropOpen((value) => !value)}>
                <div className="mobile-avatar">{initial}</div>
                <span>{firstName}</span>
              </button>
              {mobileDropOpen && (
                <div className="sidebar-user-menu mobile-user-menu">
                  <button type="button" onClick={goToProfile}>
                    <Glyph name="profile" size={16} />
                    {t('profile')}
                  </button>
                  <a href="/reports">
                    <Glyph name="reports" size={16} />
                    {t('reports')}
                  </a>
                  <a href="/pricing">
                    <Glyph name="pricing" size={16} />
                    {t('pricing')}
                  </a>
                  <button type="button" onClick={logout} className="danger">
                    <Glyph name="logout" size={16} />
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="main-content premium-main-content">
          <div className="content-container">
            <div className="content-top-actions">
              <div className="content-top-actions-copy">
                <div className="content-top-actions-kicker">Premium access</div>
                <div className="content-top-actions-subtitle">
                  Open plans anytime from this top tab without cluttering your main workspace.
                </div>
              </div>
              <a href="/pricing" className={`top-upgrade-chip desktop-upgrade-chip ${subscription?.isPro ? 'is-manage' : 'is-shining'}`}>
                <Glyph name="pricing" size={15} />
                {upgradeButtonLabel}
              </a>
            </div>
            {children}
          </div>
        </main>

        <nav className="mobile-bottom-nav premium-bottom-nav">
          <div className="mobile-bottom-nav-card">
            {translatedNav.map((item) => {
              const active = pathname === item.href;
              return (
                <a key={item.href} href={item.href} className={`mobile-nav-link ${active ? 'is-active' : ''}`}>
                  <span className="mobile-nav-glow" />
                  <Glyph name={item.key} size={18} />
                  <span>{item.label}</span>
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
            radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.18), transparent 26%),
            radial-gradient(circle at 0% 100%, rgba(45, 212, 191, 0.14), transparent 26%),
            linear-gradient(180deg, rgba(7, 17, 31, 0.99), rgba(12, 28, 49, 0.98) 48%, rgba(7, 17, 31, 1));
          border: 1px solid rgba(148, 163, 184, 0.12);
          box-shadow: 0 32px 80px rgba(2, 8, 23, 0.28);
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
          background: linear-gradient(135deg, rgba(8, 32, 50, 0.98), rgba(29, 78, 216, 0.82), rgba(245, 158, 11, 0.72));
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 40px rgba(8, 32, 50, 0.28);
          overflow: hidden;
          color: white;
        }

        .brand-title {
          font-size: 23px;
          line-height: 1;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.06em;
        }

        .brand-subtitle {
          font-size: 10px;
          margin-top: 4px;
          color: rgba(226, 232, 240, 0.56);
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .brand-status-card,
        .language-switch-card {
          margin-top: 14px;
          border-radius: 20px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
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
          color: white;
          padding: 14px;
          border-radius: 20px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: linear-gradient(135deg, rgba(37,99,235,0.18), rgba(56,189,248,0.08));
          border: 1px solid rgba(147,197,253,0.12);
          box-shadow: 0 18px 34px rgba(2, 8, 23, 0.18);
          transform: translateY(0);
        }

        .sidebar-shortcut.is-secondary {
          background: linear-gradient(135deg, rgba(16,185,129,0.16), rgba(74,222,128,0.08));
          border-color: rgba(110,231,183,0.12);
        }

        .sidebar-shortcut:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(2, 8, 23, 0.24);
        }

        .sidebar-shortcut-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.12);
          color: #eff6ff;
          flex-shrink: 0;
        }

        .sidebar-shortcut-title {
          font-size: 13px;
          font-weight: 800;
        }

        .sidebar-shortcut-copy {
          font-size: 11px;
          margin-top: 4px;
          color: rgba(226, 232, 240, 0.6);
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
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
          text-align: left;
          cursor: pointer;
        }

        .sidebar-avatar,
        .mobile-avatar {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #2563eb, #14b8a6);
          color: white;
          font-size: 15px;
          font-weight: 900;
          box-shadow: 0 16px 30px rgba(37, 99, 235, 0.2);
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
          background: linear-gradient(135deg, rgba(37,99,235,0.16), rgba(20,184,166,0.12));
          border-color: rgba(147,197,253,0.12);
          box-shadow: 0 16px 30px rgba(2,8,23,0.2);
        }

        .nav-link.is-active .nav-link-accent {
          opacity: 1;
          transform: scaleY(1);
        }

        .nav-link:hover {
          color: white;
          background: rgba(255,255,255,0.05);
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
          background: rgba(7, 17, 31, 0.84);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(148, 163, 184, 0.08);
        }

        .premium-topbar.is-scrolled {
          background: rgba(7, 17, 31, 0.96);
          box-shadow: 0 14px 34px rgba(2, 8, 23, 0.22);
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
          color: white;
          line-height: 1;
        }

        .mobile-brand-subtitle {
          font-size: 10px;
          color: rgba(226, 232, 240, 0.56);
          margin-top: 4px;
        }

        .mobile-user-chip,
        .language-compact,
        .top-upgrade-chip {
          border: 1px solid rgba(148,163,184,0.12);
          background: rgba(255,255,255,0.06);
          color: white;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
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
          box-shadow: 0 16px 34px rgba(8, 32, 50, 0.28);
          background: linear-gradient(135deg, rgba(8,32,50,0.98), rgba(29,78,216,0.84), rgba(245,158,11,0.82));
          border-color: rgba(255,255,255,0.16);
        }

        .top-upgrade-chip.is-manage {
          background: rgba(255,255,255,0.08);
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
          padding: 28px 24px 102px;
          min-height: 100vh;
        }

        .content-container {
          max-width: 1420px;
          margin: 0 auto;
        }

        .content-top-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 18px;
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
          background: rgba(7,17,31,0.96);
          border: 1px solid rgba(148,163,184,0.1);
          box-shadow: 0 26px 60px rgba(2, 8, 23, 0.34);
          backdrop-filter: blur(18px);
        }

        .mobile-nav-link {
          position: relative;
          flex: 1;
          min-width: 0;
          color: rgba(226,232,240,0.5);
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
        }

        .mobile-nav-glow {
          position: absolute;
          inset: 0;
          opacity: 0;
          background: linear-gradient(180deg, rgba(37,99,235,0.2), rgba(20,184,166,0.08));
          transition: opacity 0.2s ease;
        }

        .mobile-nav-link.is-active {
          color: white;
          transform: translateY(-1px);
        }

        .mobile-nav-link.is-active .mobile-nav-glow {
          opacity: 1;
        }

        .mobile-nav-link > * {
          position: relative;
          z-index: 1;
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

