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

const PRIORITY_CARD = {
  critical: { border: 'border-red-200',    bg: 'bg-red-50',    badge: 'bg-red-100 text-red-800 border-red-200'         },
  high:     { border: 'border-orange-200', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium:   { border: 'border-amber-200',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-800 border-amber-200'   },
  low:      { border: 'border-green-200',  bg: 'bg-green-50',  badge: 'bg-green-100 text-green-800 border-green-200'   },
};

function NotifCard({ notif, onRead, onDismiss }) {
  const pm   = PRIORITY_META[notif.priority] || PRIORITY_META.low;
  const pc   = PRIORITY_CARD[notif.priority] || PRIORITY_CARD.low;
  const icon = TYPE_ICONS[notif.type] || TYPE_ICONS.default;
  return (
    <div
      onClick={() => !notif.isRead && onRead(notif._id)}
      className={`flex gap-3 px-4 py-4 rounded-2xl border-2 transition-all ${
        notif.isRead
          ? 'bg-white border-slate-200'
          : `${pc.bg} ${pc.border} cursor-pointer hover:-translate-y-0.5 hover:shadow-md`
      }`}
    >
      <span className="text-[22px] flex-shrink-0 leading-none mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[14px] leading-snug ${notif.isRead ? 'font-semibold text-slate-600' : 'font-black text-slate-900'}`}>
            {notif.title}
          </p>
          <button
            onClick={e => { e.stopPropagation(); onDismiss(notif._id); }}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-[18px] font-bold leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
        <p className="mt-1 mb-2 text-[13px] text-slate-500 leading-relaxed">{notif.message}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded border ${pc.badge}`}>
            {pm.label}
          </span>
          {notif.relatedEntity?.name && (
            <span className="text-[11px] text-slate-500 font-semibold">
              {notif.relatedEntity.type === 'product' ? '📦' : '🧾'} {notif.relatedEntity.name}
            </span>
          )}
          <span className="text-[11px] text-slate-400 ml-auto">{fmtDate(notif.createdAt)}</span>
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
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-200 bg-gradient-to-br from-white via-red-50/40 to-orange-50/40 p-6 shadow-lg">
          <div className="pointer-events-none absolute -top-10 -right-8 w-36 h-36 rounded-full bg-red-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-[11px] font-black uppercase tracking-widest text-red-700 shadow-sm">
                🔔 Alerts
              </span>
              <h1 className="mt-3 text-[24px] font-black text-slate-900">Notifications</h1>
              <p className="mt-1 text-[13px] text-slate-500 font-medium">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}` : 'Stock warnings & operational reminders'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-green-200 bg-green-50 text-[13px] font-black text-green-700 hover:bg-green-100 hover:-translate-y-0.5 transition-all shadow-sm"
              >
                ✓ Mark all read
              </button>
            )}
          </div>
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
          <div className="empty-state">
            <div className="empty-state-icon mx-auto mb-4 text-[24px]">✅</div>
            <p className="text-[14px] font-extrabold text-slate-800">All clear</p>
            <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
              No {filter === 'unread' ? 'unread ' : filter === 'critical' ? 'urgent ' : ''}alerts right now — you&apos;re on top of everything
            </p>
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
