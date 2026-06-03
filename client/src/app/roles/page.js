'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import PermissionGuard from '../../components/PermissionGuard';
import { apiUrl } from '../../lib/api';
import { getRoleColor } from '../../lib/permissions';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

/* ─── Helpers ─────────────────────────────────────────────────────── */
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '');
const authFetch = (url, opts = {}) =>
  fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) } });

/* ─── Permission groups for UI ─────────────────────────────────────── */
const PERMISSION_GROUPS = {
  'Dashboard':    ['VIEW_DASHBOARD'],
  'Inventory':    ['MANAGE_INVENTORY'],
  'Sales':        ['CREATE_INVOICE', 'VIEW_SALES', 'MANAGE_SALES'],
  'Purchases':    ['CREATE_PURCHASE', 'VIEW_PURCHASES', 'MANAGE_PURCHASES'],
  'Expenses':     ['VIEW_EXPENSES', 'MANAGE_EXPENSES'],
  'Income':       ['VIEW_INCOME', 'MANAGE_INCOME'],
  'Bank':         ['VIEW_BANK', 'MANAGE_BANK'],
  'Reports':      ['VIEW_REPORTS'],
  'GST':          ['VIEW_GST'],
  'Udhaar':       ['VIEW_UDHAAR', 'MANAGE_UDHAAR'],
  'Customers':    ['MANAGE_CUSTOMERS'],
  'Suppliers':    ['MANAGE_SUPPLIERS'],
  'User Management': ['MANAGE_USERS', 'MANAGE_ROLES'],
};

const PERM_LABELS = {
  VIEW_DASHBOARD:    'Dashboard देखें',
  MANAGE_INVENTORY:  'Stock manage करें',
  CREATE_INVOICE:    'Invoice बनाएँ',
  VIEW_SALES:        'Sales देखें',
  MANAGE_SALES:      'Sales manage करें',
  CREATE_PURCHASE:   'Purchase बनाएँ',
  VIEW_PURCHASES:    'Purchases देखें',
  MANAGE_PURCHASES:  'Purchases manage करें',
  VIEW_EXPENSES:     'खर्च देखें',
  MANAGE_EXPENSES:   'खर्च manage करें',
  VIEW_INCOME:       'आय देखें',
  MANAGE_INCOME:     'आय manage करें',
  VIEW_BANK:         'Bank देखें',
  MANAGE_BANK:       'Bank manage करें',
  VIEW_REPORTS:      'Reports देखें',
  VIEW_GST:          'GST देखें',
  VIEW_UDHAAR:       'उधार देखें',
  MANAGE_UDHAAR:     'उधार manage करें',
  MANAGE_CUSTOMERS:  'Customers manage करें',
  MANAGE_SUPPLIERS:  'Suppliers manage करें',
  MANAGE_USERS:      'Users manage करें',
  MANAGE_ROLES:      'Roles manage करें',
};

const COLORS = ['green', 'blue', 'purple', 'orange', 'slate', 'rose', 'amber'];

/* ─── Role Badge ─────────────────────────────────────────────────────── */
function RoleBadge({ label, color, isSystem }) {
  const c = getRoleColor(null, color);
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {label}
      {isSystem && <span className="text-[10px] opacity-60">●</span>}
    </span>
  );
}

