'use client';

import { useState, useEffect } from 'react';

// ─── Mock data ────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const mockStats = {
  totalRevenue: 284500,
  salesCount: 47,
  grossProfit: 51200,
  gstCollected: 28450,
  gstITC: 18600,
  netGSTPayable: 9850,
};
const mockTopProducts = [
  { name: 'Basmati Rice', qty: 320, revenue: 64000 },
  { name: 'Sarso Tel', qty: 210, revenue: 42000 },
  { name: 'Arhar Dal', qty: 180, revenue: 36000 },
  { name: 'Shakkar', qty: 150, revenue: 22500 },
];
const mockLowStock = [
  { _id: '1', name: 'Chini', quantity: 4 },
  { _id: '2', name: 'Besan', quantity: 2 },
  { _id: '3', name: 'Maida', quantity: 6 },
];
const mockUdhaar = 18400;

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

// ─── Icons ───────────────────────────────────────────────────
const Icon = ({ name, size = 20 }) => {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    sale:     <svg {...s}><path d="M12 2v20"/><path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"/></svg>,
    purchase: <svg {...s}><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7"/></svg>,
    udhaar:   <svg {...s}><path d="M6 3.5h9a3 3 0 0 1 3 3V20.5H9a3 3 0 0 0-3 3"/><path d="M6 3.5v20"/><path d="M9 7.5h6M9 11.5h6M9 15.5h4"/></svg>,
    stock:    <svg {...s}><path d="M12 3 20 7.5 12 12 4 7.5 12 3Z"/><path d="M4 7.5V16.5L12 21l8-4.5V7.5"/><path d="M12 12v9"/></svg>,
    gst:      <svg {...s}><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M7 4.5h10M7 9.5h10M7 14.5h5M16.5 13v7M13.5 16h6"/></svg>,
    star:     <svg {...s}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>,
    warn:     <svg {...s}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>,
    refresh:  <svg {...s}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    premium:  <svg {...s}><path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3.5Z"/></svg>,
  };
  return icons[name] || icons['star'];
};

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ emoji, label, value, note, onClick, accent, delay }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: `2px solid ${accent}22`,
        borderRadius: 20,
        padding: '20px 18px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'transform .18s, box-shadow .18s',
        animationDelay: delay,
        animation: 'slideUp .5s ease both',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${accent}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ position: 'absolute', top: -18, right: -12, fontSize: 64, opacity: .06, pointerEvents: 'none' }}>{emoji}</div>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a1a', letterSpacing: '-.03em', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginTop: 5 }}>{note}</div>
    </button>
  );
}

