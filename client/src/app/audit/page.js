'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { hasPermission } from '../../lib/permissions';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

const getToken = () => localStorage.getItem('token');

const ACTION_META = {
  WORKFLOW_ADVANCED:       { icon: '⚡', color: '#7c3aed', label: 'Workflow Advance'  },
  INVOICE_CREATED:         { icon: '🧾', color: '#16a34a', label: 'Invoice Created'   },
  STOCK_UPDATED:           { icon: '📦', color: '#d97706', label: 'Stock Updated'     },
  INVOICE_DELETED:         { icon: '🗑️', color: '#dc2626', label: 'Invoice Deleted'   },
  TASK_COMPLETED:          { icon: '✅', color: '#16a34a', label: 'Task Completed'    },
  PURCHASE_CREATED:        { icon: '🛒', color: '#d97706', label: 'खरीद बनाई'         },
  PURCHASE_UPDATED:        { icon: '✏️', color: '#d97706', label: 'खरीद बदली'         },
  SALE_RETURN_CREATED:     { icon: '↩️', color: '#dc2626', label: 'Sale Return'       },
  PURCHASE_RETURN_CREATED: { icon: '↩️', color: '#ea580c', label: 'Purchase Return'   },
  USER_LOGIN:              { icon: '🔑', color: '#7c3aed', label: 'Login'             },
  STOCK_ADJUSTED:          { icon: '⚖️', color: '#0369a1', label: 'Stock Adjust'      },
  TASK_CREATED:            { icon: '📋', color: '#16a34a', label: 'काम बनाया'         },
  SETTINGS_UPDATED:        { icon: '⚙️', color: '#475569', label: 'Settings'          },
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function DetailChips({ details }) {
  if (!details || typeof details !== 'object') return null;
  const entries = Object.entries(details);
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 4);
  const extra = entries.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {shown.map(([key, value]) => {
        const isAmount = /amount|total|price/i.test(key);
        const isBadBool = (key === 'deleted' || key === 'cancelled') && value === true;
        let cls = 'bg-slate-100 text-slate-600 border border-slate-200';
        let display = String(value);
        if (isAmount && !isNaN(Number(value))) {
          cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
          display = '₹' + Number(value).toLocaleString('en-IN');
        } else if (isBadBool) {
          cls = 'bg-rose-50 text-rose-700 border border-rose-200';
        }
        return (
          <span key={key} className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
            {key}: {display}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
          +{extra} more
        </span>
      )}
    </div>
  );
}

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return; }
    if (!hasPermission('VIEW_REPORTS')) { router.push('/dashboard'); return; }
  }, [router]);

  const fetchLogs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (entityFilter) params.set('entity', entityFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const url = apiUrl(`/api/audit?${params.toString()}`);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load audit logs');
      setLogs(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const ENTITY_TABS = [
    { id: '', label: 'All' },
    { id: 'sale', label: 'Sales' },
    { id: 'product', label: 'Stock' },
    { id: 'task', label: 'Tasks' },
  ];

  return (
    <Layout>
      <PageShell>
        <PageHeader title="गतिविधि लॉग" subtitle="किसने क्या किया — पिछले 90 दिन" />

        {/* Entity filter tabs */}
        <div className="rr-tab-bar">
          {ENTITY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setEntityFilter(tab.id)}
              className={`rr-tab ${entityFilter === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-[13px] text-red-700 font-semibold">{error}</div>
        ) : logs.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="कोई activity नहीं"
            subtitle="App में कोई भी बदलाव होगा तो उसका record यहाँ रहेगा।"
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {logs.map(log => {
              const meta = ACTION_META[log.action] || { icon: '🔹', color: '#64748b', label: log.action };
              const actionType = log.action?.includes('CREATED') ? 'create' : log.action?.includes('DELETED') ? 'delete' : 'update';
              return (
                <div key={log._id} className="rr-tx-row">
                  <span className="text-[18px]">{meta.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rr-pill ${actionType === 'create' ? 'rr-pill-green' : actionType === 'delete' ? 'rr-pill-rose' : 'rr-pill-blue'}`}>{meta.label}</span>
                      {log.entityName && (
                        <span className="text-[11px] text-slate-500 font-semibold truncate">· {log.entityName}</span>
                      )}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <DetailChips details={log.details} />
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-slate-500 font-semibold">{log.username || 'System'}</span>
                      <span className="text-[10px] text-slate-400">{fmtDate(log.createdAt)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 text-right whitespace-nowrap">{fmtDate(log.createdAt).split(',')[0]}</span>
                </div>
              );
            })}
          </div>
        )}
      </PageShell>
    </Layout>
  );
}
