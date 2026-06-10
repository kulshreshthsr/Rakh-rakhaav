'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { getToken, fmt } from '../../lib/constants';
import { buildWhatsappMessage } from '../../lib/whatsappTemplates';
import { queueServiceJobUpdate } from '../../lib/offlineQueue';
import { useToast } from '../../hooks/useToast';

const COLUMNS = [
  { id: 'received',      label: 'Received',      color: 'bg-slate-100 text-slate-700' },
  { id: 'diagnosed',     label: 'Diagnosing',     color: 'bg-blue-100 text-blue-700' },
  { id: 'repairing',     label: 'Repairing',      color: 'bg-amber-100 text-amber-700' },
  { id: 'waiting_parts', label: 'Waiting Parts',  color: 'bg-orange-100 text-orange-700' },
  { id: 'ready',         label: 'Ready',          color: 'bg-emerald-100 text-emerald-700' },
  { id: 'delivered',     label: 'Delivered',      color: 'bg-violet-100 text-violet-700' },
];

const STATUS_COLOR = {
  received:      'bg-slate-100 text-slate-700',
  diagnosed:     'bg-blue-100 text-blue-700',
  repairing:     'bg-amber-100 text-amber-700',
  waiting_parts: 'bg-orange-100 text-orange-700',
  ready:         'bg-emerald-100 text-emerald-700',
  delivered:     'bg-violet-100 text-violet-700',
  cancelled:     'bg-red-100 text-red-500',
};

const NEXT_STATUS = {
  received:      'diagnosed',
  diagnosed:     'repairing',
  repairing:     'ready',
  waiting_parts: 'repairing',
  ready:         'delivered',
};

const emptyForm = () => ({
  customer_name: '',
  customer_phone: '',
  product_name: '',
  brand: '',
  model_number: '',
  serial_number: '',
  imei: '',
  problem_reported: '',
  problem_type: 'other',
  job_type: 'paid_repair',
  estimated_cost: '',
  technician_name: '',
  estimated_delivery: '',
  notes: '',
});

