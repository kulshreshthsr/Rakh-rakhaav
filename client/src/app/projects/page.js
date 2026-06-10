'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { getToken, fmt } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';

const STATUS_OPTIONS = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'on_hold',   label: 'On Hold' },
  { id: 'completed', label: 'Done' },
];

const STATUS_COLOR = {
  active:    'bg-emerald-100 text-emerald-700',
  on_hold:   'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
};

const emptyForm = () => ({
  name: '',
  customer: '',
  site_address: '',
  estimated_value: '',
  start_date: new Date().toISOString().slice(0, 10),
  expected_end_date: '',
  notes: '',
});

export default function ProjectsPage() {
  const { showToast } = useToast();
  const token = typeof window === 'undefined' ? '' : getToken();

  const [projects,   setProjects]   = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');

  const [createMode,  setCreateMode]  = useState(false);
  const [selectedProject, setSelected] = useState(null);
  const [detailTab,   setDetailTab]   = useState('summary'); // 'summary' | 'ledger' | 'materials'
  const [ledger,      setLedger]      = useState(null);
  const [materials,   setMaterials]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState(emptyForm());

  const filtered = useMemo(() =>
    statusFilter === 'all' ? projects : projects.filter((p) => p.status === statusFilter),
  [projects, statusFilter]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, custRes] = await Promise.all([
        fetch(apiUrl('/api/projects'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/customers'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const projData = await projRes.json();
      const custData = await custRes.json();
      setProjects(Array.isArray(projData.projects) ? projData.projects : []);
      setCustomers(Array.isArray(custData) ? custData : custData.customers || []);
    } catch {
      showToast('Could not load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => { if (token) fetchAll(); }, [fetchAll, token]);

  const handleCreate = async () => {
    if (!form.name.trim()) { showToast('Project name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, estimated_value: Number(form.estimated_value) || 0, customer: form.customer || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not create project');
      showToast(`Project ${data.project_number} created`, 'success');
      setCreateMode(false);
      setForm(emptyForm());
      fetchAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openProject = async (project) => {
    setSelected(project);
    setDetailTab('summary');
    setLedger(null);
    setMaterials(null);
  };

  const loadLedger = async (projectId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/projects/${projectId}/ledger`), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLedger(data);
    } catch { showToast('Could not load ledger', 'error'); }
    finally { setDetailLoading(false); }
  };

  const loadMaterials = async (projectId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/projects/${projectId}/materials`), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMaterials(data);
    } catch { showToast('Could not load materials', 'error'); }
    finally { setDetailLoading(false); }
  };

  const switchTab = (tab) => {
    setDetailTab(tab);
    if (tab === 'ledger'    && !ledger)    loadLedger(selectedProject._id);
    if (tab === 'materials' && !materials) loadMaterials(selectedProject._id);
  };

  const closeProject = async (projectId) => {
    try {
      const res = await fetch(apiUrl(`/api/projects/${projectId}/close`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast('Project marked complete', 'success');
      setSelected(null);
      fetchAll();
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 pb-28">

        {/* Header */}
        <div className="mb-5 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-100 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Projects</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">Site & Project Billing</h1>
              <p className="mt-1 text-sm text-slate-600">Track materials, invoices, and outstanding dues per project or construction site.</p>
            </div>
            <button
              onClick={() => { setForm(emptyForm()); setCreateMode(true); }}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-black text-white shadow-lg shadow-slate-900/20"
            >
              + New Project
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setStatusFilter(opt.id)}
              className={`h-11 shrink-0 rounded-2xl border px-4 text-sm font-black ${
                statusFilter === opt.id ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-2xl mb-2">🏗️</p>
            <p className="text-lg font-black text-slate-800">No projects yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a project to track materials and invoices per site.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <button
                key={project._id}
                onClick={() => openProject(project)}
                className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{project.project_number}</p>
                    <h3 className="mt-0.5 text-base font-black text-slate-900 truncate">{project.name}</h3>
                    {project.customer_name && <p className="text-xs text-slate-500 truncate">{project.customer_name}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_COLOR[project.status] || 'bg-slate-100 text-slate-600'}`}>
                    {project.status}
                  </span>
                </div>
                {project.site_address && (
                  <p className="mt-2 text-xs text-slate-500 truncate">📍 {project.site_address}</p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[10px] text-slate-400">Billed</p>
                    <p className="text-sm font-black text-slate-800">₹{fmt(project.total_billed || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Paid</p>
                    <p className="text-sm font-black text-emerald-700">₹{fmt(project.total_paid || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Due</p>
                    <p className="text-sm font-black text-red-600">₹{fmt(project.total_outstanding || 0)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* CREATE MODAL */}
        {createMode && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-lg sm:rounded-[28px] max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black text-slate-900">New Project / Site</h2>
                <button onClick={() => setCreateMode(false)} className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Project / Site Name *</label>
                  <input
                    className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none"
                    placeholder="e.g. DLF Phase 3, Flat 402"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Customer / Contractor</label>
                  <select
                    className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none"
                    value={form.customer}
                    onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
                  >
                    <option value="">Select contractor (optional)</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}{c.phone ? ` • ${c.phone}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Site Address</label>
                  <input
                    className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none"
                    placeholder="Site / delivery address"
                    value={form.site_address}
                    onChange={(e) => setForm((f) => ({ ...f, site_address: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Estimated Value (₹)</label>
                    <input
                      type="number"
                      className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none"
                      placeholder="0"
                      value={form.estimated_value}
                      onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Expected End Date</label>
                    <input
                      type="date"
                      className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none"
                      value={form.expected_end_date}
                      onChange={(e) => setForm((f) => ({ ...f, expected_end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Notes</label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none resize-none"
                    rows={2}
                    placeholder="Any special instructions or notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setCreateMode(false)}
                  className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 h-12 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-60"
                >
                  {saving ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROJECT DETAIL SHEET */}
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white shadow-2xl sm:mx-auto sm:max-w-3xl sm:rounded-[28px] flex flex-col" style={{ maxHeight: '92vh' }}>
              {/* Header */}
              <div className="flex-shrink-0 p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">{selectedProject.project_number}</p>
                    <h2 className="text-xl font-black text-slate-900 mt-0.5">{selectedProject.name}</h2>
                    {selectedProject.site_address && (
                      <p className="text-sm text-slate-500 mt-0.5">📍 {selectedProject.site_address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedProject.status === 'active' && (
                      <button
                        onClick={() => closeProject(selectedProject._id)}
                        className="h-10 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700"
                      >
                        Mark Done
                      </button>
                    )}
                    <button
                      onClick={() => setSelected(null)}
                      className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Summary KPIs */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Billed', val: selectedProject.total_billed || 0, color: 'text-slate-800' },
                    { label: 'Paid', val: selectedProject.total_paid || 0, color: 'text-emerald-700' },
                    { label: 'Outstanding', val: selectedProject.total_outstanding || 0, color: 'text-red-600' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] text-slate-400">{kpi.label}</p>
                      <p className={`text-sm font-black mt-0.5 ${kpi.color}`}>₹{fmt(kpi.val)}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="mt-4 flex gap-1.5">
                  {['summary', 'ledger', 'materials'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => switchTab(tab)}
                      className={`h-9 rounded-xl px-4 text-xs font-black capitalize ${
                        detailTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab === 'summary' ? 'Summary' : tab === 'ledger' ? 'Invoices' : 'Materials'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">
                {detailTab === 'summary' && (
                  <div className="space-y-3">
                    {selectedProject.customer_name && (
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-400 mb-1">Contractor / Customer</p>
                        <p className="font-black text-slate-900">{selectedProject.customer_name}</p>
                      </div>
                    )}
                    {selectedProject.estimated_value > 0 && (
                      <div className="rounded-2xl bg-amber-50 p-4">
                        <p className="text-xs text-amber-600 mb-1">Estimated Project Value</p>
                        <p className="font-black text-amber-800 text-lg">₹{fmt(selectedProject.estimated_value)}</p>
                      </div>
                    )}
                    {selectedProject.notes && (
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-400 mb-1">Notes</p>
                        <p className="text-sm text-slate-700">{selectedProject.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'ledger' && (
                  detailLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                      ))}
                    </div>
                  ) : ledger ? (
                    <div className="space-y-2">
                      {ledger.sales?.length === 0 && (
                        <p className="text-center text-sm text-slate-500 py-6">No invoices linked to this project yet.</p>
                      )}
                      {ledger.sales?.map((sale) => (
                        <div key={sale._id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                          <div>
                            <p className="text-xs font-black text-slate-700">{sale.invoice_number}</p>
                            <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">₹{fmt(sale.total_amount)}</p>
                            <p className="text-xs text-slate-400">Running: ₹{fmt(sale.running_total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null
                )}

                {detailTab === 'materials' && (
                  detailLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                      ))}
                    </div>
                  ) : materials ? (
                    <div className="space-y-2">
                      {materials.materials?.length === 0 && (
                        <p className="text-center text-sm text-slate-500 py-6">No materials issued against this project yet.</p>
                      )}
                      {materials.materials?.map((mat) => (
                        <div key={mat._id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                          <p className="text-sm font-black text-slate-800">{mat.product_name}</p>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">{mat.total_qty} units</p>
                            <p className="text-xs text-slate-500">₹{fmt(mat.total_value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
