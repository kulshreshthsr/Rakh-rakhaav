'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';

const getToken = () => localStorage.getItem('token');
const getUser  = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };
const fmtDate  = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const SCHEDULE_BADGE = {
  'Schedule X':  'bg-red-100 text-red-800 border-red-200',
  'Schedule H1': 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function NarcoticsPage() {
  const router = useRouter();
  const { businessType } = useIndustry();

  const [entries,     setEntries]     = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [pages,       setPages]       = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [summary,     setSummary]     = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [error,       setError]       = useState('');

  // Filters
  const [from,      setFrom]      = useState('');
  const [to,        setTo]        = useState('');
  const [schedule,  setSchedule]  = useState('');
  const [search,    setSearch]    = useState('');
  const [applied,   setApplied]   = useState({});

  // Void modal
  const [voidEntry,    setVoidEntry]    = useState(null);
  const [voidReason,   setVoidReason]   = useState('');
  const [voidLoading,  setVoidLoading]  = useState(false);

  const isOwner = !getUser()?.isSubUser;

  const fetchEntries = useCallback(async (filters = {}, pg = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: pg, limit: 50, ...filters });
      const res = await fetch(apiUrl(`/api/narcotics?${params}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
    } catch {
      setError('Could not load narcotics register');
    }
    setLoading(false);
  }, [router]);

  const fetchSummary = useCallback(async () => {
    try {
      const now = new Date();
      const params = new URLSearchParams({ month: now.getMonth() + 1, year: now.getFullYear() });
      const res = await fetch(apiUrl(`/api/narcotics/summary?${params}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    fetchEntries({}, 1);
  }, [fetchEntries, router]);

  const applyFilters = () => {
    const f = {};
    if (from)     f.from     = from;
    if (to)       f.to       = to;
    if (schedule) f.schedule = schedule;
    if (search)   f.search   = search;
    setApplied(f);
    fetchEntries(f, 1);
  };

  const clearFilters = () => {
    setFrom(''); setTo(''); setSchedule(''); setSearch('');
    setApplied({});
    fetchEntries({}, 1);
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) return;
    setVoidLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/narcotics/${voidEntry._id}/void`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setEntries(prev => prev.map(e => e._id === voidEntry._id ? { ...e, isVoided: true, voidReason, voidedAt: new Date().toISOString() } : e));
        setVoidEntry(null); setVoidReason('');
      } else {
        setError(data.message || 'Void failed');
      }
    } catch {
      setError('Server error');
    }
    setVoidLoading(false);
  };

  const hasFilters = Object.keys(applied).length > 0;

  if (businessType && businessType !== 'pharmacy') {
    return (
      <Layout>
        <div className="desktop-expand max-w-2xl mx-auto px-3 pt-8 pb-28 text-center">
          <p className="text-[15px] font-black text-slate-700">Narcotics Register is only available for Pharmacy accounts.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900 via-red-800 to-slate-900 px-5 py-5 shadow-xl">
          <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-red-400/15 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded-lg bg-red-500/30 text-red-200 text-[10px] font-black uppercase tracking-widest border border-red-400/30">🔒 Immutable Record</span>
            </div>
            <h1 className="text-[22px] font-black text-white leading-tight">Narcotics &amp; Schedule X Register</h1>
            <p className="text-[12px] text-red-200 mt-1 font-medium">Drugs &amp; Cosmetics Act — Mandatory Dispensing Log</p>
          </div>
        </div>

        {/* Legal Notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <span className="text-base flex-shrink-0">⚖️</span>
          <p className="text-[11px] text-red-700 leading-relaxed font-medium">
            यह रजिस्टर Drugs &amp; Cosmetics Act, 1940 के Schedule X के अंतर्गत अनिवार्य है।
            सभी entries immutable हैं — delete नहीं हो सकती, केवल void हो सकती है।
            Government inspection के लिए हमेशा available रहनी चाहिए।
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700">⚠️ {error}</div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-md space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">From</p>
              <input type="date" className="h-10 w-full px-3 rounded-xl border-2 border-slate-200 text-[13px] focus:outline-none focus:border-green-600"
                value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">To</p>
              <input type="date" className="h-10 w-full px-3 rounded-xl border-2 border-slate-200 text-[13px] focus:outline-none focus:border-green-600"
                value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <select className="h-10 flex-1 px-3 rounded-xl border-2 border-slate-200 text-[13px] text-slate-700 focus:outline-none focus:border-green-600"
              value={schedule} onChange={e => setSchedule(e.target.value)}>
              <option value="">All Schedules</option>
              <option value="Schedule X">Schedule X (Narcotics)</option>
              <option value="Schedule H1">Schedule H1</option>
            </select>
            <input className="h-10 flex-1 px-3 rounded-xl border-2 border-slate-200 text-[13px] placeholder-slate-400 focus:outline-none focus:border-green-600"
              placeholder="Search drug, patient, Rx, invoice..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={applyFilters}
              className="flex-1 h-10 rounded-xl bg-green-600 text-white text-[13px] font-black hover:bg-green-700 transition-colors">
              Apply Filters
            </button>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-4 h-10 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                Clear
              </button>
            )}
            <button
              onClick={() => { if (!showSummary) fetchSummary(); setShowSummary(v => !v); }}
              className="px-4 h-10 rounded-xl border-2 border-red-200 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 transition-colors">
              {showSummary ? 'Hide Summary' : 'Monthly Summary'}
            </button>
          </div>
        </div>

        {/* Monthly Summary */}
        {showSummary && summary && (
          <div className="bg-white rounded-2xl border-2 border-amber-200 p-4 space-y-3">
            <div>
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Monthly Summary — {summary.month}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">For drug inspector presentation — aggregate dispensing by molecule</p>
            </div>
            {summary.summary.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-4">No dispensing this month</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 text-slate-500 font-bold">Drug</th>
                      <th className="text-left py-2 text-slate-500 font-bold">Schedule</th>
                      <th className="text-right py-2 text-slate-500 font-bold">Total Qty</th>
                      <th className="text-right py-2 text-slate-500 font-bold">Dispensings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.summary.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 font-semibold text-slate-900">{row._id.drugName}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${SCHEDULE_BADGE[row._id.schedule] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {row._id.schedule}
                          </span>
                        </td>
                        <td className="py-2 text-right font-black text-slate-900">{row.totalQty}</td>
                        <td className="py-2 text-right text-slate-500">{row.dispensingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Stats Bar */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] font-bold text-slate-500">
            {total} {total === 1 ? 'entry' : 'entries'} {hasFilters ? '(filtered)' : 'total'}
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => fetchEntries(applied, page - 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 disabled:opacity-40">
                ← Prev
              </button>
              <span className="text-[12px] text-slate-500">{page}/{pages}</span>
              <button disabled={page === pages} onClick={() => fetchEntries(applied, page + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 disabled:opacity-40">
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Register Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-5xl mb-3">🔒</p>
            <p className="text-[14px] font-black text-slate-700">No entries found</p>
            <p className="text-[12px] text-slate-400 mt-1">Schedule X/H1 dispensings will appear here automatically</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry._id}
                className={`bg-white rounded-2xl border overflow-hidden ${entry.isVoided ? 'border-red-200 opacity-70' : 'border-slate-200'} shadow-sm`}
              >
                {entry.isVoided && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
                    <span className="text-[11px] font-black text-red-700 line-through">VOIDED</span>
                    <span className="text-[10px] text-red-600">Reason: {entry.voidReason}</span>
                    <span className="text-[10px] text-red-400 ml-auto">{fmtDate(entry.voidedAt)}</span>
                  </div>
                )}
                <div className={`p-4 ${entry.isVoided ? 'line-through opacity-60' : ''}`}>
                  {/* Row 1: Date + Invoice + Schedule badge */}
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div>
                      <span className="font-mono text-[12px] font-black text-green-700">{entry.invoiceNumber}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(entry.dispensedAt)}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${SCHEDULE_BADGE[entry.schedule] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {entry.schedule}
                    </span>
                  </div>

                  {/* Row 2: Drug info */}
                  <div className="mb-2">
                    <p className="text-[15px] font-black text-slate-900">{entry.drugName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Qty: <strong>{entry.quantityDispensed} {entry.unit}</strong>
                      {entry.batchNumber && <> · Batch: <strong>{entry.batchNumber}</strong></>}
                    </p>
                  </div>

                  {/* Row 3: Patient + Doctor + Rx */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Patient</span>
                      <p className="text-slate-800 font-semibold">{entry.patientName}</p>
                      {entry.patientPhone && <p className="text-slate-400">{entry.patientPhone}</p>}
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Doctor</span>
                      <p className="text-slate-800 font-semibold">{entry.prescribingDoctor || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Rx No.</span>
                      <p className="font-mono text-slate-800 font-semibold">{entry.prescriptionNumber || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Dispensed By</span>
                      <p className="text-slate-600">{entry.dispensedBy || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Void button — owners only, not already voided */}
                {isOwner && !entry.isVoided && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => { setVoidEntry(entry); setVoidReason(''); }}
                      className="w-full py-2 rounded-xl border border-red-200 bg-red-50 text-[11px] font-bold text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Void Entry (reason required)
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Void Confirmation Modal */}
      {voidEntry && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">Void Entry</p>
              <p className="text-[16px] font-black text-slate-900 mt-1">{voidEntry.drugName}</p>
              <p className="text-[12px] text-slate-500">{voidEntry.invoiceNumber} · {fmtDate(voidEntry.dispensedAt)}</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <p className="text-[11px] text-red-700 font-semibold">
                ⚠️ This entry will be marked VOIDED but NEVER deleted. Void reason is mandatory and immutable.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Reason for Voiding *</p>
              <textarea
                className="w-full h-20 px-3 py-2 rounded-xl border-2 border-slate-200 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-400 resize-none"
                placeholder="Data entry error, duplicate entry, etc."
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim() || voidLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-[13px] font-black hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {voidLoading ? 'Voiding...' : 'Confirm Void'}
              </button>
              <button
                onClick={() => { setVoidEntry(null); setVoidReason(''); }}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
