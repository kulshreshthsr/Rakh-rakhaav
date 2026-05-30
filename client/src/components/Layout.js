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
import { SYSTEM_ROLES as FRONTEND_ROLES } from '../lib/permissions';
import { useIndustry } from '../contexts/IndustryContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import NotificationBell from './NotificationBell';

/* ─── Nav config ─────────────────────────────────────────────────── */
// permission: the permission required to see this item; null = visible to all
const NAV_ITEMS = [
  { href: '/dashboard',    key: 'dashboard', shortLabel: 'Home',     tone: 'home',    permission: 'VIEW_DASHBOARD'    },
  { href: '/product',      key: 'products',  shortLabel: 'Stock',    tone: 'stock',   permission: 'MANAGE_INVENTORY'  },
  { href: '/sales',        key: 'sales',     shortLabel: 'Sale',     tone: 'sales',   permission: 'VIEW_SALES'        },
  { href: '/purchases',    key: 'purchases', shortLabel: 'Purchase', tone: 'purchase',permission: 'VIEW_PURCHASES'    },
  { href: '/expenses',     key: 'expenses',  shortLabel: 'Expense',  tone: 'reports', permission: 'VIEW_EXPENSES'     },
  { href: '/income',       key: 'income',    shortLabel: 'Income',   tone: 'income',  permission: 'VIEW_INCOME'       },
  { href: '/bank-entries', key: 'bank',      shortLabel: 'Bank',     tone: 'bank',    permission: 'VIEW_BANK'         },
  { href: '/udhaar',       key: 'udhaar',    shortLabel: 'Udhaar',   tone: 'credit',  permission: 'VIEW_UDHAAR'       },
  { href: '/gst',          key: 'gst',       shortLabel: 'GST',      tone: 'gst',     permission: 'VIEW_GST'          },
  { href: '/reports',      key: 'reports',   shortLabel: 'Reports',  tone: 'reports', permission: 'VIEW_REPORTS'      },
];

// Bottom nav is dynamically computed per business type — see bottomNavItems below

const MORE_DRAWER_ITEMS = [
  { href: '/product',       key: 'products',       label: 'Stock',         sublabel: 'Products & Inventory', icon: 'products', permission: 'MANAGE_INVENTORY' },
  { href: '/expenses',      key: 'expenses',       label: 'Expenses',      sublabel: 'Kharch Register',      icon: 'expenses', permission: 'VIEW_EXPENSES'    },
  { href: '/income',        key: 'income',         label: 'Income',        sublabel: 'Other Income',         icon: 'income',   permission: 'VIEW_INCOME'      },
  { href: '/bank-entries',  key: 'bank',           label: 'Bank',          sublabel: 'Bank Register',        icon: 'bank',     permission: 'VIEW_BANK'        },
  { href: '/gst',           key: 'gst',            label: 'GST',           sublabel: 'Tax Filing',           icon: 'gst',      permission: 'VIEW_GST'         },
  { href: '/reports',       key: 'reports',        label: 'रिपोर्ट',       sublabel: 'Reports',              icon: 'reports',  permission: 'VIEW_REPORTS'     },
  { href: '/notifications', key: 'notifications', label: 'Alerts',     sublabel: 'Stock & Operation Alerts', icon: 'reports', permission: 'VIEW_DASHBOARD' },
  { href: '/tasks',         key: 'tasks',         label: 'Tasks',      sublabel: 'Operational Tasks',        icon: 'reports', permission: 'VIEW_DASHBOARD'  },
  { href: '/audit',         key: 'audit',         label: 'Activity',   sublabel: 'Audit Trail',              icon: 'reports', permission: 'VIEW_REPORTS'    },
  { href: '/profile',       key: 'profile',        label: 'Profile',       sublabel: 'दुकान की जानकारी',     icon: 'profile',  permission: null               },
  { href: '/team',          key: 'team',           label: 'Team',          sublabel: 'User Management',      icon: 'team',     permission: 'MANAGE_USERS'     },
  { href: '/roles',         key: 'roles',          label: 'Roles',         sublabel: 'Permissions',          icon: 'roles',    permission: 'MANAGE_ROLES'     },
];

