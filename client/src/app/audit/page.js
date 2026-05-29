'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { hasPermission } from '../../lib/permissions';

const getToken = () => localStorage.getItem('token');

const ACTION_META = {
  WORKFLOW_ADVANCED:  { icon: '⚡', color: '#7c3aed', label: 'Workflow Advance' },
  INVOICE_CREATED:    { icon: '🧾', color: '#16a34a', label: 'Invoice Created'  },
  STOCK_UPDATED:      { icon: '📦', color: '#d97706', label: 'Stock Updated'    },
  INVOICE_DELETED:    { icon: '🗑️', color: '#dc2626', label: 'Invoice Deleted'  },
  TASK_COMPLETED:     { icon: '✅', color: '#16a34a', label: 'Task Completed'   },
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    if (!hasPermission('VIEW_REPORTS')) { router.push('/dashboard'); return; }
  }, [router]);

  const fetchLogs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const url = entityFilter
        ? apiUrl(`/api/audit?entity=${entityFilter}&limit=100`)
        : apiUrl('/api/audit?limit=100');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load audit logs');
      setLogs(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const ENTITY_TABS = [
    { id: '', label: 'All' },
    { id: 'sale', label: 'Sales' },
    { id: 'product', label: 'Stock' },
    { id: 'task', label: 'Tasks' },
  ];

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        <div>
          <h1 className="text-[22px] font-black text-slate-900 leading-tight">Activity Log</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Who did what and when — last 90 days</p>
        </div>

        {/* Entity filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ENTITY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setEntityFilter(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-black transition-all border ${
                entityFilter === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-[13px] text-red-700 font-semibold">{error}</div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-6 py-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-[15px] font-black text-slate-800">No activity logged yet</p>
            <p className="text-[13px] text-slate-400 mt-1">Actions like workflow transitions and stock updates appear here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-50">
            {logs.map(log => {
              const meta = ACTION_META[log.action] || { icon: '🔹', color: '#64748b', label: log.action };
              return (
                <div key={log._id} className="flex items-start gap-3 px-4 py-3">
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 11, fontWeight: 800, color: meta.color }}>{meta.label}</span>
                      {log.entityName && (
                        <span className="text-[11px] text-slate-500 font-semibold">· {log.entityName}</span>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <span className="text-[11px] text-slate-400">
                          {JSON.stringify(log.details).replace(/[{}"]/g, '').slice(0, 40)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500 font-semibold">{log.username || 'System'}</span>
                      <span className="text-[10px] text-slate-400">{fmtDate(log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
