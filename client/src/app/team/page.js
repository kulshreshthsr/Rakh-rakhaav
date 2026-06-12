'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import PermissionGuard from '../../components/PermissionGuard';
import { apiUrl } from '../../lib/api';
import { SYSTEM_ROLES, getRoleColor, getRoleLabel } from '../../lib/permissions';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import { useIndustry } from '../../contexts/IndustryContext';
import { getSuggestedRoles } from '../../lib/roleConfig';
import { useAppLocale } from '../../components/AppLocale';

/* ─── Helpers ─────────────────────────────────────────────────────── */
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '');

const authFetch = (url, opts = {}) =>
  fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) } });

/* ─── Small reusable atoms ─────────────────────────────────────────── */
function RoleBadge({ role, color }) {
  const pillMap = { owner: 'rr-pill-green', manager: 'rr-pill-blue', accountant: 'rr-pill-violet', cashier: 'rr-pill-amber', viewer: 'rr-pill-slate' };
  return (
    <span className={`rr-pill ${pillMap[role] || 'rr-pill-slate'}`}>
      {getRoleLabel(role)}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

const INPUT = 'h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all';

/* ─── Add Member Modal ─────────────────────────────────────────────── */
function AddMemberModal({ open, roles, onClose, onCreated, defaultRole }) {
  const initialRole = defaultRole || 'cashier';
  const [form, setForm] = useState({ name: '', username: '', password: '', role: initialRole });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdPassword, setCreatedPassword] = useState('');

  const reset = () => { setForm({ name: '', username: '', password: '', role: defaultRole || 'cashier' }); setError(''); setCreatedPassword(''); };

  useEffect(() => { if (!open) reset(); }, [open, defaultRole, reset]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim()) { setError('Name and username are required'); return; }
    setSaving(true); setError('');
    try {
      const res = await authFetch(apiUrl('/api/rbac/team'), {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), username: form.username.trim(), password: form.password || undefined, role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to create member'); return; }
      setCreatedPassword(data.tempPassword || '');
      onCreated(data.member);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  if (createdPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-green-200 w-full max-w-md p-7">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl shadow-lg">✓</div>
            <h2 className="text-[20px] font-black text-slate-900">Team Member Added!</h2>
            <p className="text-[13px] text-slate-500">Share these credentials securely with your team member.</p>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2">
              <div className="flex justify-between text-[13px]"><span className="text-slate-500">Username</span><span className="font-bold text-slate-900">{form.username}</span></div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-slate-500">Temp Password</span>
                <span className="font-mono font-black text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200 select-all">{createdPassword}</span>
              </div>
            </div>
            <p className="text-[11px] text-rose-500 font-semibold">Ask them to change this password after first login.</p>
            <button onClick={() => { reset(); onClose(); }} className="w-full h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-green-200 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-[18px] font-black text-slate-900">Add Team Member</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">New team member for your shop</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700 font-semibold">{error}</div>}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Full Name *</label>
            <input className={INPUT} placeholder="e.g. Rahul Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Username *</label>
            <input className={INPUT} placeholder="e.g. rahul123" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password <span className="text-slate-300">(leave blank to auto-generate)</span></label>
            <input className={INPUT} type="text" placeholder="Optional — will be auto-generated" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Role *</label>
            <select className={INPUT} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-[14px] hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Creating…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Member Modal ─────────────────────────────────────────────── */
function EditMemberModal({ member, roles, onClose, onUpdated, onReset }) {
  const [form, setForm] = useState({ name: member.name, role: member.role, isActive: member.isActive });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(apiUrl(`/api/rbac/team/${member._id}`), {
        method: 'PUT',
        body: JSON.stringify({ name: form.name, role: form.role, isActive: form.isActive }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to update'); return; }
      onUpdated(data.member);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(apiUrl(`/api/rbac/team/${member._id}/reset-password`), { method: 'POST', body: '{}' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to reset'); return; }
      setResetPassword(data.tempPassword || '');
      setShowResetConfirm(false);
      onReset();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  if (resetPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-green-200 w-full max-w-md p-7 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl">🔑</div>
          <h2 className="text-[18px] font-black text-slate-900">Password Reset</h2>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-[12px] text-slate-400 mb-2">New temporary password for {member.name}</p>
            <span className="font-mono font-black text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200 select-all text-[16px]">{resetPassword}</span>
          </div>
          <p className="text-[11px] text-rose-500 font-semibold">Ask them to change this after logging in.</p>
          <button onClick={onClose} className="w-full h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-green-200 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-[18px] font-black text-slate-900">{member.name}</h2>
            <p className="text-[12px] text-slate-400">@{member.username}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700 font-semibold">{error}</div>}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
            <input className={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Role</label>
            <select className={INPUT} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {roles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
            <div>
              <p className="text-[13px] font-bold text-slate-800">Account Status</p>
              <p className="text-[11px] text-slate-400">Disabled members cannot log in</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-12 h-6 rounded-full transition-all ${form.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.isActive ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="pt-1">
            {!showResetConfirm ? (
              <button onClick={() => setShowResetConfirm(true)} className="w-full h-10 rounded-xl border border-amber-200 text-amber-700 font-bold text-[13px] bg-amber-50 hover:bg-amber-100 transition-all">
                🔑 Reset Password
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-[13px] hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={handleReset} disabled={saving} className="flex-1 h-10 rounded-xl bg-amber-500 text-white font-black text-[13px] hover:bg-amber-600 transition-all disabled:opacity-50">Confirm Reset</button>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-[14px] hover:bg-slate-50 transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function TeamPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const { config } = useIndustry();
  const suggestedRoles = getSuggestedRoles(config);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addDefaultRole, setAddDefaultRole] = useState(null);
  const [editMember, setEditMember] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [teamRes, rolesRes] = await Promise.all([
        authFetch(apiUrl('/api/rbac/team')),
        authFetch(apiUrl('/api/rbac/roles')),
      ]);
      if (teamRes.status === 401) { router.push('/login'); return; }
      if (teamRes.status === 403) { setError('Access denied. Only the shop owner can manage team members.'); setLoading(false); return; }
      const teamData = await teamRes.json();
      const rolesData = rolesRes.ok ? await rolesRes.json() : { roles: [] };
      setMembers(teamData.members || []);
      // Filter out owner from selectable roles in UI
      setRoles((rolesData.roles || []).filter(r => r.name !== 'owner'));
    } catch { setError('Failed to load team data'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm(t('team_del_confirm'))) return;
    setDeletingId(id);
    try {
      const res = await authFetch(apiUrl(`/api/rbac/team/${id}`), { method: 'DELETE' });
      if (res.ok) setMembers(m => m.filter(x => x._id !== id));
    } catch { alert('Failed to remove member'); }
    finally { setDeletingId(null); }
  };

  const selectableRoles = roles.length > 0 ? roles : Object.entries(SYSTEM_ROLES)
    .filter(([k]) => k !== 'owner')
    .map(([name, meta]) => ({ name, label: meta.label }));

  return (
    <Layout>
      <PermissionGuard permission="MANAGE_USERS" redirect="/dashboard">
        <div className="max-w-3xl mx-auto space-y-6 py-6 px-1">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-green-700 mb-1">Settings</p>
              <PageHeader title={t('team_title')} subtitle={t('team_subtitle')} />
            </div>
            <button
              onClick={() => { setAddDefaultRole(null); setShowAdd(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white font-black text-[14px] shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 whitespace-nowrap"
            >
              + Add Member
            </button>
          </div>

          {/* Role legend */}
          <div className="flex flex-wrap gap-2">
            {selectableRoles.map(r => (
              <RoleBadge key={r.name} role={r.name} color={r.color} />
            ))}
          </div>

          {/* Business role suggestion cards */}
          {suggestedRoles.length > 0 && (
            <div className="bg-white rounded-2xl border border-green-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-green-100 bg-green-50/40">
                <p className="text-[13px] font-black text-slate-800">Quick Setup</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click to add a team member with the right role pre-selected</p>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {suggestedRoles.map((sr, i) => (
                  <button
                    key={`${sr.role}-${i}`}
                    onClick={() => { setAddDefaultRole(sr.role); setShowAdd(true); }}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50/60 text-left transition-all group"
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{sr.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-900 leading-tight">{sr.businessLabel}</p>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{sr.description}</p>
                      <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleColor(sr.role).bg} ${getRoleColor(sr.role).text} ${getRoleColor(sr.role).border}`}>
                        {getRoleLabel(sr.role)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-5 py-4 rounded-2xl bg-rose-50 border border-rose-200 text-[14px] text-rose-700 font-semibold">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && members.length === 0 && (
            <EmptyState
              emoji="👨‍💼"
              title={t('team_empty_title')}
              subtitle={t('team_empty_sub')}
              actionLabel={t('team_add_btn')}
              onAction={() => setShowAdd(true)}
            />
          )}

          {/* Member cards */}
          {!loading && members.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-green-100/60 bg-green-50/30">
                <p className="text-[14px] font-black text-slate-900">All Members</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {members.map(m => (
                  <div key={m._id} className="rr-list-row">
                    <div className="rr-avatar rr-avatar-sm bg-gradient-to-br from-green-600 to-emerald-700">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-black text-slate-900">{m.name}</span>
                        <RoleBadge role={m.role} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[12px] text-slate-400">@{m.username}</span>
                        <StatusDot active={m.isActive} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditMember(m)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-100 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m._id)}
                        disabled={deletingId === m._id}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-[12px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all disabled:opacity-50"
                      >
                        {deletingId === m._id ? '…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles management link */}
          <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-green-200 bg-green-50/50 hover:border-green-300 transition-colors cursor-pointer" onClick={() => router.push('/roles')}>
            <div>
              <p className="text-[14px] font-black text-slate-900">Manage Roles & Permissions</p>
              <p className="text-[12px] text-slate-400">Create custom roles and assign permissions</p>
            </div>
            <span className="text-green-600 text-lg">→</span>
          </div>
        </div>

        {showAdd && (
          <AddMemberModal
            open={showAdd}
            roles={selectableRoles}
            onClose={() => { setShowAdd(false); setAddDefaultRole(null); }}
            onCreated={(m) => { setMembers(prev => [m, ...prev]); }}
            defaultRole={addDefaultRole}
          />
        )}

        {editMember && (
          <EditMemberModal
            member={editMember}
            roles={selectableRoles}
            onClose={() => setEditMember(null)}
            onUpdated={(updated) => { setMembers(prev => prev.map(m => m._id === updated._id ? updated : m)); setEditMember(null); }}
            onReset={() => {}}
          />
        )}
      </PermissionGuard>
    </Layout>
  );
}
