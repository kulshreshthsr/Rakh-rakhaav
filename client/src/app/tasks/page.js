'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

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
    <div className={`rounded-2xl border-2 p-4 transition-all ${isDone ? 'bg-slate-50 border-slate-200' : `${pc.bg} ${pc.border}`} ${isCancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-black text-slate-900 leading-snug ${isDone ? 'line-through text-slate-400' : ''}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{task.description}</p>
          )}
        </div>
        <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg border ${sc.badge}`}>
          {sm.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded border ${pc.badge}`}>
          {PRIORITY_META[task.priority]?.label || 'Low'}
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
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed'
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: 'manager', priority: 'medium' });
  const [saving, setSaving] = useState(false);

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
      if (status === 'completed') setPendingCount(p => Math.max(0, p - 1));
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

  const activeTasks    = tasks.filter(t => !['completed', 'cancelled'].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const shown = activeTab === 'active' ? activeTasks : completedTasks;

  const TABS = [
    { id: 'active',    label: 'Active',    count: activeTasks.length },
    { id: 'completed', label: 'Completed', count: completedTasks.length },
  ];

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/40 p-6 shadow-lg">
          <div className="pointer-events-none absolute -top-10 -right-8 w-36 h-36 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-black uppercase tracking-widest text-indigo-700 shadow-sm">
                ✅ Tasks
              </span>
              <h1 className="mt-3 text-[24px] font-black text-slate-900">Operational Tasks</h1>
              <p className="mt-1 text-[13px] text-slate-500 font-medium">
                {pendingCount > 0 ? `${pendingCount} pending task${pendingCount !== 1 ? 's' : ''} need attention` : 'All tasks are up to date'}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="relative inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-black text-white bg-gradient-to-r from-indigo-600 to-blue-700 shadow-lg shadow-indigo-500/30 hover:-translate-y-1 hover:shadow-xl transition-all"
            >
              + Add Task
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black transition-all border ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{tab.count}</span>
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
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon mx-auto mb-4 text-[24px]">{activeTab === 'active' ? '✅' : '📋'}</div>
            <p className="text-[14px] font-extrabold text-slate-800">
              {activeTab === 'active' ? 'No active tasks' : 'No completed tasks yet'}
            </p>
            <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
              {activeTab === 'active' ? 'Tasks from business rules will appear here automatically' : 'Completed tasks will be archived here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(task => (
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
                placeholder="Task title"
                value={newTask.title}
                onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-green-400 resize-none"
                placeholder="Description (optional)"
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
      </div>
    </Layout>
  );
}
