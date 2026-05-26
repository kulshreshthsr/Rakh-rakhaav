'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../lib/pageCache';
import { hasPermission } from '../../lib/permissions';
import { useIndustry } from '../../contexts/IndustryContext';

const DASHBOARD_CACHE_KEY = 'dashboard-page';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'शुभ प्रभात 🌅';
  if (h < 17) return 'नमस्ते 🙏';
  if (h < 20) return 'शुभ संध्या 🌇';
  return 'शुभ रात्रि 🌙';
}

function getTodayLabel() {
  return new Date().toLocaleDateString('hi-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function buildUdhaarReminder(customer, shopName) {
  return `Namaste ${customer.name} ji 🙏\n\nHamari dukaan *${shopName || 'Rakh-Rakhaav'}* se aapka udhaar baaki hai:\n\n*₹${fmtD(customer.due)}*\n\nKripya jald se jald payment karein.\n\nDhanyawad 🙏`;
}

/* Enhanced Quick Action Card with Green Theme */
function QuickAction({ href, emoji, label, sublabel, gradient }) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${gradient} border-2 border-transparent text-center hover:border-green-300 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 active:scale-95`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="relative text-3xl transform group-hover:scale-110 transition-transform">{emoji}</span>
      <div className="relative">
        <span className="block text-[14px] font-black text-slate-900 leading-tight">{label}</span>
        {sublabel && <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{sublabel}</span>}
      </div>
    </Link>
  );
}

/* Stat Card Component */
function StatCard({ label, value, sub, gradient, icon, href }) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden bg-gradient-to-br ${gradient} border-2 border-white/50 rounded-2xl p-4 hover:border-green-300 hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}
    >
      <div className="absolute top-2 right-2 text-3xl opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <p className="relative text-[18px] font-black leading-none text-slate-900 mb-1">{value}</p>
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide leading-tight">{label}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { term, config, isEnabled } = useIndustry();

  const hasBootstrappedRef = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerPhoto, setOwnerPhoto] = useState('');
  const [userName, setUserName] = useState('');
  const [greeting] = useState(getGreeting);
  const [today] = useState(getTodayLabel);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      if (!silent) setError('');
      const [dashRes, shopRes] = await Promise.all([
        fetch(apiUrl('/api/dashboard/summary'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.status === 401 || shopRes.status === 401) { router.push('/login'); return; }
      if (!dashRes.ok || !shopRes.ok) throw new Error('Failed to load dashboard');
      const dashData = await dashRes.json();
      const shopData = await shopRes.json();
      const nextShopName = shopData.name || 'मेरी दुकान';
      const nextOwnerPhoto = shopData.owner_photo || '';
      setData(dashData);
      setShopName(nextShopName);
      setOwnerPhoto(nextOwnerPhoto);
      writePageCache(DASHBOARD_CACHE_KEY, { data: dashData, shopName: nextShopName, ownerPhoto: nextOwnerPhoto });
    } catch (err) {
      if (!silent) { setData(null); setError(err.message || 'Dashboard data load nahi ho paya.'); }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(user.name || '');

    const cached = readPageCache(DASHBOARD_CACHE_KEY);
    if (cached?.data) {
      setData(cached.data);
      setShopName(cached.shopName || 'मेरी दुकान');
      setOwnerPhoto(cached.ownerPhoto || '');
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.data));
      await fetchDashboard({ silent: Boolean(cached?.data) });
      setRefreshing(false);
    });
    return () => cancelDeferred(deferredId);
  }, [fetchDashboard, router]);

  const today_sales = data?.today?.revenue || 0;
  const today_bills = data?.today?.bills || 0;
  const today_profit = data?.today?.profit || 0;
  const month_sales = data?.month?.revenue || 0;
  const month_profit = data?.month?.profit || 0;
  const total_udhaar = data?.udhaar?.totalDue || 0;
  const udhaar_count = data?.udhaar?.pendingCount || 0;
  const gst_payable = data?.gst?.netPayable || 0;
  const low_stock = data?.stock?.lowStockCount || 0;
  const out_of_stock = data?.stock?.outOfStockCount || 0;

  const topUdhaarCustomers = (data?.udhaar?.topCustomers || []).slice(0, 5);
  const lowStockItems = (data?.stock?.lowStockItems || []).slice(0, 4);

  /* Skeleton loader with green theme */
  if (loading) {
    return (
      <Layout>
        <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">
          {[80, 140, 180, 120].map((h, i) => (
            <div key={i} className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200/50 animate-pulse"
              style={{ height: h }} />
          ))}
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-5">
            <p className="text-[16px] font-black text-red-900">Dashboard data load nahi ho paya.</p>
            <p className="mt-2 text-[13px] text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchDashboard}
              className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-[13px] font-black text-white hover:bg-red-700 shadow-lg hover:shadow-xl transition-all"
            >
              Dobara load karo
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const hasUrgent = udhaar_count > 0 || low_stock > 0 || out_of_stock > 0;

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">
        {refreshing && (
          <div className="flex items-center justify-end gap-1.5 px-1 -mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Updating…</span>
          </div>
        )}

        {/* ══════════════════════════════════════
            1. GREETING HEADER - Enhanced Green Theme
        ══════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-6 shadow-xl">
          {/* Decorative green orbs */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-green-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{today}</p>
              <h1 className="text-[24px] sm:text-[26px] font-black text-white leading-tight">
                {greeting}
              </h1>
              {userName && (
                <p className="text-[14px] text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{userName}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 font-bold">
                    {shopName}
                  </span>
                </p>
              )}
            </div>

            {ownerPhoto ? (
              <img
                src={ownerPhoto}
                alt={userName || 'Shopkeeper'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-green-500/30 shadow-lg shadow-green-500/20 flex-shrink-0 hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 border-2 border-green-400/30 flex items-center justify-center text-white text-[28px] font-black flex-shrink-0 shadow-lg shadow-green-500/20 hover:scale-105 transition-transform">
                {(userName || shopName || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            2. आज का हाल - Today's Performance with Green Gradient
        ══════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              आज का हाल
            </p>
            {hasPermission('VIEW_SALES') && (
              <Link href="/sales" className="text-[11px] font-bold text-green-700 hover:text-green-800 hover:underline">
                सभी bills →
              </Link>
            )}
          </div>

          {/* Big today revenue card - Green gradient */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 p-6 mb-3 shadow-2xl shadow-green-500/30 hover:shadow-green-500/40 hover:-translate-y-0.5 transition-all">
            <div className="pointer-events-none absolute -top-8 right-4 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-emerald-400/20 blur-2xl" />
            
            <div className="relative z-10">
              <p className="text-[12px] font-bold text-white/80 uppercase tracking-wider mb-2">आज की कमाई</p>
              <p className="text-[42px] sm:text-[48px] font-black text-white leading-none tracking-tight mb-4">
                ₹{fmt(today_sales)}
              </p>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-xl">🧾</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">Bills</p>
                    <p className="text-[20px] font-black text-white">{today_bills}</p>
                  </div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-xl">💰</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">मुनाफा</p>
                    <p className="text-[20px] font-black text-white">₹{fmt(today_profit)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary stats row - Enhanced with gradients */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
            {hasPermission('VIEW_UDHAAR') && (
              <StatCard
                label="उधार बाकी"
                value={`₹${fmt(total_udhaar)}`}
                sub={`${udhaar_count} ग्राहक`}
                gradient="from-red-50 to-rose-100"
                icon="💸"
                href="/udhaar"
              />
            )}
            {hasPermission('VIEW_GST') && (
              <StatCard
                label="GST देना है"
                value={`₹${fmt(gst_payable)}`}
                sub="इस महीने"
                gradient="from-amber-50 to-orange-100"
                icon="📊"
                href="/gst"
              />
            )}
            {hasPermission('VIEW_REPORTS') && (
              <StatCard
                label="इस महीने"
                value={`₹${fmt(month_sales)}`}
                sub={`₹${fmt(month_profit)} profit`}
                gradient="from-green-50 to-emerald-100"
                icon="📈"
                href="/reports"
              />
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            3. जल्दी काम - Quick Actions (industry-aware)
        ══════════════════════════════════════ */}
        {(() => {
          // Primary sale action label adapts: Order for restaurant, Job Card for service/repair, Bill otherwise
          const saleLabel = config.modules?.tableManagement
            ? 'नया Order'
            : config.modules?.serviceJobs
              ? 'Job Card बनाओ'
              : `${term('invoice', 'Bill')} बनाओ`;

          const quickActions = [
            { href: '/sales?open=1&payment=cash',   emoji: config.icon || '🧾', label: saleLabel,         sublabel: term('sale','Sale'),          gradient: 'from-green-50 to-emerald-100',  permission: 'CREATE_INVOICE'   },
            { href: '/sales?open=1&payment=credit',  emoji: '📒',                label: 'उधार दो',         sublabel: 'Credit',                    gradient: 'from-rose-50 to-red-100',       permission: 'CREATE_INVOICE'   },
            { href: '/purchases',                    emoji: '🛒',                label: 'माल खरीदो',       sublabel: term('purchase','Purchase'), gradient: 'from-amber-50 to-orange-100',   permission: 'CREATE_PURCHASE'  },
            { href: '/product',                      emoji: '📦',                label: term('inventory','स्टॉक'), sublabel: term('products','Items'), gradient: 'from-blue-50 to-cyan-100', permission: 'MANAGE_INVENTORY' },
            { href: '/expenses',                     emoji: '💳',                label: 'खर्च लिखो',       sublabel: 'Expenses',                  gradient: 'from-purple-50 to-violet-100',  permission: 'VIEW_EXPENSES'    },
            { href: '/udhaar',                       emoji: '💸',                label: 'पैसे लो',         sublabel: 'Collect',                   gradient: 'from-pink-50 to-rose-100',      permission: 'VIEW_UDHAAR'      },
            { href: '/reports',                      emoji: '📊',                label: 'हिसाब देखो',      sublabel: 'Reports',                   gradient: 'from-slate-50 to-gray-100',     permission: 'VIEW_REPORTS'     },
          ].filter(a => hasPermission(a.permission));
          if (quickActions.length === 0) return null;
          return (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">
                जल्दी काम
              </p>
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
                {quickActions.map(a => (
                  <QuickAction key={a.href} href={a.href} emoji={a.emoji} label={a.label} sublabel={a.sublabel} gradient={a.gradient} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════
            4. ज़रूरी काम - Urgent Tasks Enhanced
        ══════════════════════════════════════ */}
        {hasUrgent && (hasPermission('MANAGE_INVENTORY') || hasPermission('VIEW_UDHAAR')) && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                ⚠️ ज़रूरी काम
              </p>
              {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
                <Link href="/product" className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline">
                  सभी देखें →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {/* Stock alert - Enhanced */}
              {(low_stock > 0 || out_of_stock > 0) && hasPermission('MANAGE_INVENTORY') && (
                <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-amber-200/50 bg-white/50">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                      ⚠️
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-black text-amber-900">
                        {out_of_stock > 0 ? `${out_of_stock} ${term('product','product')} खत्म हो गया` : `${low_stock} ${term('product','product')} कम हो रहा है`}
                      </p>
                      <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                        {out_of_stock > 0 && low_stock > 0
                          ? `${out_of_stock} खत्म • ${low_stock} कम`
                          : out_of_stock > 0
                            ? 'Stock zero है — अभी order करो'
                            : 'जल्दी माल मंगाओ'}
                      </p>
                    </div>
                    <Link href="/product"
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-[11px] font-black text-white hover:bg-amber-700 transition-colors shadow-md"
                    >देखो</Link>
                  </div>

                  {lowStockItems.length > 0 && (
                    <div className="divide-y divide-amber-100">
                      {lowStockItems.map((item, i) => (
                        <div key={item._id || i} className="flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors">
                          <span className="text-[13px] font-bold text-slate-800">{item.name}</span>
                          <span className={`text-[12px] font-black px-3 py-1 rounded-lg shadow-sm ${
                            item.quantity === 0
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}>
                            {item.quantity === 0 ? 'खत्म' : `${item.quantity} बचा`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Udhaar collection - Enhanced */}
              {udhaar_count > 0 && hasPermission('VIEW_UDHAAR') && (
                <div className="rounded-2xl border-2 border-rose-200 bg-white overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-rose-100 bg-gradient-to-br from-rose-50 to-red-50">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                      💸
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-black text-rose-900">
                        {udhaar_count} ग्राहक से पैसे लेने हैं
                      </p>
                      <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                        कुल ₹{fmtD(total_udhaar)} बाकी है
                      </p>
                    </div>
                    <Link href="/udhaar"
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-rose-600 text-[11px] font-black text-white hover:bg-rose-700 transition-colors shadow-md"
                    >सब देखो</Link>
                  </div>

                  {topUdhaarCustomers.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {topUdhaarCustomers.map((c, i) => {
                        const phone = c.phone ? c.phone.replace(/\D/g, '') : '';
                        const msg = buildUdhaarReminder(c, shopName);
                        const waUrl = phone
                          ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
                          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                        return (
                          <div key={c._id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                            {/* Avatar with gradient */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-red-600 flex items-center justify-center text-white font-black text-[14px] flex-shrink-0 shadow-md">
                              {c.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                              {c.phone && <p className="text-[11px] text-slate-500 font-medium">{c.phone}</p>}
                            </div>
                            {/* Due amount */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-[15px] font-black text-rose-600">₹{fmtD(c.due)}</p>
                            </div>
                            {/* WhatsApp button */}
                            <a href={waUrl} target="_blank" rel="noreferrer"
                              className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-[16px] hover:scale-110 transition-all shadow-lg shadow-emerald-500/30"
                              title={`WhatsApp reminder to ${c.name}`}
                            >
                              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.122 1.524 5.861L.057 23.57l5.866-1.54A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.034-1.385l-.361-.214-3.482.914.93-3.393-.235-.373A9.82 9.82 0 012.182 12C2.182 6.566 6.566 2.182 12 2.182S21.818 6.566 21.818 12 17.434 21.818 12 21.818z"/>
                              </svg>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            4b. INDUSTRY-SPECIFIC CALLOUTS
            Shown only when the relevant module is active for this business type.
        ══════════════════════════════════════ */}

        {/* Expiry tracking callout — Pharmacy, Kirana, Grocery, Bakery, etc. */}
        {isEnabled('expiryTracking') && hasPermission('MANAGE_INVENTORY') && (
          <Link href="/product" className="group flex items-center gap-4 px-4 py-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 hover:border-orange-300 hover:-translate-y-0.5 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">⏰</div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-orange-900">Expiry Tracking चालू है</p>
              <p className="text-[12px] text-orange-700 font-medium mt-0.5">{term('products','Products')} की expiry dates check करो — कुछ expire होने वाला हो सकता है</p>
            </div>
            <span className="text-orange-400 text-[18px] flex-shrink-0">→</span>
          </Link>
        )}

        {/* Appointments callout — Salon, Service Center, Repair Shop */}
        {isEnabled('appointments') && hasPermission('CREATE_INVOICE') && (
          <div className="flex items-center gap-4 px-4 py-4 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-md">📅</div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-purple-900">Appointments Mode</p>
              <p className="text-[12px] text-purple-700 font-medium mt-0.5">{term('customer','Client')} के लिए {term('sale','Service')} bill बनाओ और record रखो</p>
            </div>
            <Link href="/sales?open=1&payment=cash" className="flex-shrink-0 px-4 py-2 rounded-xl bg-purple-600 text-[11px] font-black text-white hover:bg-purple-700 transition-colors shadow-md">
              New {term('sale','Service')}
            </Link>
          </div>
        )}

        {/* Table / KOT callout — Restaurant, Dhaba */}
        {isEnabled('tableManagement') && hasPermission('CREATE_INVOICE') && (
          <div className="flex items-center gap-4 px-4 py-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-md">🍽️</div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-orange-900">Restaurant Mode</p>
              <p className="text-[12px] text-orange-700 font-medium mt-0.5">Table number, Dine-in / Takeaway — {term('invoice','Bill')} बनाते समय डालो</p>
            </div>
            <Link href="/sales?open=1&payment=cash" className="flex-shrink-0 px-4 py-2 rounded-xl bg-orange-600 text-[11px] font-black text-white hover:bg-orange-700 transition-colors shadow-md">
              नया Order
            </Link>
          </div>
        )}

        {/* Job Card callout — Automobile, Mobile Shop, Service/Repair */}
        {isEnabled('serviceJobs') && !isEnabled('tableManagement') && hasPermission('CREATE_INVOICE') && (
          <div className="flex items-center gap-4 px-4 py-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-md">🔧</div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-blue-900">Service Jobs Mode</p>
              <p className="text-[12px] text-blue-700 font-medium mt-0.5">Vehicle / Device details, complaint — {term('invoice','Job Card')} में record होगा</p>
            </div>
            <Link href="/sales?open=1&payment=cash" className="flex-shrink-0 px-4 py-2 rounded-xl bg-blue-600 text-[11px] font-black text-white hover:bg-blue-700 transition-colors shadow-md">
              Job Card
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════
            5. MOTIVATIONAL FOOTER - Enhanced Green Theme
        ══════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 px-5 py-4 flex items-center justify-between gap-4 shadow-lg hover:shadow-xl transition-shadow">
          <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-green-300/20 blur-2xl" />
          <div className="relative z-10 flex-1">
            <p className="text-[13px] font-black text-slate-800">
              {today_bills === 0
                ? `आज का पहला ${term('invoice','bill')} बनाओ 💪`
                : today_bills === 1
                  ? `एक ${term('invoice','bill')} हो गया, और करो! 🔥`
                  : `आज ${today_bills} ${term('invoice','bill')} बन गए — बढ़िया! 🎯`}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">
              {shopName} — रखरखाव के साथ
            </p>
          </div>
          {hasPermission('CREATE_INVOICE') && (
            <Link href="/sales"
              className="relative z-10 flex-shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-[13px] font-black text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px transition-all"
            >
              बिल बनाओ →
            </Link>
          )}
        </div>

      </div>
    </Layout>
  );
}