export default function ServicePage() {
  const { showToast } = useToast();
  const token   = typeof window === 'undefined' ? '' : getToken();
  const uiLang  = typeof window === 'undefined' ? 'hi_en' : (JSON.parse(localStorage.getItem('user') || '{}').ui_language || 'hi_en');
  const shopName = typeof window === 'undefined' ? '' : (JSON.parse(localStorage.getItem('user') || '{}').shop_name || '');

  const [isOnline,   setIsOnline]   = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [viewMode,   setViewMode]   = useState('kanban'); // 'kanban' | 'list'
  const [search,     setSearch]     = useState('');

  const [createMode, setCreateMode] = useState(false);
  const [form,       setForm]       = useState(emptyForm());
  const [imeiLookup, setImeiLookup] = useState(null);

  const [selected,   setSelected]   = useState(null);
  const [statusMode, setStatusMode] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [partMode,   setPartMode]   = useState(false);
  const [partForm,   setPartForm]   = useState({ part_name: '', part_cost: '', quantity: 1 });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      const res  = await fetch(apiUrl(`/api/service-jobs?${params}`), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch { showToast('Could not load jobs', 'error'); }
    finally { setLoading(false); }
  }, [token, search, showToast]);

  useEffect(() => { if (token) fetchAll(); }, [fetchAll, token]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // IMEI auto-lookup when 15 digits entered in create form
  useEffect(() => {
    const imeiVal = form.imei.replace(/\D/g, '');
    if (imeiVal.length < 15) { setImeiLookup(null); return; }
    fetch(apiUrl(`/api/inventory/serials/search?q=${imeiVal}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.found && d.record) {
          setImeiLookup(d);
          setForm(f => ({
            ...f,
            product_name: f.product_name || d.record.product?.name || '',
            serial_number: f.serial_number || d.record.serial_number || '',
          }));
        }
      })
      .catch(() => {});
  }, [form.imei, token]);

  const handleCreate = async () => {
    if (!form.customer_name)   { showToast('Customer name required', 'error');   return; }
    if (!form.product_name)    { showToast('Product name required', 'error');    return; }
    if (!form.problem_reported){ showToast('Problem description required', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(apiUrl('/api/service-jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, estimated_cost: Number(form.estimated_cost) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast(`Job ${data.job_number} created`, 'success');

      // Share WhatsApp job card
      if (data.customer_phone) {
        const { text, url } = buildWhatsappMessage('service_job_ready', {
          name: data.customer_name || 'Customer',
          product: data.product_name,
          shop: shopName,
          ref: data.job_number,
        }, uiLang, data.customer_phone);
        if (confirm(`Send WhatsApp to ${data.customer_name}?\n\n${text}`)) window.open(url, '_blank');
      }

      setCreateMode(false);
      setForm(emptyForm());
      setImeiLookup(null);
      fetchAll();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleStatusUpdate = async () => {
    if (!statusForm.status) { showToast('Select a status', 'error'); return; }
    setSaving(true);

    if (!isOnline) {
      await queueServiceJobUpdate(selected._id, statusForm);
      setJobs(prev => prev.map(j => j._id === selected._id ? { ...j, status: statusForm.status, _isOffline: true } : j));
      showToast('Saved offline — will sync when connected', 'success');
      setStatusMode(false);
      setSaving(false);
      return;
    }

    try {
      const res  = await fetch(apiUrl(`/api/service-jobs/${selected._id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(statusForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast('Status updated', 'success');

      if (statusForm.status === 'ready' && selected.customer_phone) {
        const { text, url } = buildWhatsappMessage('service_job_ready', {
          name: selected.customer_name || 'Customer',
          product: selected.product_name,
          shop: shopName,
          ref: selected.job_number,
        }, uiLang, selected.customer_phone);
        if (confirm(`Send WhatsApp to ${selected.customer_name}?\n\n${text}`)) window.open(url, '_blank');
      }

      setStatusMode(false);
      setSelected(data.job);
      fetchAll();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleAddPart = async () => {
    if (!partForm.part_name) { showToast('Part name required', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(apiUrl(`/api/service-jobs/${selected._id}/parts`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...partForm, part_cost: Number(partForm.part_cost) || 0, quantity: Number(partForm.quantity) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast('Part added', 'success');
      setPartMode(false);
      setPartForm({ part_name: '', part_cost: '', quantity: 1 });
      setSelected(data);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const byStatus = useMemo(() => {
    const map = {};
    for (const col of COLUMNS) map[col.id] = [];
    for (const job of jobs) {
      if (map[job.status]) map[job.status].push(job);
    }
    return map;
  }, [jobs]);

  const activeJobs = useMemo(() => jobs.filter(j => j.status !== 'delivered' && j.status !== 'cancelled'), [jobs]);

  return (
    <Layout>
      <div className="mx-auto max-w-full px-3 sm:px-4 py-4 pb-28">

        {/* Header */}
        <div className="mb-4 rounded-3xl bg-gradient-to-br from-violet-50 via-white to-purple-50 border border-violet-100 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-700">Service</p>
              <h1 className="mt-0.5 text-2xl font-black text-slate-900">Job Cards</h1>
              <p className="text-sm text-slate-500">{activeJobs.length} active jobs</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setViewMode(v => v === 'kanban' ? 'list' : 'kanban')}
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600">
                {viewMode === 'kanban' ? '☰ List' : '⬛ Board'}
              </button>
              <button onClick={() => { setForm(emptyForm()); setCreateMode(true); }}
                className="h-11 px-5 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-900/20">
                + New Job
              </button>
            </div>
          </div>
          <input
            className="mt-3 w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-violet-400 focus:outline-none"
            placeholder="Search by name, IMEI, job number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {COLUMNS.slice(0, 5).map((_, i) => <div key={i} className="shrink-0 w-72 h-48 animate-pulse rounded-3xl bg-slate-100" />)}
          </div>
        ) : viewMode === 'kanban' ? (

          /* ── KANBAN BOARD ── */
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
            {COLUMNS.filter(c => c.id !== 'delivered').map((col) => (
              <div key={col.id} className="shrink-0 w-72 rounded-3xl border border-slate-200 bg-white/80 flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-slate-100">
                  <span className={`rounded-xl px-3 py-1 text-xs font-black ${col.color}`}>{col.label}</span>
                  <span className="text-sm font-black text-slate-500">{byStatus[col.id]?.length || 0}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {(byStatus[col.id] || []).length === 0 && (
                    <p className="text-center text-xs text-slate-300 py-6">Empty</p>
                  )}
                  {(byStatus[col.id] || []).map((job) => (
                    <button key={job._id} onClick={() => setSelected(job)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-violet-300 transition">
                      <p className="text-[10px] font-black text-slate-400">{job.job_number}</p>
                      <p className="text-sm font-black text-slate-900 truncate mt-0.5">{job.customer_name}</p>
                      <p className="text-xs text-slate-500 truncate">{job.product_name}</p>
                      {job.estimated_delivery && (
                        <p className="text-[10px] text-slate-400 mt-1">Est: {new Date(job.estimated_delivery).toLocaleDateString()}</p>
                      )}
                      {job.estimated_cost > 0 && (
                        <p className="text-xs font-black text-emerald-700 mt-1">₹{fmt(job.estimated_cost)}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

        ) : (

          /* ── LIST VIEW ── */
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-2xl mb-2">🔨</p>
                <p className="text-lg font-black text-slate-800">No service jobs</p>
                <p className="text-sm text-slate-500 mt-1">Create a job card when a customer brings in a device for repair.</p>
              </div>
            ) : jobs.map((job) => (
              <button key={job._id} onClick={() => setSelected(job)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left flex items-center justify-between gap-3 hover:border-violet-300">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-500">{job.job_number}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_COLOR[job.status]}`}>{job.status}</span>
                  </div>
                  <p className="text-sm font-black text-slate-900 truncate">{job.customer_name} · {job.product_name}</p>
                  <p className="text-xs text-slate-500 truncate">{job.problem_reported}</p>
                </div>
                <div className="shrink-0 text-right">
                  {job.estimated_cost > 0 && <p className="text-sm font-black text-slate-800">₹{fmt(job.estimated_cost)}</p>}
                  <p className="text-[10px] text-slate-400">{new Date(job.received_date || job.createdAt).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* CREATE JOB MODAL */}
        {createMode && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-lg sm:rounded-[28px] max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-900">New Job Card</h2>
                <button onClick={() => { setCreateMode(false); setImeiLookup(null); }} className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">IMEI (auto-fills device details)</label>
                  <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-violet-400 focus:outline-none"
                    placeholder="Enter IMEI to auto-fill" value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} />
                  {imeiLookup?.found && (
                    <p className="mt-1 text-xs text-emerald-700 font-bold">✓ Device found: {imeiLookup.record.product?.name} · {imeiLookup.record.status}</p>
                  )}
                </div>
                {[
                  { label: 'Customer Name *', key: 'customer_name' },
                  { label: 'Customer Phone', key: 'customer_phone' },
                  { label: 'Product Name *', key: 'product_name' },
                  { label: 'Brand', key: 'brand' },
                  { label: 'Model Number', key: 'model_number' },
                  { label: 'Serial Number', key: 'serial_number' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{label}</label>
                    <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-violet-400 focus:outline-none"
                      value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Problem Reported *</label>
                  <textarea className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium focus:border-violet-400 focus:outline-none resize-none"
                    rows={2} placeholder="Describe the issue"
                    value={form.problem_reported} onChange={e => setForm(f => ({ ...f, problem_reported: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Problem Type</label>
                    <select className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:outline-none"
                      value={form.problem_type} onChange={e => setForm(f => ({ ...f, problem_type: e.target.value }))}>
                      {['screen','battery','speaker','charging','motherboard','software','other'].map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Job Type</label>
                    <select className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:outline-none"
                      value={form.job_type} onChange={e => setForm(f => ({ ...f, job_type: e.target.value }))}>
                      <option value="paid_repair">Paid Repair</option>
                      <option value="warranty">Warranty</option>
                      <option value="out_of_warranty">Out-of-Warranty</option>
                      <option value="amc">AMC</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Estimated Cost (₹)</label>
                    <input type="number" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:outline-none"
                      value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Est. Delivery</label>
                    <input type="date" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:outline-none"
                      value={form.estimated_delivery} onChange={e => setForm(f => ({ ...f, estimated_delivery: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Technician</label>
                  <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-violet-400 focus:outline-none"
                    value={form.technician_name} onChange={e => setForm(f => ({ ...f, technician_name: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setCreateMode(false); setImeiLookup(null); }} className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 h-12 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Creating…' : 'Create Job Card'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* JOB DETAIL SHEET */}
        {selected && !statusMode && !partMode && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-[28px] flex flex-col" style={{ maxHeight: '92vh' }}>
              <div className="flex-shrink-0 p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-violet-700 uppercase tracking-wider">{selected.job_number}</p>
                    <h2 className="text-xl font-black text-slate-900 mt-0.5">{selected.customer_name}</h2>
                    <p className="text-sm text-slate-500">{selected.product_name}{selected.brand ? ` · ${selected.brand}` : ''}</p>
                    <span className={`inline-block mt-1 rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_COLOR[selected.status]}`}>{selected.status.replace('_', ' ')}</span>
                  </div>
                  <button onClick={() => setSelected(null)} className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black">✕</button>
                </div>

                {/* Action row */}
                {!['delivered', 'cancelled'].includes(selected.status) && (
                  <div className="mt-3 flex gap-2">
                    {NEXT_STATUS[selected.status] && (
                      <button onClick={() => { setStatusForm({ status: NEXT_STATUS[selected.status], note: '' }); setStatusMode(true); }}
                        className="flex-1 h-11 rounded-2xl bg-slate-900 text-xs font-black text-white">
                        → Move to {COLUMNS.find(c => c.id === NEXT_STATUS[selected.status])?.label}
                      </button>
                    )}
                    <button onClick={() => { setStatusForm({ status: '', note: '' }); setStatusMode(true); }}
                      className="h-11 px-4 rounded-2xl border border-slate-200 text-xs font-black text-slate-600">
                      Change Status
                    </button>
                    <button onClick={() => setPartMode(true)}
                      className="h-11 px-4 rounded-2xl border border-violet-200 bg-violet-50 text-xs font-black text-violet-700">
                      + Part
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Details */}
                <div className="rounded-2xl bg-slate-50 p-4 space-y-2">
                  {selected.problem_reported && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">Problem: </span>{selected.problem_reported}</p>}
                  {selected.imei            && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">IMEI: </span>{selected.imei}</p>}
                  {selected.serial_number   && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">Serial: </span>{selected.serial_number}</p>}
                  {selected.technician_name && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">Technician: </span>{selected.technician_name}</p>}
                  {selected.estimated_cost > 0 && <p className="text-sm text-slate-700"><span className="font-bold text-slate-500">Est. Cost: </span>₹{fmt(selected.estimated_cost)}</p>}
                  {selected.final_cost    > 0 && <p className="text-sm font-black text-emerald-700"><span className="font-bold">Final Cost: </span>₹{fmt(selected.final_cost)}</p>}
                </div>

                {/* Parts */}
                {selected.parts_used?.length > 0 && (
                  <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Parts Used</p>
                    <div className="space-y-1">
                      {selected.parts_used.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-sm text-slate-800">{p.quantity}× {p.part_name}</p>
                          {p.part_cost > 0 && <p className="text-sm font-black text-slate-700">₹{fmt(p.part_cost * p.quantity)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status timeline */}
                {selected.status_history?.length > 0 && (
                  <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Timeline</p>
                    <div className="relative pl-5">
                      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-100" />
                      {[...(selected.status_history || [])].reverse().map((h, i) => (
                        <div key={i} className="relative mb-3">
                          <div className="absolute -left-3.5 top-1.5 h-2 w-2 rounded-full bg-violet-400" />
                          <p className="text-xs font-black text-slate-700 capitalize">{(h.status || '').replace('_', ' ')}</p>
                          <p className="text-[10px] text-slate-400">{new Date(h.changed_at).toLocaleString()}{h.changed_by ? ` · ${h.changed_by}` : ''}</p>
                          {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STATUS UPDATE SHEET */}
        {statusMode && selected && (
          <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/40">
            <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900">Update Status</h3>
                <button onClick={() => setStatusMode(false)} className="h-10 w-10 rounded-2xl border border-slate-200 font-black">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {COLUMNS.filter(c => c.id !== selected.status).map(col => (
                  <button key={col.id} onClick={() => setStatusForm(f => ({ ...f, status: col.id }))}
                    className={`h-12 rounded-2xl border text-sm font-black transition ${statusForm.status === col.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'}`}>
                    {col.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Note (optional)</label>
                <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-violet-400 focus:outline-none"
                  placeholder="e.g. Waiting for screen delivery from supplier"
                  value={statusForm.note} onChange={e => setStatusForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStatusMode(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600">Cancel</button>
                <button onClick={handleStatusUpdate} disabled={saving || !statusForm.status} className="flex-1 h-12 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Saving…' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD PART SHEET */}
        {partMode && selected && (
          <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/40">
            <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900">Add Part Used</h3>
                <button onClick={() => setPartMode(false)} className="h-10 w-10 rounded-2xl border border-slate-200 font-black">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Part Name *</label>
                  <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-violet-400 focus:outline-none"
                    placeholder="e.g. Display Assembly"
                    value={partForm.part_name} onChange={e => setPartForm(f => ({ ...f, part_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Cost (₹)</label>
                    <input type="number" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:outline-none"
                      value={partForm.part_cost} onChange={e => setPartForm(f => ({ ...f, part_cost: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Qty</label>
                    <input type="number" min="1" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:outline-none"
                      value={partForm.quantity} onChange={e => setPartForm(f => ({ ...f, quantity: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setPartMode(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600">Cancel</button>
                <button onClick={handleAddPart} disabled={saving} className="flex-1 h-12 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Adding…' : 'Add Part'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
