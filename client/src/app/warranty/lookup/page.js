'use client';
import { useCallback, useState } from 'react';
import Layout from '../../../components/Layout';
import { apiUrl } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const getToken = () => localStorage.getItem('token');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function WarrantyCard({ record, onCreateJob }) {
  const now = new Date();
  const expiry = record.warranty_expiry ? new Date(record.warranty_expiry) : null;
  const isExpired = expiry && expiry < now;
  const daysLeft = expiry ? Math.ceil((expiry - now) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
      {/* Status bar */}
      <div className={`h-1.5 ${isExpired ? 'bg-red-400' : expiringSoon ? 'bg-amber-400' : 'bg-green-400'}`} />
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-black text-slate-900">{record.product_name || '—'}</p>
            <p className="font-mono text-[12px] text-blue-700 font-bold mt-0.5">{record.serial_number}</p>
            {(record.imei_1 || record.imei_number) && (
              <p className="font-mono text-[11px] text-slate-400">IMEI: {record.imei_1 || record.imei_number}</p>
            )}
          </div>
          <div className={`px-2.5 py-1 rounded-xl text-[11px] font-black border ${
            isExpired
              ? 'bg-red-50 border-red-200 text-red-700'
              : expiringSoon
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-green-50 border-green-300 text-green-800'
          }`}>
            {isExpired
              ? '⚠️ Expired'
              : daysLeft !== null
              ? `${daysLeft}d left`
              : 'In Warranty'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Sold On</p>
            <p className="font-bold text-slate-700">{fmtDate(record.sold_at || record.createdAt)}</p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Warranty Ends</p>
            <p className={`font-bold ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
              {fmtDate(record.warranty_expiry)}
            </p>
          </div>
          {record.invoice_number && (
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Invoice</p>
              <p className="font-bold text-slate-700">#{record.invoice_number}</p>
            </div>
          )}
          {(record.color || record.storage) && (
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Variant</p>
              <p className="font-bold text-slate-700">{[record.color, record.storage, record.ram].filter(Boolean).join(' · ')}</p>
            </div>
          )}
        </div>

        {record.customer_name && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400">👤</span>
            <div>
              <p className="text-[13px] font-bold text-slate-800">{record.customer_name}</p>
              {record.customer_phone && <p className="text-[11px] text-slate-400">{record.customer_phone}</p>}
            </div>
          </div>
        )}

        <button
          onClick={() => onCreateJob(record)}
          className="w-full h-10 rounded-xl bg-slate-900 text-white text-[13px] font-black hover:bg-slate-800 transition-colors"
        >
          🔧 Create Service Job
        </button>
      </div>
    </div>
  );
}

export default function WarrantyLookupPage() {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const search = useCallback(async (q) => {
    const s = q.trim();
    if (!s) { setResults(null); return; }
    setLoading(true); setError('');
    try {
      const token = getToken();
      const res = await fetch(apiUrl(`/api/inventory/warranty-lookup?q=${encodeURIComponent(s)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(Array.isArray(data) ? data : (data.serials || []));
    } catch (e) { setError(e.message); setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const createJob = useCallback((record) => {
    const params = new URLSearchParams({
      serial: record.serial_number || '',
      product: record.product_name || '',
      customer: record.customer_name || '',
      phone: record.customer_phone || '',
      invoice: record.invoice_number || '',
    });
    router.push(`/warranty?${params.toString()}`);
  }, [router]);

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 pt-5 pb-28 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/warranty" className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-[16px]">←</Link>
          <div>
            <h1 className="text-[20px] font-black text-slate-900">Warranty Lookup</h1>
            <p className="text-[12px] text-slate-500">Serial number या customer phone से search करें</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <input
            className="flex-1 h-12 px-4 rounded-2xl border-2 border-slate-200 text-[15px] text-slate-900 focus:border-blue-500 focus:outline-none"
            placeholder="Serial / IMEI / customer phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
          <button
            onClick={() => search(query)}
            disabled={loading || !query.trim()}
            className="h-12 px-5 rounded-2xl bg-slate-900 text-white font-black text-[14px] disabled:opacity-40"
          >
            {loading ? '…' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">{error}</div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && results !== null && (
          results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[32px] mb-2">🔍</p>
              <p className="text-[15px] font-black text-slate-600">कोई record नहीं मिला</p>
              <p className="text-[12px] text-slate-400 mt-1">Serial number, IMEI, या 10-digit phone number try करें</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-slate-400">{results.length} result{results.length > 1 ? 's' : ''} मिले</p>
              {results.map((r, i) => (
                <WarrantyCard key={r._id || i} record={r} onCreateJob={createJob} />
              ))}
            </div>
          )
        )}

        {/* Idle state */}
        {!loading && results === null && (
          <div className="text-center py-16 space-y-2">
            <p className="text-[40px]">🔬</p>
            <p className="text-[14px] font-black text-slate-600">Serial / Phone से warranty check करें</p>
            <p className="text-[12px] text-slate-400">
              Invoice number, IMEI, या customer का phone number डालें
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