/* ─── Permission Checkbox Grid ─────────────────────────────────────── */
function PermissionGrid({ selected, onChange, disabled = false }) {
  const toggle = (perm) => {
    if (disabled) return;
    const next = selected.includes(perm) ? selected.filter(p => p !== perm) : [...selected, perm];
    onChange(next);
  };

  const toggleGroup = (perms) => {
    if (disabled) return;
    const allSelected = perms.every(p => selected.includes(p));
    const next = allSelected
      ? selected.filter(p => !perms.includes(p))
      : [...new Set([...selected, ...perms])];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
        const allOn = perms.every(p => selected.includes(p));
        const someOn = perms.some(p => selected.includes(p));
        return (
          <div key={group} className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(perms)}
              disabled={disabled}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${disabled ? 'cursor-default' : 'hover:bg-green-50/50'} ${allOn ? 'bg-green-50/40' : 'bg-slate-50/50'}`}
            >
              <span className="text-[13px] font-black text-slate-800">{group}</span>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${allOn ? 'bg-green-600 border-green-600' : someOn ? 'bg-green-200 border-green-400' : 'border-slate-300'}`}>
                {allOn && <span className="text-white text-[10px] font-black">✓</span>}
                {someOn && !allOn && <span className="text-green-700 text-[10px] font-black">—</span>}
              </span>
            </button>
            <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {perms.map(perm => (
                <label key={perm} className={`flex items-center gap-3 cursor-pointer group ${disabled ? 'cursor-default' : ''}`}>
                  <span
                    onClick={() => toggle(perm)}
                    className={`w-4.5 h-4.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${selected.includes(perm) ? 'bg-green-600 border-green-600' : 'border-slate-300 group-hover:border-green-400'}`}
                  >
                    {selected.includes(perm) && <span className="text-white text-[10px] font-black">✓</span>}
                  </span>
                  <span className="text-[13px] text-slate-700" onClick={() => toggle(perm)}>{PERM_LABELS[perm] || perm}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Create Role Modal ─────────────────────────────────────────────── */
function CreateRoleModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('blue');
  const [permissions, setPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!open) { setName(''); setLabel(''); setColor('blue'); setPermissions([]); setError(''); } }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !label.trim()) { setError('Name and label are required'); return; }
    setSaving(true); setError('');
    try {
      const res = await authFetch(apiUrl('/api/rbac/roles'), {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), label: label.trim(), permissions, color }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to create role'); return; }
      onCreated(data.role);
      onClose();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-green-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-[18px] font-black text-slate-900">Create Custom Role</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Define a role with specific permissions</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto p-6 space-y-5 flex-1">
            {error && <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700 font-semibold">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Role ID (slug) *</label>
                <input
                  className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all"
                  placeholder="e.g. store-manager"
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                />
                <p className="text-[11px] text-slate-400">Lowercase, no spaces. Used internally.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Display Label *</label>
                <input
                  className="h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all"
                  placeholder="e.g. Store Manager"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Badge Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => {
                  const cc = getRoleColor(null, c);
                  return (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all ${cc.bg} ${cc.text} ${cc.border} ${color === c ? 'ring-2 ring-offset-1 ring-green-500 scale-105' : ''}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Permissions ({permissions.length} selected)</label>
              <PermissionGrid selected={permissions} onChange={setPermissions} />
            </div>
          </div>
          <div className="flex gap-3 px-6 py-5 border-t border-slate-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-[14px] hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Role Panel ─────────────────────────────────────────────── */
function EditRolePanel({ role, onClose, onUpdated, onDeleted }) {
  const [permissions, setPermissions] = useState(role.permissions || []);
  const [label, setLabel] = useState(role.label);
  const [color, setColor] = useState(role.color || 'green');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setPermissions(role.permissions || []);
    setLabel(role.label);
    setColor(role.color || 'green');
    setError('');
  }, [role]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(apiUrl(`/api/rbac/roles/${role._id}`), {
        method: 'PUT',
        body: JSON.stringify({ label, permissions, color }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to update role'); return; }
      onUpdated(data.role);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('क्या आप यह भूमिका हटाना चाहते हैं? यह action वापस नहीं होगा।')) return;
    setSaving(true);
    try {
      const res = await authFetch(apiUrl(`/api/rbac/roles/${role._id}`), { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Cannot delete role'); setShowDeleteConfirm(false); return; }
      onDeleted(role._id);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-green-100/60 bg-green-50/30">
        <div className="flex items-center gap-3">
          <RoleBadge label={label} color={color} isSystem={role.isSystem} />
          {role.isSystem && <span className="text-[11px] text-slate-400 font-semibold">System Role (read-only)</span>}
        </div>
        <button onClick={onClose} className="text-[12px] font-bold text-slate-400 hover:text-slate-700 transition-colors">✕ Close</button>
      </div>
      <div className="p-5 space-y-5">
        {error && <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700 font-semibold">{error}</div>}

        {!role.isSystem && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Display Label</label>
              <input
                className="h-10 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Badge Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.slice(0, 5).map(c => {
                  const cc = getRoleColor(null, c);
                  return (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${cc.bg} ${cc.border} ${color === c ? 'ring-2 ring-green-500 scale-110' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Permissions — {role.isSystem ? `${permissions.length} (system defaults)` : `${permissions.length} selected`}
          </label>
          <PermissionGrid selected={permissions} onChange={setPermissions} disabled={role.isSystem} />
        </div>

        {!role.isSystem && (
          <div className="flex items-center gap-3 pt-2">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-[13px] font-bold bg-rose-50 hover:bg-rose-100 transition-all">
                Delete Role
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={handleDelete} disabled={saving} className="px-3 py-2 rounded-xl bg-rose-600 text-white text-[13px] font-black hover:bg-rose-700 transition-all disabled:opacity-50">Confirm Delete</button>
              </div>
            )}
            <div className="flex-1" />
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(apiUrl('/api/rbac/roles'));
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 403) { setError('Access denied. Only users with role management permission can view this page.'); setLoading(false); return; }
      const data = await res.json();
      setRoles(data.roles || []);
    } catch { setError('Failed to load roles'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleUpdated = (updatedRole) => {
    setRoles(prev => prev.map(r => r._id === updatedRole._id ? { ...r, ...updatedRole } : r));
    setSelectedRole(prev => prev?._id === updatedRole._id ? { ...prev, ...updatedRole } : prev);
  };

  const handleDeleted = (id) => {
    setRoles(prev => prev.filter(r => r._id !== id));
    setSelectedRole(null);
  };

  const handleCreated = (role) => {
    setRoles(prev => [...prev, { ...role, memberCount: 0 }]);
    setSelectedRole({ ...role, memberCount: 0 });
  };

  return (
    <Layout>
      <PermissionGuard permission="MANAGE_ROLES" redirect="/dashboard">
        <div className="max-w-4xl mx-auto space-y-6 py-6 px-1">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-green-700 mb-1">Settings</p>
              <PageHeader title="भूमिकाएँ" subtitle="टीम के लिए permission sets" />
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => router.push('/team')} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-[13px] hover:bg-slate-50 transition-all">
                Team Members
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                + New Role
              </button>
            </div>
          </div>

          {error && (
            <div className="px-5 py-4 rounded-2xl bg-rose-50 border border-rose-200 text-[14px] text-rose-700 font-semibold">{error}</div>
          )}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Role list */}
              <div className="lg:col-span-1 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">All Roles</p>
                {roles.map(role => {
                  const c = getRoleColor(role.name, role.color);
                  const isSelected = selectedRole?._id === role._id || selectedRole?.name === role.name;
                  return (
                    <button
                      key={role._id || role.name}
                      onClick={() => setSelectedRole(isSelected ? null : role)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? `border-green-400 shadow-md ${c.bg}` : 'border-slate-200 bg-white hover:border-green-200'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-black ${c.bg} ${c.text}`}>
                          {role.label.charAt(0)}
                        </span>
                        <div>
                          <p className="text-[14px] font-black text-slate-900">{role.label}</p>
                          <p className="text-[11px] text-slate-400">{role.permissions?.length || 0} permissions</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {role.isSystem && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">System</span>}
                        {role.memberCount > 0 && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{role.memberCount} user{role.memberCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {roles.length === 0 && (
                  <EmptyState
                    emoji="🛡️"
                    title="कोई custom role नहीं"
                    subtitle="अपनी दुकान के लिए custom roles बनाएं — cashier, manager, staff।"
                    actionLabel="Role बनाएं"
                    onAction={() => document.getElementById('create-role-form')?.scrollIntoView({ behavior: 'smooth' })}
                  />
                )}
              </div>

              {/* Role editor */}
              <div className="lg:col-span-2">
                {selectedRole ? (
                  <EditRolePanel
                    key={selectedRole._id || selectedRole.name}
                    role={selectedRole}
                    onClose={() => setSelectedRole(null)}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ) : (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-center p-8 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-2xl">🛡️</div>
                    <p className="text-[15px] font-black text-slate-700">Select a role to edit permissions</p>
                    <p className="text-[12px] text-slate-400">System roles are read-only. Custom roles can be fully configured.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showCreate && (
          <CreateRoleModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
        )}
      </PermissionGuard>
    </Layout>
  );
}
