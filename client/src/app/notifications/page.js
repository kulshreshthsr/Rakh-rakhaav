'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useNotifications } from '../../contexts/NotificationContext';

const getToken = () => localStorage.getItem('token');

const PRIORITY_META = {
  critical: { bg: '#fff1f2', border: '#fecaca', dot: '#dc2626', text: '#7f1d1d', label: 'Critical', sort: 0 },
  high:     { bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c', text: '#7c2d12', label: 'High',     sort: 1 },
  medium:   { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#78350f', label: 'Medium',   sort: 2 },
  low:      { bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', text: '#14532d', label: 'Low',      sort: 3 },
};

const TYPE_ICONS = {
  low_stock: '📦', out_of_stock: '🚫', expiry_warning: '⏰',
  expired: '☠️', workflow_delay: '⚠️', default: '🔔',
};

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  const diff = Math.floor((now - dt) / 86400000);
  if (diff === 0) return 'Today ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Yesterday ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function NotifCard({ notif, onRead, onDismiss }) {
  const pm = PRIORITY_META[notif.priority] || PRIORITY_META.low;
  const icon = TYPE_ICONS[notif.type] || TYPE_ICONS.default;
  return (
    <div
      onClick={() => !notif.isRead && onRead(notif._id)}
      style={{
        display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 14,
        background: notif.isRead ? '#fff' : pm.bg,
        border: `1px solid ${notif.isRead ? '#e2e8f0' : pm.border}`,
        cursor: notif.isRead ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.3 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: notif.isRead ? 600 : 800, color: '#0f172a', lineHeight: 1.35 }}>
            {notif.title}
          </p>
          <button
            onClick={e => { e.stopPropagation(); onDismiss(notif._id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, padding: 0, flexShrink: 0, lineHeight: 1 }}
            aria-label="Dismiss">×</button>
        </div>
        <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{notif.message}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: pm.text, background: pm.bg, border: `1px solid ${pm.border}`,
            borderRadius: 5, padding: '2px 7px',
          }}>{pm.label}</span>
          {notif.relatedEntity?.name && (
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              {notif.relatedEntity.type === 'product' ? '📦' : '🧾'} {notif.relatedEntity.name}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{fmtDate(notif.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, dismiss, refresh } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'critical'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
  }, [router]);

  const filtered = notifications
    .filter(n => {
      if (filter === 'unread') return !n.isRead;
      if (filter === 'critical') return ['critical', 'high'].includes(n.priority);
      return true;
    })
    .sort((a, b) => {
      const pa = PRIORITY_META[a.priority]?.sort ?? 3;
      const pb = PRIORITY_META[b.priority]?.sort ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const TABS = [
    { id: 'all',      label: 'All',      count: notifications.length },
    { id: 'unread',   label: 'Unread',   count: unreadCount },
    { id: 'critical', label: 'Urgent',   count: notifications.filter(n => ['critical','high'].includes(n.priority)).length },
  ];

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black text-slate-900 leading-tight">Alerts</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Business alerts, stock warnings & operational reminders</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[12px] font-black text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 hover:bg-green-100 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black transition-all border ${
                filter === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-6 py-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-[15px] font-black text-slate-800">All clear</p>
            <p className="text-[13px] text-slate-400 mt-1">No {filter === 'unread' ? 'unread ' : filter === 'critical' ? 'urgent ' : ''}alerts right now</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(notif => (
              <NotifCard
                key={notif._id}
                notif={notif}
                onRead={markRead}
                onDismiss={dismiss}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