// ─── Quick Action Card ────────────────────────────────────────
function QuickCard({ icon, label, sub, bg, fg, href, delay }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        background: bg,
        borderRadius: 18,
        padding: '16px 14px',
        textDecoration: 'none',
        transition: 'transform .18s, box-shadow .18s',
        animation: 'slideUp .5s ease both',
        animationDelay: delay,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 10px 30px ${bg}99`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ color: fg, marginBottom: 10 }}><Icon name={icon} size={22} /></div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#666' }}>{sub}</div>
    </a>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function RakhRakhaavDashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isOnline] = useState(true);

  const stats = mockStats;
  const topProducts = mockTopProducts;
  const lowStockProducts = mockLowStock;
  const totalUdhaar = mockUdhaar;

  const profit = stats.grossProfit;
  const revenue = stats.totalRevenue;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
  const netGST = stats.netGSTPayable;
  const progressPct = Math.min(100, Math.abs((profit / (revenue || 1)) * 100));

  return (
    <div style={{ fontFamily: "'Baloo 2', 'Mukta', sans-serif", background: '#f5f3ef', minHeight: '100vh', color: '#1a1a1a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800;900&family=Mukta:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f5f3ef}
        @keyframes slideUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        @keyframes pulse2{0%,100%{opacity:1}50%{opacity:.5}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#f5f3ef}::-webkit-scrollbar-thumb{background:#d1c9b8;border-radius:2px}
        select{appearance:none;-webkit-appearance:none}
        .nav-link{color:#555;font-size:13px;font-weight:700;text-decoration:none;padding:6px 12px;border-radius:10px;transition:background .15s,color .15s}
        .nav-link:hover{background:#fff;color:#e05c2e}
        .progress-track{background:#eee;border-radius:99px;height:10px;overflow:hidden}
        .skeleton{background:linear-gradient(90deg,#ece9e0 25%,#f5f2ea 50%,#ece9e0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:10px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>

      {/* ── TOP NAV ── */}
      <nav style={{ background: '#fff', borderBottom: '2px solid #ede9df', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px #0000000a' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#e05c2e,#f0a500)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏪</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.02em', color: '#e05c2e', lineHeight: 1.1 }}>RakhRakhaav</div>
              <div style={{ fontSize: 10, color: '#999', fontWeight: 600, letterSpacing: '.04em' }}>Aapka Business, Aapke Haath</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <a href="/sales" className="nav-link">💰 Bechna</a>
            <a href="/purchases" className="nav-link">🛒 Kharidna</a>
            <a href="/udhaar" className="nav-link">📒 Udhaar</a>
            <a href="/product" className="nav-link">📦 Maal</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isOnline && <span style={{ background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid #fcd34d' }}>⚠️ Offline</span>}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#e05c2e,#f0a500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>R</div>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* ── HERO HEADER ── */}
        <section style={{ background: 'linear-gradient(135deg,#e05c2e 0%,#f0a500 100%)', borderRadius: 24, padding: '28px 28px', marginBottom: 22, position: 'relative', overflow: 'hidden', animation: 'slideUp .4s ease both' }}>
          <div style={{ position: 'absolute', top: -30, right: -20, fontSize: 160, opacity: .07, pointerEvents: 'none', lineHeight: 1 }}>🏪</div>
          <div style={{ position: 'absolute', bottom: -20, left: 200, fontSize: 100, opacity: .06, pointerEvents: 'none', lineHeight: 1 }}>📊</div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff9', marginBottom: 4 }}>Aapka Dashboard</div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 6 }}>
                Namaskar, Sahab! 🙏
              </h1>
              <p style={{ fontSize: 14, color: '#fff9', fontWeight: 500 }}>
                {MONTHS[selectedMonth - 1]} {selectedYear} ka hisaab-kitaab ready hai
              </p>
            </div>

            {/* Month/Year selectors */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {[
                { val: selectedMonth, set: setSelectedMonth, opts: MONTHS.map((m,i)=>({v:i+1,l:m})) },
                { val: selectedYear, set: setSelectedYear, opts: [2023,2024,2025,2026].map(y=>({v:y,l:y})) },
              ].map((s, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <select
                    value={s.val}
                    onChange={e => s.set(Number(e.target.value))}
                    style={{ background: 'rgba(255,255,255,.2)', border: '1.5px solid rgba(255,255,255,.35)', borderRadius: 12, padding: '8px 32px 8px 14px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: 'inherit' }}
                  >
                    {s.opts.map(o => <option key={o.v} value={o.v} style={{ color: '#1a1a1a', background: '#fff' }}>{o.l}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#fff', fontSize: 10, pointerEvents: 'none' }}>▾</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick summary pills */}
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            {[
              { label: `${stats.salesCount} Invoice`, icon: '🧾' },
              { label: `₹${fmt(totalUdhaar)} Pending`, icon: '⏳' },
              { label: `${margin}% Margin`, icon: '📈' },
              { label: `${mockLowStock.length} Low Stock`, icon: '⚠️' },
            ].map((p, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{p.icon}</span> {p.label}
              </div>
            ))}
          </div>
        </section>

        {/* ── STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 22 }}>
          <StatCard emoji="💰" label="Bikri (Sales)" value={`₹${fmt(revenue)}`} note={`${stats.salesCount} bill is mahine`} accent="#16a34a" delay=".05s" onClick={() => {}} />
          <StatCard emoji="📈" label="Munafa (Profit)" value={`₹${fmt(profit)}`} note={`${margin}% margin mila`} accent="#2563eb" delay=".1s" onClick={() => {}} />
          <StatCard emoji="📒" label="Udhaar Baaki" value={`₹${fmt(totalUdhaar)}`} note="Vasool karna hai" accent="#dc2626" delay=".15s" onClick={() => {}} />
          <StatCard emoji="🧾" label="GST Bharna Hai" value={`₹${fmt(netGST)}`} note="Net payable this month" accent="#d97706" delay=".2s" onClick={() => {}} />
        </div>

        {/* ── QUICK ACTIONS ── */}
        <section style={{ background: '#fff', borderRadius: 22, padding: '22px 20px', marginBottom: 22, border: '2px solid #ede9df', animation: 'slideUp .5s .2s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1a1a1a' }}>⚡ Jaldi Karo</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Sabse zyada kaam aane wale shortcuts</div>
            </div>
            <span style={{ background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99 }}>6 shortcuts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
            <QuickCard icon="sale"     label="Bechna"    sub="Naya bill banao"   bg="#f0fdf4" fg="#16a34a" href="/sales"     delay=".25s" />
            <QuickCard icon="purchase" label="Kharidna"  sub="Maal mangwao"      bg="#fffbeb" fg="#d97706" href="/purchases" delay=".3s"  />
            <QuickCard icon="udhaar"   label="Udhaar"    sub="Hisaab dekho"      bg="#fff1f2" fg="#e11d48" href="/udhaar"   delay=".35s" />
            <QuickCard icon="stock"    label="Maal"      sub="Stock update karo" bg="#eff6ff" fg="#2563eb" href="/product"   delay=".4s"  />
            <QuickCard icon="gst"      label="GST"       sub="Tax ka hisaab"     bg="#f5f3ff" fg="#7c3aed" href="/gst"      delay=".45s" />
            <QuickCard icon="premium"  label="Premium"   sub="Aur features lo"   bg="#fff7ed" fg="#ea580c" href="/pricing"   delay=".5s"  />
          </div>
        </section>

        {/* ── PROFIT BREAKDOWN ── */}
        {revenue > 0 && (
          <section style={{ background: '#fff', borderRadius: 22, padding: '22px 20px', marginBottom: 22, border: '2px solid #ede9df', animation: 'slideUp .5s .3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900 }}>📊 Paise ka Hisaab</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Revenue, munafa aur GST — sab ek jagah</div>
              </div>
              <div style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 12, fontWeight: 800, padding: '6px 14px', borderRadius: 99 }}>Margin {margin}%</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: '💰 Bikri', value: revenue, color: '#16a34a', bg: '#f0fdf4' },
                { label: '📈 Munafa', value: profit, color: '#2563eb', bg: '#eff6ff' },
                { label: '🧾 GST Mila', value: stats.gstCollected, color: '#d97706', bg: '#fffbeb' },
                { label: '✅ ITC Mila', value: stats.gstITC, color: '#0891b2', bg: '#ecfeff' },
                { label: '⚖️ Net GST', value: netGST, color: '#7c3aed', bg: '#f5f3ff' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: item.color, letterSpacing: '-.03em' }}>₹{fmt(item.value)}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', fontWeight: 700, marginBottom: 8 }}>
                <span>Munafa ka ratio</span>
                <span style={{ color: profit >= 0 ? '#16a34a' : '#dc2626' }}>{margin}% margin</span>
              </div>
              <div className="progress-track">
                <div style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: profit >= 0 ? 'linear-gradient(90deg,#16a34a,#0891b2)' : 'linear-gradient(90deg,#dc2626,#ea580c)',
                  borderRadius: 99,
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          </section>
        )}

        {/* ── LOW STOCK WARNING ── */}
        {lowStockProducts.length > 0 && (
          <section
            style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 22, padding: '20px 22px', marginBottom: 22, cursor: 'pointer', transition: 'transform .2s', animation: 'slideUp .5s .35s ease both' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}
            onClick={() => window.location.href = '/product'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#b45309' }}>Maal Khatam Hone Wala Hai!</div>
                </div>
                <div style={{ fontSize: 13, color: '#92400e', marginBottom: 14 }}>
                  {lowStockProducts.length} cheez{lowStockProducts.length > 1 ? 'en hain' : ' hai'} jo jaldi khatam hogi — abhi order karo
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {lowStockProducts.slice(0, 5).map(p => (
                    <span key={p._id} style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', color: '#92400e', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 99 }}>
                      {p.name} ({p.quantity} bacha)
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 20px', borderRadius: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Maal Dekho →
              </div>
            </div>
          </section>
        )}

        {/* ── TOP PRODUCTS ── */}
        <section style={{ background: '#fff', borderRadius: 22, padding: '22px 20px', border: '2px solid #ede9df', animation: 'slideUp .5s .4s ease both' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 900 }}>🏆 Sabse Jyada Bika</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{MONTHS[selectedMonth-1]} {selectedYear} ke top products</div>
          </div>
          {topProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
              Is mahine koi data nahi mila
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map((p, i) => {
                const rankColors = [
                  { bg: 'linear-gradient(135deg,#f59e0b,#fcd34d)', text: '#fff' },
                  { bg: 'linear-gradient(135deg,#94a3b8,#cbd5e1)', text: '#fff' },
                  { bg: 'linear-gradient(135deg,#b45309,#d97706)', text: '#fff' },
                  { bg: 'linear-gradient(135deg,#6366f1,#a5b4fc)', text: '#fff' },
                ];
                const rc = rankColors[i] || rankColors[3];
                const barW = Math.round((p.revenue / topProducts[0].revenue) * 100);
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fafaf8', borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: rc.text, fontSize: 16, flexShrink: 0 }}>
                      {i+1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', marginBottom: 5 }}>{p.name}</div>
                      <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${barW}%`, height: '100%', background: 'linear-gradient(90deg,#e05c2e,#f0a500)', borderRadius: 99, transition: 'width 1.2s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{p.qty} unit bika</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#16a34a', flexShrink: 0 }}>₹{fmt(p.revenue)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── FOOTER NOTE ── */}
        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
          RakhRakhaav · Kanpur ke vyapariyon ka apna app 🏪 · Made with ❤️ in India
        </div>

      </div>
    </div>
  );
}