const SUBSCRIPTION_REFRESH_TTL_MS = 60 * 1000;

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
    expenses:   <><path d="M6 4.5h12" /><path d="M6 9.5h12" /><path d="M6 14.5h7" /><path d="M17 14v6" /><path d="M14 17h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></>,
    income:     <><path d="M12 20V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    bank:       <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
    udhaar:     <><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3" /><path d="M6 3.5v20" /><path d="M9 7.5h6" /><path d="M9 11.5h6" /><path d="M9 15.5h4" /></>,
    gst:        <><path d="M7 4.5h10" /><path d="M7 9.5h10" /><path d="M7 14.5h5" /><path d="M16.5 13v7" /><path d="M13.5 16h6" /><rect x="4" y="3" width="16" height="18" rx="2.5" /></>,
    reports:    <><path d="M5 19.5V10.5" /><path d="M12 19.5V5.5" /><path d="M19 19.5V13.5" /><path d="M3.5 19.5h17" /></>,
    profile:    <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    logout:     <><path d="M10 7V5.5A2.5 2.5 0 0 1 12.5 3H18a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21h-5.5A2.5 2.5 0 0 1 10 18.5V17" /><path d="M14 12H3.5" /><path d="m7.5 8-4 4 4 4" /></>,
    pricing:    <path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z" />,
    menu:       <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close:      <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
    more:       <><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/></>,
    team:       <><circle cx="9" cy="7" r="3" /><path d="M3 21v-2a6 6 0 0 1 6-6" /><path d="M16 11c2.2 0 4 1.8 4 4v1.5" /><circle cx="19" cy="8" r="2.5" /></>,
    roles:      <><path d="M12 3 4 7v5c0 5 4 9.7 8 11 4-1.3 8-6 8-11V7z" /><path d="m9 12 2 2 4-4" /></>,
  };
  return <svg {...p}>{icons[name] || <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />}</svg>;
}

/* ─── Logo with Green Gradient ───────────────────────────────────── */
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
        <img src="/logo.png" alt="Rakh-Rakhaav logo" width={dim} height={dim}
          className="h-full w-full object-contain"
          onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className={`brand-logo-fallback ${frameClass} bg-gradient-to-br from-green-600 to-emerald-700 shadow-lg shadow-green-500/30`}>
      <span className={fallbackTextClass}>₹</span>
    </div>
  );
}

/* ─── User dropdown (desktop) - Green themed ────────────────────── */
function UserDropdown({ onProfile, onLogout, extraItems, className = '' }) {
  return (
    <div className={`sidebar-user-menu${className ? ` ${className}` : ''}`}>
      <button type="button" onClick={onProfile} className="hover:bg-green-50 hover:text-green-700">
        <Glyph name="profile" size={16} /> Profile
      </button>
      {extraItems}
      <button type="button" onClick={onLogout} className="danger hover:bg-red-50 hover:text-red-700">
        <Glyph name="logout" size={16} /> Logout
      </button>
    </div>
  );
}

