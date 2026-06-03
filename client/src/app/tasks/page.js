'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

const getToken = () => localStorage.getItem('token');

const PRIORITY_META = {
  critical: { bg: '#fff1f2', border: '#fecaca', dot: '#dc2626', text: '#7f1d1d', label: 'Critical' },
  high:     { bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c', text: '#7c2d12', label: 'High'     },
  medium:   { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#78350f', label: 'Medium'   },
  low:      { bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', text: '#14532d', label: 'Low'      },
};

const STATUS_META = {
  pending:     { label: 'Pending',     color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  completed:   { label: 'Completed',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  cancelled:   { label: 'Cancelled',   color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const ROLE_LABELS = {
  owner: 'Owner', manager: 'Manager', cashier: 'Staff',
  accountant: 'Accountant', viewer: 'Viewer',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const PRIORITY_CARD = {
  critical: { border: 'border-red-200',    bg: 'bg-red-50',     badge: 'bg-red-100 text-red-800 border-red-200'       },
  high:     { border: 'border-orange-200', bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium:   { border: 'border-amber-200',  bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-800 border-amber-200'  },
  low:      { border: 'border-green-200',  bg: 'bg-green-50',   badge: 'bg-green-100 text-green-800 border-green-200'  },
};
const STATUS_CARD = {
  pending:     { badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  in_progress: { badge: 'bg-blue-100 text-blue-800 border-blue-200'   },
  completed:   { badge: 'bg-green-100 text-green-800 border-green-200' },
  cancelled:   { badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function TaskCard({ task, onUpdate }) {
  const pc = PRIORITY_CARD[task.priority] || PRIORITY_CARD.low;
  const sc = STATUS_CARD[task.status]     || STATUS_CARD.pending;
  const sm = STATUS_META[task.status]     || STATUS_META.pending;
  const [updating, setUpdating] = useState(false);

  const advance = async (newStatus) => {
    setUpdating(true);
    await onUpdate(task._id, newStatus);
    setUpdating(false);
  };

  const isDone = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';

  return (
    <div className={`rr-list-row flex-col items-start transition-all ${isCancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${isDone ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-white'}`} />
          <div className="min-w-0">
            <p className={`text-[14px] font-black text-slate-900 leading-snug ${isDone ? 'line-through text-slate-400' : ''}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{task.description}</p>
            )}
          </div>
        </div>
        <span className={`flex-shrink-0 rr-pill ${task.priority === 'critical' ? 'rr-pill-rose' : task.priority === 'high' ? 'rr-pill-amber' : task.priority === 'medium' ? 'rr-pill-blue' : 'rr-pill-green'}`}>
          {PRIORITY_META[task.priority]?.label || 'Low'}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap pl-7">
        <span className={`rr-pill ${task.status === 'completed' ? 'rr-pill-green' : task.status === 'in_progress' ? 'rr-pill-blue' : task.status === 'cancelled' ? 'rr-pill-slate' : 'rr-pill-amber'}`}>
          {sm.label}
        </span>
        <span className="text-[11px] text-slate-400 font-semibold">
          → {ROLE_LABELS[task.assignedTo] || task.assignedTo}
        </span>
        {task.relatedEntity?.name && (
          <span className="text-[11px] text-slate-500 font-semibold">· {task.relatedEntity.name}</span>
        )}
        <span className="text-[11px] text-slate-400 ml-auto">{fmtDate(task.createdAt)}</span>
      </div>

      {/* Action buttons */}
      {!['completed', 'cancelled'].includes(task.status) && (
        <div className="flex gap-2 mt-3">
          {task.status === 'pending' && (
            <button
              onClick={() => advance('in_progress')}
              disabled={updating}
              className="text-[11px] font-black px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {updating ? '…' : 'Start'}
            </button>
          )}
          <button
            onClick={() => advance('completed')}
            disabled={updating}
            className="text-[11px] font-black px-3 py-1.5 rounded-xl border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            {updating ? '…' : '✓ Done'}
          </button>
          <button
            onClick={() => advance('cancelled')}
            disabled={updating}
            className="text-[11px] font-black px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50 ml-auto"
          >
            {updating ? '…' : 'Cancel'}
          </button>
        </div>
      )}
      {isDone && task.completedBy && (
        <p className="mt-2 text-[11px] font-semibold text-emerald-600">
          ✓ Done by {task.completedBy} · {fmtDate(task.completedAt)}
        </p>
      )}
    </div>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: 'manager', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!success) return undefined;
    const id = setTimeout(() => setSuccess(''), 2400);
    return () => clearTimeout(id);
  }, [success]);

  const fetchTasks = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/tasks?limit=100'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load tasks');
      const { tasks: data, pendingCount: pc } = await res.json();
      setTasks(data || []);
      setPendingCount(pc || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleUpdate = useCallback(async (id, status) => {
    const token = getToken();
    const res = await fetch(apiUrl(`/api/tasks/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks(prev => prev.map(t => t._id === id ? updated : t));
      if (status === 'completed') {
        setPendingCount(p => Math.max(0, p - 1));
        setSuccess('✅ काम पूरा हुआ');
      }
    }
  }, []);

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    setSaving(true);
    const token = getToken();
    try {
      const res = await fetch(apiUrl('/api/tasks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        const t = await res.json();
        setTasks(prev => [t, ...prev]);
        setPendingCount(p => p + 1);
        setShowAddModal(false);
        setNewTask({ title: '', description: '', assignedTo: 'manager', priority: 'medium' });
      }
    } finally {
      setSaving(false);
    }
  };

  const STATUS_TABS = [
    { id: 'all',       label: 'सब' },
    { id: 'pending',   label: 'बाकी' },
    { id: 'completed', label: 'पूरे हुए' },
  ];

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === 'pending') return ['pending', 'in_progress'].includes(t.status);
    if (statusFilter === 'completed') return t.status === 'completed';
    return true;
  });

  const emptyIcon = statusFilter === 'completed' ? '✅' : '📋';
  const emptyTitle = statusFilter === 'completed' ? 'अभी कोई पूरा काम नहीं' : 'कोई काम नहीं';
  const emptySubtitle = statusFilter === 'completed'
    ? 'काम पूरे होने पर यहाँ दिखेंगे'
    : 'नया काम नीचे दिए फ़ॉर्म से जोड़ें';

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title="काम की सूची"
          subtitle="ज़रूरी काम — प्राथमिकता के अनुसार"
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-indigo-600 to-blue-700 shadow-lg shadow-indigo-500/30 hover:-translate-y-1 hover:shadow-xl transition-all"
            >
              + नया काम
            </button>
          }
        />

        {/* Success / error banner */}
        {(error || success) && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-semibold ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {error ? '⚠️' : '✅'} {error || success}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="rr-tab-bar">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rr-tab ${statusFilter === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="skeleton-card border border-slate-200/60 h-24" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            emoji="✅"
            title="कोई task नहीं है"
            subtitle="Low stock reorder और workflow tasks यहाँ automatically दिखते हैं।"
          />
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <TaskCard key={task._id} task={task} onUpdate={handleUpdate} />
            ))}
          </div>
        )}

        {/* Add Task Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-black text-slate-900">New Task</p>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
              </div>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] font-semibold focus:outline-none focus:border-green-400"
                placeholder="काम का नाम"
                value={newTask.title}
                onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-green-400 resize-none"
                placeholder="विवरण (वैकल्पिक)"
                rows={2}
                value={newTask.description}
                onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">Assign To</p>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-semibold focus:outline-none focus:border-green-400"
                    value={newTask.assignedTo}
                    onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
                  >
                    <option value="manager">Manager</option>
                    <option value="cashier">Staff / Cashier</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">Priority</p>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-semibold focus:outline-none focus:border-green-400"
                    value={newTask.priority}
                    onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={saving || !newTask.title.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Task'}
              </button>
            </div>
          </div>
        )}
      </PageShell>
    </Layout>
  );
}
