'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

const getToken = () => localStorage.getItem('token');
const fmt  = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Greeting based on time ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'शुभ प्रभात 🌅';
  if (h < 17) return 'नमस्ते 🙏';
  if (h < 20) return 'शुभ संध्या 🌇';
  return 'शुभ रात्रि 🌙';
}

/* ── Hindi day/date ── */
function getTodayLabel() {
  return new Date().toLocaleDateString('hi-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ── WhatsApp reminder message ── */
function buildUdhaarReminder(customer, shopName) {
  return `Namaste ${customer.name} ji 🙏\n\nHamari dukaan *${shopName || 'Rakh-Rakhaav'}* se aapka udhaar baaki hai:\n\n*₹${fmtD(customer.due)}*\n\nKripya jald se jald payment karein.\n\nDhanyawad 🙏`;
}

/* ── Quick action card ── */
function QuickAction({ href, emoji, label, sublabel, color }) {
  return (
    <Link href={href}
      className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 ${color} text-center hover:-translate-y-1 hover:shadow-lg transition-all active:scale-95`}
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-[14px] font-black text-slate-900 leading-tight">{label}</span>
      {sublabel && <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{sublabel}</span>}
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState('');
  const [userName, setUserName] = useState('');
  const [greeting] = useState(getGreeting);
  const [today]    = useState(getTodayLabel);

  /* ── Fetch dashboard data ── */
  const fetchDashboard = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const [dashRes, shopRes] = await Promise.all([
        fetch(apiUrl('/api/dashboard'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/auth/shop'),  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.status === 401) { router.push('/login'); return; }
      const dashData = await dashRes.json();
      const shopData = await shopRes.json();
      setData(dashData);
      setShopName(shopData.name || 'मेरी दुकान');
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(user.name || '');
    fetchDashboard();
  }, [fetchDashboard, router]);

  /* ── Derived values ── */
  const today_sales   = data?.today?.revenue        || 0;
  const today_bills   = data?.today?.bills           || 0;
  const today_profit  = data?.today?.profit          || 0;
  const month_sales   = data?.month?.revenue         || 0;
  const month_profit  = data?.month?.profit          || 0;
  const total_udhaar  = data?.udhaar?.totalDue       || 0;
  const udhaar_count  = data?.udhaar?.pendingCount   || 0;
  const gst_payable   = data?.gst?.netPayable        || 0;
  const low_stock     = data?.stock?.lowStockCount   || 0;
  const out_of_stock  = data?.stock?.outOfStockCount || 0;

  /* Top udhaar customers (people who owe YOU money) */
  const topUdhaarCustomers = (data?.udhaar?.topCustomers || []).slice(0, 5);

  /* Low stock items */
  const lowStockItems = (data?.stock?.lowStockItems || []).slice(0, 4);

  /* ── Skeleton loader ── */
  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">
          {[80, 120, 160, 120].map((h, i) => (
            <div key={i} className={`h-${h === 80 ? '20' : h === 120 ? '28' : h === 160 ? '36' : '28'} rounded-2xl bg-white border border-slate-200 animate-pulse`}
              style={{ height: h }} />
          ))}
        </div>
      </Layout>
    );
  }

  const hasUrgent = udhaar_count > 0 || low_stock > 0 || out_of_stock > 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* ══════════════════════════════════════
            1. GREETING HEADER
        ══════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-5">
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-blue-500/10 blur-2xl" />

          <div className="relative z-10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{today}</p>
            <h1 className="text-[22px] font-black text-white leading-tight">
              {greeting}
            </h1>
            {userName && (
              <p className="text-[14px] text-slate-300 mt-0.5">
                {userName} — <span className="text-cyan-400 font-bold">{shopName}</span>
              </p>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            2. आज का हाल  (Today's snapshot)
        ══════════════════════════════════════ */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 px-1">
            आज का हाल
          </p>

          {/* Big today revenue card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 p-5 mb-3 shadow-lg shadow-cyan-500/20">
            <div className="pointer-events-none absolute -top-8 right-4 w-32 h-32 rounded-full bg-white/10" />
            <div className="relative z-10">
              <p className="text-[12px] font-bold text-white/70 uppercase tracking-wider mb-1">आज की कमाई</p>
              <p className="text-[38px] font-black text-white leading-none tracking-tight">
                ₹{fmt(today_sales)}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider">Bills</p>
                  <p className="text-[18px] font-black text-white">{today_bills}</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider">मुनाफा</p>
                  <p className="text-[18px] font-black text-white">₹{fmt(today_profit)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                label: 'उधार बाकी',
                value: `₹${fmt(total_udhaar)}`,
                sub: `${udhaar_count} ग्राहक`,
                bg: 'bg-rose-50 border-rose-200',
                val: 'text-rose-700',
                href: '/udhaar',
              },
              {
                label: 'GST देना है',
                value: `₹${fmt(gst_payable)}`,
                sub: 'इस महीने',
                bg: 'bg-amber-50 border-amber-200',
                val: 'text-amber-700',
                href: '/gst',
              },
              {
                label: 'इस महीने',
                value: `₹${fmt(month_sales)}`,
                sub: `₹${fmt(month_profit)} profit`,
                bg: 'bg-emerald-50 border-emerald-200',
                val: 'text-emerald-700',
                href: '/reports',
              },
            ].map((s) => (
              <Link key={s.label} href={s.href}
                className={`${s.bg} border rounded-2xl p-3 hover:-translate-y-0.5 hover:shadow-md transition-all`}
              >
                <p className={`text-[17px] font-black leading-none ${s.val}`}>{s.value}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide leading-tight">{s.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            3. जल्दी काम  (Quick Actions)
        ══════════════════════════════════════ */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 px-1">
            जल्दी काम
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            <QuickAction
              href="/sales?open=1&payment=cash"
              emoji="🧾"
              label="बिल बनाओ"
              sublabel="Cash Sale"
              color="border-cyan-200 bg-cyan-50"
            />
            <QuickAction
              href="/sales?open=1&payment=credit"
              emoji="📒"
              label="उधार दो"
              sublabel="Credit Sale"
              color="border-rose-200 bg-rose-50"
            />
            <QuickAction
              href="/purchases"
              emoji="🛒"
              label="माल खरीदो"
              sublabel="Purchase"
              color="border-amber-200 bg-amber-50"
            />
            <QuickAction
              href="/product"
              emoji="📦"
              label="स्टॉक देखो"
              sublabel="Inventory"
              color="border-emerald-200 bg-emerald-50"
            />
            <QuickAction
              href="/udhaar"
              emoji="💸"
              label="पैसे लो"
              sublabel="Collect"
              color="border-purple-200 bg-purple-50"
            />
            <QuickAction
              href="/reports"
              emoji="📊"
              label="हिसाब देखो"
              sublabel="Reports"
              color="border-slate-200 bg-slate-50"
            />
          </div>
        </div>

        {/* ══════════════════════════════════════
            4. ज़रूरी काम  (Urgent tasks)
            Only shown when there's something
        ══════════════════════════════════════ */}
        {hasUrgent && (
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                ज़रूरी काम
              </p>
              {(low_stock > 0 || out_of_stock > 0) && (
                <Link href="/product" className="text-[11px] font-bold text-amber-600 hover:underline">
                  सभी देखें →
                </Link>
              )}
            </div>

            <div className="space-y-2.5">
              {/* Stock alert */}
              {(low_stock > 0 || out_of_stock > 0) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-100">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="text-[13px] font-black text-amber-900">
                        {out_of_stock > 0 ? `${out_of_stock} product खत्म हो गया` : `${low_stock} product कम हो रहा है`}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        {out_of_stock > 0 && low_stock > 0
                          ? `${out_of_stock} खत्म • ${low_stock} कम`
                          : out_of_stock > 0
                            ? 'Stock zero है — अभी order करो'
                            : 'जल्दी माल मंगाओ'}
                      </p>
                    </div>
                    <Link href="/product"
                      className="ml-auto px-3 py-1.5 rounded-xl bg-amber-200 text-[11px] font-black text-amber-900 hover:bg-amber-300 transition-colors flex-shrink-0"
                    >देखो</Link>
                  </div>

                  {/* Low stock items preview */}
                  {lowStockItems.length > 0 && (
                    <div className="divide-y divide-amber-100">
                      {lowStockItems.map((item, i) => (
                        <div key={item._id || i} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[13px] font-semibold text-slate-800">{item.name}</span>
                          <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg ${
                            item.quantity === 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.quantity === 0 ? 'खत्म' : `${item.quantity} बचा`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Udhaar collection */}
              {udhaar_count > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-rose-100 bg-rose-50">
                    <span className="text-2xl">💸</span>
                    <div>
                      <p className="text-[13px] font-black text-rose-900">
                        {udhaar_count} ग्राहक से पैसे लेने हैं
                      </p>
                      <p className="text-[11px] text-rose-700">
                        कुल ₹{fmtD(total_udhaar)} बाकी है
                      </p>
                    </div>
                    <Link href="/udhaar"
                      className="ml-auto px-3 py-1.5 rounded-xl bg-rose-100 text-[11px] font-black text-rose-800 hover:bg-rose-200 transition-colors flex-shrink-0"
                    >सब देखो</Link>
                  </div>

                  {topUdhaarCustomers.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {topUdhaarCustomers.map((c, i) => {
                        const phone = c.phone ? c.phone.replace(/\D/g, '') : '';
                        const msg   = buildUdhaarReminder(c, shopName);
                        const waUrl = phone
                          ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
                          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                        return (
                          <div key={c._id || i} className="flex items-center gap-3 px-4 py-3">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-black text-[13px] flex-shrink-0">
                              {c.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-900 truncate">{c.name}</p>
                              {c.phone && <p className="text-[11px] text-slate-400">{c.phone}</p>}
                            </div>
                            {/* Due amount */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-[14px] font-black text-rose-600">₹{fmtD(c.due)}</p>
                            </div>
                            {/* WhatsApp button */}
                            <a href={waUrl} target="_blank" rel="noreferrer"
                              className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-[16px] hover:bg-emerald-600 hover:scale-105 transition-all shadow-md shadow-emerald-500/25"
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
            5. MOTIVATIONAL FOOTER STRIP
            Small but powerful — builds habit
        ══════════════════════════════════════ */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-black text-slate-800">
              {today_bills === 0
                ? 'आज का पहला bill बनाओ 💪'
                : today_bills === 1
                  ? 'एक bill हो गया, और करो! 🔥'
                  : `आज ${today_bills} bill बन गए — बढ़िया! 🎯`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {shopName} — रखरखाव के साथ
            </p>
          </div>
          <Link href="/sales"
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-[12px] font-black text-white shadow-md hover:-translate-y-px hover:shadow-lg transition-all"
          >
            बिल बनाओ →
          </Link>
        </div>

      </div>
    </Layout>
  );
}