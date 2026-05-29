'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useNotifications } from '../contexts/NotificationContext';

const PRIORITY_COLORS = {
  critical: { bg: '#fff1f2', border: '#fecaca', dot: '#dc2626', text: '#7f1d1d', label: 'Critical' },
  high:     { bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c', text: '#7c2d12', label: 'High'     },
  medium:   { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#78350f', label: 'Medium'   },
  low:      { bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', text: '#14532d', label: 'Low'      },
};

const TYPE_ICONS = {
  low_stock:      '📦',
  out_of_stock:   '🚫',
  expiry_warning: '⏰',
  expired:        '☠️',
  workflow_delay: '⚠️',
  default:        '🔔',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, taskCount, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const preview = notifications.slice(0, 6);
  const totalBadge = unreadCount + taskCount;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications — ${unreadCount} unread`}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: open ? '#f0fdf4' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 20 }}>🔔</span>
        {totalBadge > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: unreadCount > 0 ? '#dc2626' : '#d97706',
            color: '#fff', fontSize: 9, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1, border: '1.5px solid #fff',
          }}>
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 340, maxHeight: 480,
          background: '#fff', borderRadius: 18,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          zIndex: 9999, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a' }}>Alerts</p>
              {unreadCount > 0 && (
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {unreadCount} unread
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {taskCount > 0 && (
                <Link href="/tasks" onClick={() => setOpen(false)}
                  style={{ fontSize: 11, fontWeight: 700, color: '#d97706',
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 8, padding: '3px 8px', textDecoration: 'none' }}>
                  {taskCount} task{taskCount !== 1 ? 's' : ''}
                </Link>
              )}
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  style={{ fontSize: 11, fontWeight: 700, color: '#16a34a',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {preview.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 28, margin: 0 }}>✅</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#64748b', margin: '8px 0 0' }}>
                  All clear — no alerts
                </p>
              </div>
            ) : (
              preview.map(notif => {
                const pc = PRIORITY_COLORS[notif.priority] || PRIORITY_COLORS.low;
                const icon = TYPE_ICONS[notif.type] || TYPE_ICONS.default;
                return (
                  <div
                    key={notif._id}
                    onClick={() => markRead(notif._id)}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 14px',
                      borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                      background: notif.isRead ? '#fff' : pc.bg,
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: notif.isRead ? 600 : 800,
                          color: '#0f172a', lineHeight: 1.35, flex: 1 }}>
                          {notif.title}
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); dismiss(notif._id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 14, color: '#94a3b8', padding: '0 2px', flexShrink: 0 }}
                          aria-label="Dismiss">×</button>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                        {notif.message}
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                          letterSpacing: '0.05em', color: pc.text,
                          background: pc.bg, border: `1px solid ${pc.border}`,
                          borderRadius: 4, padding: '1px 5px',
                        }}>{pc.label}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(notif.createdAt)}</span>
                        {!notif.isRead && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%',
                            background: pc.dot, display: 'inline-block', marginLeft: 2 }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 16px',
            display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Link href="/notifications" onClick={() => setOpen(false)}
              style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textDecoration: 'none' }}>
              See all alerts →
            </Link>
            <span style={{ color: '#e2e8f0' }}>|</span>
            <Link href="/tasks" onClick={() => setOpen(false)}
              style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textDecoration: 'none' }}>
              My tasks →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
