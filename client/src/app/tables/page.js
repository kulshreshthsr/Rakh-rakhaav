'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const DEFAULT_TABLES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','Counter'];

function minutesSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / 60000);
}

function urgencyClass(mins) {
  if (mins > 90) return 'border-red-300 bg-red-50';
  if (mins > 60) return 'border-orange-300 bg-orange-50';
  return 'border-amber-300 bg-amber-50';
}

function urgencyBadgeClass(mins) {
  if (mins > 90) return 'bg-red-500 text-white';
  if (mins > 60) return 'bg-orange-500 text-white';
  return 'bg-amber-500 text-white';
}

export default function TablesPage() {
  const router = useRouter();
  const { businessType } = useIndustry();
  const [occupiedTables, setOccupiedTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(null);
  const [tableConfig, setTableConfig] = useState(DEFAULT_TABLES);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configText, setConfigText] = useState(DEFAULT_TABLES.join('\n'));
  const [shopId, setShopId] = useState('');

  useEffect(() => {
    if (businessType && businessType !== 'restaurant') router.push('/dashboard');
    if (!localStorage.getItem('token')) router.push('/login');
  }, [businessType, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : {};
      const sid = user.shopId || user._id || 'default';
      setShopId(sid);
      const saved = localStorage.getItem(`restaurant_table_config_${sid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTableConfig(parsed);
        setConfigText(parsed.join('\n'));
      }
    } catch {}
  }, []);

  const fetchTableStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/dashboard/table-status'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOccupiedTables(data.occupiedTables || []);
        setAsOf(data.asOf);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchTableStatus();
    const interval = setInterval(fetchTableStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchTableStatus]);

  const saveTableConfig = () => {
    const tables = configText.split('\n').map(t => t.trim()).filter(Boolean);
    setTableConfig(tables);
    if (shopId) localStorage.setItem(`restaurant_table_config_${shopId}`, JSON.stringify(tables));
    setEditingConfig(false);
  };

  const occupiedMap = Object.fromEntries(occupiedTables.map(t => [t.tableNo, t]));
  const freeCount   = tableConfig.filter(t => !occupiedMap[t]).length;

  if (businessType && businessType !== 'restaurant') return null;

  return (
    <Layout>
      <div className="desktop-expand max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/40 p-5 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-300 text-[10px] font-black uppercase tracking-widest text-orange-800">
                🗺️ Table Status
              </span>
              <h1 className="mt-2 text-[22px] font-black text-slate-900">Floor View</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">Live — updates every 60 seconds</p>
              {asOf && <p className="text-[10px] text-slate-400 mt-0.5">Updated: {new Date(asOf).toLocaleTimeString('en-IN')}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={fetchTableStatus} className="px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:border-green-300 transition-all">
                🔄 Refresh
              </button>
              <button onClick={() => setEditingConfig(v => !v)} className="px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:border-blue-300 transition-all">
                ⚙️ Edit Tables
              </button>
            </div>
          </div>

          {/* Summary bar */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[12px] font-black text-red-800">{occupiedTables.length} Occupied</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[12px] font-black text-emerald-800">{freeCount} Free</span>
            </div>
          </div>
        </div>

        {/* Edit table config */}
        {editingConfig && (
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <p className="text-[13px] font-black text-blue-900">Edit Table Names</p>
            <p className="text-[11px] text-blue-600">One table name per line</p>
            <textarea
              className="w-full h-32 px-3 py-2 rounded-xl border-2 border-blue-200 bg-white text-[13px] font-mono focus:outline-none focus:border-blue-500"
              value={configText}
              onChange={e => setConfigText(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={saveTableConfig} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-[12px] font-black hover:bg-blue-700">Save</button>
              <button onClick={() => setEditingConfig(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600">Cancel</button>
            </div>
          </div>
        )}

        {/* Table grid */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {tableConfig.map(tableNo => {
              const occ = occupiedMap[tableNo];
              if (!occ) {
                // Free table
                return (
                  <Link key={tableNo} href={`/sales?open=1&table_no=${encodeURIComponent(tableNo)}`}
                    className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:-translate-y-0.5 hover:shadow-md transition-all text-center"
                  >
                    <span className="text-2xl">🪑</span>
                    <p className="text-[13px] font-black text-emerald-900">{tableNo}</p>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Free</span>
                    <p className="text-[9px] text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">Seat Guests →</p>
                  </Link>
                );
              }
              // Occupied table
              const mins = minutesSince(occ.occupiedSince);
              return (
                <div key={tableNo} className={`flex flex-col gap-1.5 p-3 rounded-2xl border-2 ${urgencyClass(mins)} transition-all`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-black text-slate-900">{tableNo}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${urgencyBadgeClass(mins)}`}>
                      {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60}m`}
                    </span>
                  </div>
                  {occ.orders[0]?.guestName && (
                    <p className="text-[10px] font-bold text-slate-700 truncate">{occ.orders[0].guestName}</p>
                  )}
                  <p className="text-[13px] font-black text-slate-900">₹{fmt(occ.totalAmount)}</p>
                  <p className="text-[9px] text-slate-500">{occ.orders.length} order{occ.orders.length !== 1 ? 's' : ''}</p>
                  <Link href={`/sales?table=${encodeURIComponent(tableNo)}`}
                    className="mt-1 text-center py-1 rounded-lg bg-white/70 text-[10px] font-bold text-slate-700 hover:bg-white transition-colors"
                  >View →</Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