/* ─── More drawer (mobile) - Enhanced Green Theme ───────────────── */
function MoreDrawer({ open, onClose, pathname, onLogout, subscription, items = MORE_DRAWER_ITEMS }) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const iconColors = {
    products:  'bg-emerald-50 text-emerald-700',
    expenses:  'bg-rose-50 text-rose-700',
    income:    'bg-green-50 text-green-700',
    bank:      'bg-blue-50 text-blue-700',
    reports:   'bg-purple-50 text-purple-700',
    gst:       'bg-amber-50 text-amber-700',
    profile:   'bg-slate-100 text-slate-700',
    team:      'bg-green-50 text-green-700',
    roles:     'bg-purple-50 text-purple-700',
  };

  return (
    <>
      {/* Backdrop — conditionally rendered so it disappears instantly on nav link click */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sheet — slides up from bottom */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="More options"
        className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl shadow-slate-900/30 border-t-2 border-green-200 max-h-[85dvh] overflow-y-auto">

          {/* Handle */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-12 h-1.5 rounded-full bg-green-200" />
          </div>

          {/* Header - Enhanced */}
          <div className="flex items-center justify-between px-5 pt-3 pb-5 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-green-700">Quick Access</p>
              <h2 className="text-[20px] font-black text-slate-900 mt-1">और विकल्प</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-red-100 hover:text-red-600 transition-all hover:scale-105"
            >
              <Glyph name="close" size={18} stroke={2.5} />
            </button>
          </div>

          {/* Nav items grid - Enhanced */}
          <div className="px-4 pb-3 pt-3 grid grid-cols-1 gap-2.5">
            {items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    isActive
                      ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-green-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform ${
                    isActive ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white shadow-green-500/30' : iconColors[item.key] || 'bg-slate-100 text-slate-600'
                  }`}>
                    <Glyph name={item.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[16px] font-black leading-tight ${isActive ? 'text-green-800' : 'text-slate-900'}`}>
                      {item.label}
                    </div>
                    <div className={`text-[12px] font-medium mt-1 ${isActive ? 'text-green-600' : 'text-slate-500'}`}>
                      {item.sublabel}
                    </div>
                  </div>
                  {isActive && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-600 flex-shrink-0 shadow-lg shadow-green-500/50" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Upgrade card - Green themed */}
          <div className="px-4 pb-3 pt-2">
            <Link href="/pricing" onClick={onClose}
              className="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 px-5 py-4 transition-all hover:-translate-y-1 hover:border-green-400 hover:shadow-xl hover:shadow-green-500/20"
            >
              <div className="pointer-events-none absolute inset-y-0 -left-1 w-28 bg-gradient-to-r from-white/80 via-white/30 to-transparent skew-x-[-18deg] animate-[premiumShine_3s_ease-in-out_infinite]" />
              <div className="relative z-10 w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/30">
                <Glyph name="pricing" size={20} />
              </div>
              <div className="relative z-10 flex-1">
                <div className="text-[16px] font-black text-green-900">
                  {subscription?.isPro ? 'Manage Plan' : 'Upgrade करें'}
                </div>
                <div className="text-[13px] text-green-700 font-semibold">
                  {subscription?.isPro ? 'Pro plan active ✓' : 'Pro features unlock करें'}
                </div>
              </div>
              <div className="relative z-10 text-green-600">
                <Glyph name="pricing" size={18} />
              </div>
            </Link>
          </div>

          {/* Logout - Enhanced */}
          <div className="px-4 pb-7 pt-2">
            <button
              type="button"
              onClick={() => { onClose(); onLogout(); }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-red-200 bg-red-50 text-[15px] font-black text-red-700 hover:bg-red-100 hover:border-red-300 transition-all shadow-md hover:shadow-lg"
            >
              <Glyph name="logout" size={18} /> Logout
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
  const { updateBusinessType, term, isEnabled, businessType } = useIndustry();
  const [user, setUser] = useState(() => readStoredUser());
  const [subscription, setSubscription] = useState(() => readStoredSubscription());
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paywallPlan, setPaywallPlan] = useState('weekly');
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const dropdownRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

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
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.businessType) updateBusinessType(data.user.businessType);
      }
      setSubscription(data.subscription || null);
      writeStoredSubscription(data.subscription || null);
      setPlans(mergePlansWithFallback(data.plans));
      setRazorpayKeyId(data.razorpayKeyId || '');
      markSubscriptionRefreshNow();
      return true;
    } catch { return false; }
  }, [router, updateBusinessType]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    if (!shouldRefreshSubscriptionCache()) return;
    const id = window.setTimeout(refreshSubscription, 0);
    return () => window.clearTimeout(id);
  }, [refreshSubscription, router]);

  useEffect(() => {
    const PING_KEY = 'rr-last-server-ping';
    const THROTTLE = 10 * 60 * 1000; // 10 minutes
    function maybePing() {
      try {
        const last = parseInt(localStorage.getItem(PING_KEY) || '0', 10);
        if (Date.now() - last < THROTTLE) return;
        localStorage.setItem(PING_KEY, String(Date.now()));
      } catch { return; }
      fetch(`${API}/api/health`, { signal: AbortSignal.timeout(60000) }).catch(() => {});
    }
    maybePing();
    const onVisible = () => { if (document.visibilityState === 'visible') maybePing(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (mobileProfileRef.current && !mobileProfileRef.current.contains(e.target)) setMobileProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!pathname || ['/pricing', '/welcome', '/trial-status'].includes(pathname)) return;
    if (hasWelcomePending()) { router.replace('/welcome'); return; }
    if (subscription && !subscription.isPro && !hasTrialGateSeen()) router.replace('/trial-status');
  }, [pathname, router, subscription]);

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

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  const bilingualLabels = useMemo(() => ({
    dashboard: 'होम / Dashboard',
    products:  `स्टॉक / ${term('inventory', 'Products')}`,
    sales:     `बेचिए / ${term('sale', 'Sales')}`,
    purchases: `खरीदिए / ${term('purchase', 'Purchases')}`,
    expenses:  'खर्च / Expenses',
    income:    'आय / Income',
    bank:      'बैंक / Bank',
    udhaar:    'उधार / Credit',
    gst:       'GST / Tax',
    reports:   'रिपोर्ट / Hisaab',
  }), [term]);

  // Permission-based nav filtering: owners see everything; sub-users see only allowed items.
  // Falls back to system role defaults so nav is never blank while subscription-status loads.
  const canAccess = useCallback((permission) => {
    if (!permission) return true;
    if (!user?.isSubUser || user?.role === 'owner') return true;
    const perms = user?.permissions?.length
      ? user.permissions
      : FRONTEND_ROLES[user?.role]?.permissions || [];
    return perms.includes(permission);
  }, [user]);

  const translatedNav = useMemo(
    () => NAV_ITEMS
      .filter(item => canAccess(item.permission))
      .filter(item => isEnabled(item.key))
      .map((item) => ({ ...item, label: bilingualLabels[item.key] || t(item.key) })),
    [bilingualLabels, t, canAccess, isEnabled]
  );

  // Dynamic bottom nav — slot 0 is always Dashboard, slot 1 is always Sales,
  // slots 2-3 are chosen based on business type.
  const bottomNavItems = useMemo(() => {
    const ALL_ITEMS = {
      dashboard: { href: '/dashboard', key: 'dashboard', shortLabel: 'Home',                         icon: 'dashboard', permission: 'VIEW_DASHBOARD'   },
      sales:     { href: '/sales',     key: 'sales',     shortLabel: term('sale', 'Sale'),            icon: 'sales',     permission: 'VIEW_SALES'       },
      purchases: { href: '/purchases', key: 'purchases', shortLabel: 'Purchase',                      icon: 'purchases', permission: 'VIEW_PURCHASES'   },
      udhaar:    { href: '/udhaar',    key: 'udhaar',    shortLabel: 'Udhaar',                        icon: 'udhaar',    permission: 'VIEW_UDHAAR'      },
      product:   { href: '/product',   key: 'products',  shortLabel: term('inventory', 'Stock'),      icon: 'products',  permission: 'MANAGE_INVENTORY' },
      reports:   { href: '/reports',   key: 'reports',   shortLabel: 'Reports',                       icon: 'reports',   permission: 'VIEW_REPORTS'     },
      expenses:  { href: '/expenses',  key: 'expenses',  shortLabel: 'Expense',                       icon: 'expenses',  permission: 'VIEW_EXPENSES'    },
    };
    const typeMap = {
      restaurant:     ['purchases', 'reports'],
      salon:          ['product',   'reports'],
      repair_shop:    ['product',   'udhaar'],
      automobile:     ['product',   'udhaar'],
      service_center: ['product',   'udhaar'],
      pharmacy:       ['product',   'udhaar'],
      jewellery:      ['product',   'udhaar'],
      kirana:         ['purchases', 'udhaar'],
      grocery:        ['purchases', 'udhaar'],
      mobile_shop:    ['product',   'purchases'],
      sweet_shop:     ['product',   'expenses'],
      bakery:         ['product',   'expenses'],
      hardware:       ['purchases', 'udhaar'],
      clothing:       ['product',   'udhaar'],
      footwear:       ['product',   'udhaar'],
    };
    const [slot2, slot3] = typeMap[businessType] || ['purchases', 'udhaar'];
    return [ALL_ITEMS.dashboard, ALL_ITEMS.sales, ALL_ITEMS[slot2], ALL_ITEMS[slot3]];
  }, [businessType, term]);

  const filteredBottomNav = useMemo(
    () => bottomNavItems.filter(item => canAccess(item.permission)),
    [bottomNavItems, canAccess]
  );

  const filteredDrawerItems = useMemo(() => {
    const base = MORE_DRAWER_ITEMS
      .filter(item => canAccess(item.permission))
      .filter(item => isEnabled(item.key))
      .map(item => {
        if (item.key === 'products') return { ...item, label: term('inventory', 'Stock'), sublabel: `${term('products','Products')} & Inventory` };
        return item;
      });
    // Narcotics register — pharmacy only
    if (businessType === 'pharmacy' && canAccess('VIEW_REPORTS')) {
      base.push({ href: '/narcotics', key: 'narcotics', label: 'Narcotics Reg.', sublabel: 'Schedule X Dispensing Log', icon: 'reports', permission: 'VIEW_REPORTS' });
    }
    // Salon-specific pages
    if (businessType === 'salon') {
      base.push({ href: '/appointments', key: 'appointments', label: 'Calendar',    sublabel: 'Appointment calendar', icon: 'reports', permission: 'VIEW_SALES' });
      base.push({ href: '/stylists',     key: 'stylists',     label: 'Stylists',    sublabel: 'Staff management',     icon: 'team',    permission: 'MANAGE_INVENTORY' });
      base.push({ href: '/memberships',  key: 'memberships',  label: 'Memberships', sublabel: 'Package tracking',     icon: 'udhaar',  permission: 'VIEW_SALES' });
    }
    // Restaurant-specific pages
    if (businessType === 'restaurant') {
      base.push({ href: '/tables', key: 'tables', label: 'Floor View', sublabel: 'Live table status', icon: 'reports', permission: 'VIEW_SALES' });
    }
    // Hardware-specific pages
    if (businessType === 'hardware') {
      base.push({ href: '/contractors', key: 'contractors', label: 'Contractors', sublabel: 'Account management', icon: 'team', permission: 'VIEW_SALES' });
    }
    // Electronics-specific pages
    if (businessType === 'electronics' || businessType === 'mobile_shop') {
      base.push({ href: '/warranty', key: 'warranty', label: 'Warranty Claims', sublabel: 'Claim register', icon: 'reports', permission: 'VIEW_SALES' });
    }
    return base;
  }, [canAccess, isEnabled, term, businessType]);

  return (
    <NotificationProvider>
    <div className="app-shell-root rr-workspace-premium">
      <div className={subscription?.isReadOnly ? 'shell-readonly-content' : ''}>

        {/* ══ Desktop sidebar - Enhanced Green Theme ═════════════════ */}
        <aside className={`desktop-sidebar premium-sidebar${locale === 'hi' ? ' sidebar-locale-hi' : ''}`}>
          <div className="sidebar-panel">
            {/* Green orbs instead of cyan/blue */}
            <div className="sidebar-orb sidebar-orb-top" style={{background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)'}} />
            <div className="sidebar-orb sidebar-orb-bottom" style={{background: 'radial-gradient(circle, rgba(5,150,105,0.12) 0%, transparent 70%)'}} />

            {/* Brand */}
            <div className="brand-lockup">
              <div className="brand-row">
                <Logo />
                <div>
                  <div className="brand-title brand-title-hindi">रखरखाव</div>
                </div>
              </div>
            </div>

            {/* User card - Enhanced */}
            <div ref={dropdownRef} className="relative">
              <button type="button" className="sidebar-user-card group" onClick={() => setDropdownOpen(v => !v)}>
                <div className="sidebar-avatar bg-gradient-to-br from-green-600 to-emerald-700 shadow-lg shadow-green-500/30 group-hover:scale-105 transition-transform">{initial}</div>
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
                  extraItems={
                    <>
                      {canAccess('MANAGE_USERS') && (
                        <Link href="/team" onClick={() => setDropdownOpen(false)} className="hover:bg-green-50 hover:text-green-700">
                          <Glyph name="team" size={16} /> Team Members
                        </Link>
                      )}
                      <Link href="/pricing" className="hover:bg-green-50 hover:text-green-700">
                        <Glyph name="pricing" size={16} /> Rakhrakhaav Pro
                      </Link>
                    </>
                  }
                />
              )}
            </div>

            {/* Notification bell row — desktop sidebar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px 4px' }}>
              <NotificationBell />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href="/notifications" style={{ fontSize: 12, fontWeight: 700, color: '#475569', textDecoration: 'none', display: 'block' }}>Alerts</Link>
                <Link href="/tasks" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none', display: 'block', marginTop: 1 }}>My Tasks</Link>
              </div>
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

        {/* ══ Mobile top bar - Enhanced Green ════════════════════════ */}
        <div className={`mobile-topbar premium-topbar${scrolled ? ' is-scrolled' : ''}`}>
          <div className="mobile-topbar-brand">
            <Logo size="sm" />
            <div className="mobile-brand-copy">
              <div className="mobile-brand-title">रखरखाव</div>
              <div className="mobile-brand-subtitle">Simple business app</div>
            </div>
          </div>

          <div className="relative flex items-center gap-2" ref={mobileProfileRef}>
            <NotificationBell />
            {!subscription?.isPro && (
              <Link href="/pricing"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-300 text-[11px] font-black text-green-800 hover:bg-green-100 transition-all shadow-sm hover:shadow-md"
              >
                ⚡ Upgrade
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileProfileOpen((v) => !v)}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-white font-black text-[14px] shadow-lg shadow-green-500/30 hover:shadow-xl hover:-translate-y-px transition-all hover:scale-105"
              aria-label="Open profile menu"
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

        <MoreDrawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          pathname={pathname}
          onLogout={logout}
          subscription={subscription}
          items={filteredDrawerItems}
        />

        <main className="main-content premium-main-content">
          <div className="content-container">{children}</div>
        </main>

        {/* ══ Mobile bottom nav - Enhanced Green Theme ═══════════════ */}
        <nav className="mobile-bottom-nav premium-bottom-nav">
          <div className="mobile-bottom-nav-card">

            {filteredBottomNav.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link mobile-nav-tone-${item.key}${isActive ? ' is-active' : ''} group`}
                >
                  <span className="mobile-nav-icon-wrap">
                    <span className={`mobile-nav-glow ${isActive ? 'bg-green-500/30' : ''}`} />
                    <Glyph name={item.icon} size={21} stroke={isActive ? 2.2 : 1.8} />
                  </span>
                  <span className={`mobile-nav-label font-bold ${isActive ? 'text-green-700' : ''}`}>{item.shortLabel}</span>
                </Link>
              );
            })}

            {/* More button - Enhanced */}
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              className={`mobile-nav-link group${moreOpen ? ' is-active' : ''}`}
            >
              <span className="mobile-nav-icon-wrap">
                <span className={`mobile-nav-glow ${moreOpen ? 'bg-green-500/30' : ''}`} />
                {moreOpen
                  ? <Glyph name="close" size={21} stroke={2.5} />
                  : <Glyph name="menu" size={21} stroke={2} />
                }
              </span>
              <span className={`mobile-nav-label font-bold ${moreOpen ? 'text-green-700' : ''}`}>और</span>
            </button>

          </div>
        </nav>
      </div>

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
    </NotificationProvider>
  );
}

export default function Layout({ children }) {
  return <LayoutInner>{children}</LayoutInner>;
}