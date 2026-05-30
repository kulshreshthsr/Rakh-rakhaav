'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const emptyForm = () => ({
  clientName: '', clientPhone: '', packageName: '', serviceName: '',
  serviceId: '', totalSessions: 10, pricePaid: '', validUntil: '',
});

export default function MembershipsPage() {
  const router = useRouter();
  const { businessType } = useIndustry();
  const [memberships, setMemberships] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [stylists, setStylists] = useState([]);
  const [redeemNotes, setRedeemNotes] = useState('');
  const [redeemStylist, setRedeemStylist] = useState('');

  useEffect(() => {
    if (businessType && businessType !== 'salon') router.push('/dashboard');
    if (!localStorage.getItem('token')) router.push('/login');
  }, [businessType, router]);

  const fetchMemberships = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/memberships?status=${statusFilter}`), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setMemberships(await res.json());
    } catch {} finally { setLoading(false); }
  }, [statusFilter]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json(); setProducts(Array.isArray(d) ? d : d.products || []); }
    } catch {}
  }, []);

  const fetchStylists = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/stylists'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setStylists(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchMemberships(); }, [fetchMemberships]);
  useEffect(() => { fetchProducts(); fetchStylists(); }, [fetchProducts, fetchStylists]);

  const handleSell = async () => {
    if (!form.clientName || !form.serviceName || !form.pricePaid) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/memberships'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, totalSessions: Number(form.totalSessions), pricePaid: Number(form.pricePaid) }),
      });
      if (res.ok) { setShowSellModal(false); setForm(emptyForm()); fetchMemberships(); }
    } catch {} finally { setSubmitting(false); }
  };

  const handleRedeem = async (m) => {
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/memberships/${m._id}/redeem`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ notes: redeemNotes, stylistId: redeemStylist || undefined }),
      });
      if (res.ok) { setShowRedeemModal(null); setRedeemNotes(''); setRedeemStylist(''); fetchMemberships(); }
    } catch {} finally { setSubmitting(false); }
  };

  const filtered = memberships.filter(m => {
    const q = search.toLowerCase();
    return !q || m.clientName.toLowerCase().includes(q) || m.clientPhone.includes(q) || m.packageName.toLowerCase().includes(q);
  });

  if (businessType && businessType !== 'salon') return null;

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">

        {/* Header */}
        <div className="rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-white via-teal-50/40 to-cyan-50/40 p-5 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-300 text-[10px] font-black uppercase tracking-widest text-teal-800">💳 Memberships</span>
              <h1 className="mt-2 text-[22px] font-black text-slate-900">Packages & Memberships</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">{filtered.length} {statusFilter} packages</p>
            </div>
            <button onClick={() => { setForm(emptyForm()); setShowSellModal(true); }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 text-white text-[13px] font-black shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 transition-all">
              + Sell Package
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            placeholder="Search client name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2">
            {['active', 'all', 'completed'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${statusFilter === f ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}
              >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
        </div>

        {/* Membership cards */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">💳</p>
            <p className="font-black text-[15px] text-slate-700">No {statusFilter} memberships</p>
            <button onClick={() => { setForm(emptyForm()); setShowSellModal(true); }} className="mt-4 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-[13px] font-black hover:bg-teal-700">Sell First Package</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(m => {
              const remaining = m.totalSessions - m.usedSessions;
              const pct = Math.round((m.usedSessions / m.totalSessions) * 100);
              const expired = m.validUntil && new Date() > new Date(m.validUntil);
              return (
                <div key={m._id} className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3 hover:border-teal-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-black text-slate-900">{m.clientName}</p>
                      <p className="text-[11px] text-slate-500">📞 {m.clientPhone}</p>
                    </div>
                    {!m.isActive ? (
                      remaining <= 0
                        ? <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">✅ Complete</span>
                        : expired
                          ? <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">⏰ Expired</span>
                          : null
                    ) : (
                      <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200">Active</span>
                    )}
                  </div>

                  <div>
                    <p className="text-[13px] font-bold text-slate-800">{m.packageName}</p>
                    <p className="text-[11px] text-slate-500">{m.serviceName}</p>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>{m.usedSessions}/{m.totalSessions} sessions used</span>
                      <span>{remaining} remaining</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Paid: ₹{fmt(m.pricePaid)}</span>
                    <span>Purchased: {new Date(m.purchasedAt).toLocaleDateString('en-IN')}</span>
                    {m.validUntil && <span>Valid till: {new Date(m.validUntil).toLocaleDateString('en-IN')}</span>}
                  </div>

                  <div className="flex gap-2">
                    {m.isActive && remaining > 0 && !expired && (
                      <button onClick={() => { setShowRedeemModal(m); setRedeemNotes(''); setRedeemStylist(''); }}
                        className="flex-1 py-2 rounded-xl bg-teal-600 text-white text-[11px] font-black hover:bg-teal-700 transition-colors">
                        Redeem 1 Session
                      </button>
                    )}
                    <button onClick={() => setShowHistoryModal(m)}
                      className="flex-1 py-2 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                      View History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sell Package Modal */}
      {showSellModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-[18px] font-black text-slate-900">Sell Package</h3>
              <button onClick={() => setShowSellModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {[['Client Name *', 'clientName', 'text', 'Meena Sharma'], ['Client Phone *', 'clientPhone', 'tel', '9876543210'], ['Package Name *', 'packageName', 'text', '10-Session Facial Package']].map(([label, key, type, ph]) => (
                <div key={key}><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</p>
                  <input type={type} className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} /></div>
              ))}
              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Service *</p>
                <select className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500"
                  value={form.serviceId} onChange={e => { const p = products.find(x => x._id === e.target.value); setForm(prev => ({ ...prev, serviceId: e.target.value, serviceName: p?.name || '' })); }}>
                  <option value="">— Select service —</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Sessions *</p>
                  <input type="number" className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500" value={form.totalSessions} onChange={e => setForm(p => ({ ...p, totalSessions: e.target.value }))} min="1" /></div>
                <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Price Paid (₹) *</p>
                  <input type="number" className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500" value={form.pricePaid} onChange={e => setForm(p => ({ ...p, pricePaid: e.target.value }))} placeholder="8000" /></div>
              </div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Valid Until (optional)</p>
                <input type="date" className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} /></div>
            </div>
            <div className="p-5 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleSell} disabled={submitting || !form.clientName || !form.serviceName || !form.pricePaid}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-black text-[14px] shadow-lg shadow-teal-500/30 disabled:opacity-60 hover:-translate-y-0.5 transition-all"
              >{submitting ? 'Creating...' : 'Create Package'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Session Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4">
            <h3 className="text-[18px] font-black text-slate-900">Redeem 1 Session</h3>
            <p className="text-[13px] text-slate-600">
              Redeeming for <strong>{showRedeemModal.clientName}</strong> — {showRedeemModal.totalSessions - showRedeemModal.usedSessions - 1} sessions remaining after this
            </p>
            <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Stylist</p>
              <select className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500" value={redeemStylist} onChange={e => setRedeemStylist(e.target.value)}>
                <option value="">— Select stylist —</option>
                {stylists.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Notes</p>
              <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-teal-500" value={redeemNotes} onChange={e => setRedeemNotes(e.target.value)} placeholder="Any notes..." /></div>
            <div className="flex gap-3">
              <button onClick={() => setShowRedeemModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600">Cancel</button>
              <button onClick={() => handleRedeem(showRedeemModal)} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-[13px] font-black disabled:opacity-60 hover:bg-teal-700"
              >{submitting ? '...' : 'Confirm Redemption'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Usage History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl max-h-[80dvh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-[16px] font-black text-slate-900">Usage History</h3>
              <button onClick={() => setShowHistoryModal(null)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {showHistoryModal.usageLog?.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No sessions redeemed yet</p>
              ) : (
                (showHistoryModal.usageLog || []).map((log, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-[12px] font-bold text-slate-800">Session {i + 1}</p>
                      <p className="text-[10px] text-slate-500">{new Date(log.usedAt).toLocaleDateString('en-IN')}</p>
                      {log.notes && <p className="text-[10px] text-slate-500">{log.notes}</p>}
                    </div>
                    <span className="text-[11px] font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">✓</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
