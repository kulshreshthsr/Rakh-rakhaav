'use client';

import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { getToken, fmt } from '../../lib/constants';
import { buildWhatsappMessage } from '../../lib/whatsappTemplates';
import { useToast } from '../../hooks/useToast';

const STATUS_TABS = [
  { id: 'active',   label: 'Active' },
  { id: 'expiring', label: 'Expiring Soon' },
  { id: 'expired',  label: 'Expired' },
  { id: 'all',      label: 'All' },
];

const STATUS_COLOR = {
  active:    'bg-emerald-100 text-emerald-700',
  expired:   'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

const emptyForm = () => ({
  customer_name: '',
  customer_phone: '',
  product_name: '',
  product_brand: '',
  serial_number: '',
  model_number: '',
  amc_start_date: new Date().toISOString().slice(0, 10),
  amc_end_date: '',
  amc_amount: '',
  payment_status: 'unpaid',
  visits_included: '',
  notes: '',
});

const emptyVisit = () => ({
  technician_name: '',
  issue_reported: '',
  work_done: '',
  parts_used: '',
  next_visit_date: '',
});

export default function AMCPage() {
  const { showToast } = useToast();
  const token    = typeof window === 'undefined' ? '' : getToken();
  const uiLang   = typeof window === 'undefined' ? 'hi_en' : (JSON.parse(localStorage.getItem('user') || '{}').ui_language || 'hi_en');
  const shopName = typeof window === 'undefined' ? '' : (JSON.parse(localStorage.getItem('user') || '{}').shop_name || '');

  const [amcs,       setAmcs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('active');
  const [saving,     setSaving]     = useState(false);

  const [createMode, setCreateMode] = useState(false);
  const [form,       setForm]       = useState(emptyForm());

  const [selected,   setSelected]   = useState(null);
  const [visitMode,  setVisitMode]  = useState(false);
  const [visit,      setVisit]      = useState(emptyVisit());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'expiring' ? 'active' : tab === 'all' ? '' : tab;
      const expiringParam = tab === 'expiring' ? '&expiring=30' : '';
      const url = tab === 'expiring'
        ? apiUrl('/api/amc/expiring?days=30')
        : apiUrl(`/api/amc${statusParam ? `?status=${statusParam}` : ''}`);
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAmcs(tab === 'expiring' ? (data.amcs || []) : (data.amcs || []));
    } catch {
      showToast('Could not load AMC records', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, token, showToast]);

  useEffect(() => { if (token) fetchAll(); }, [fetchAll, token]);

  const handleCreate = async () => {
    if (!form.customer_name.trim()) { showToast('Customer name required', 'error'); return; }
    if (!form.product_name.trim())  { showToast('Product name required', 'error');  return; }
    if (!form.amc_end_date)         { showToast('End date required', 'error');       return; }
    setSaving(true);
    try {
      const res  = await fetch(apiUrl('/api/amc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, amc_amount: Number(form.amc_amount) || 0, visits_included: Number(form.visits_included) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast(`AMC ${data.amc_number} created`, 'success');
      setCreateMode(false);
      setForm(emptyForm());
      fetchAll();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleLogVisit = async () => {
    if (!visit.work_done && !visit.issue_reported) { showToast('Issue or work done is required', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(apiUrl(`/api/amc/${selected._id}/visit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(visit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast('Visit logged', 'success');
      setVisitMode(false);
      setVisit(emptyVisit());
      setSelected(data);
      fetchAll();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const daysUntil = (date) => Math.ceil((new Date(date) - Date.now()) / 86400000);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-3 sm:px-4 py-4 pb-28">

        {/* Header */}
        <div className="mb-5 rounded-3xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 border border-blue-100 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-700">AMC</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">Annual Maintenance Contracts</h1>
              <p className="mt-1 text-sm text-slate-600">Track service contracts, visit history, and renewal alerts.</p>
            </div>
            <button
              onClick={() => { setForm(emptyForm()); setCreateMode(true); }}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-black text-white shadow-lg shadow-slate-900/20"
            >
              + New AMC
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`h-11 shrink-0 rounded-2xl border px-4 text-sm font-black ${
                tab === t.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
          </div>
        ) : amcs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-2xl mb-2">🔧</p>
            <p className="text-lg font-black text-slate-800">No AMC records</p>
            <p className="mt-1 text-sm text-slate-500">Create a contract to start tracking service visits and renewals.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {amcs.map((amc) => {
              const days = daysUntil(amc.amc_end_date);
              const expiringSoon = days > 0 && days <= 30;
              return (
                <button
                  key={amc._id}
                  onClick={() => setSelected(amc)}
                  className={`rounded-3xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${expiringSoon ? 'border-amber-300' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{amc.amc_number}</p>
                      <h3 className="text-base font-black text-slate-900 truncate mt-0.5">{amc.customer_name}</h3>
                      <p className="text-xs text-slate-500 truncate">{amc.product_name}{amc.product_brand ? ` · ${amc.product_brand}` : ''}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_COLOR[amc.status] || 'bg-slate-100 text-slate-600'}`}>
                      {amc.status}
                    </span>
                  </div>
                  {expiringSoon && (
                    <div className="mb-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-700">⚠️ Expires in {days} day{days === 1 ? '' : 's'}</span>
                      {amc.customer_phone && (
                        <a
                          href={buildWhatsappMessage('amc_renewal', {
                            name: amc.customer_name || 'Customer',
                            product: amc.product_name,
                            date: new Date(amc.amc_end_date).toLocaleDateString('en-IN'),
                            shop: shopName,
                          }, uiLang, amc.customer_phone).url}
                          target="_blank" rel="noreferrer"
                          onClick={e => {
                            const { text } = buildWhatsappMessage('amc_renewal', { name: amc.customer_name || 'Customer', product: amc.product_name, date: new Date(amc.amc_end_date).toLocaleDateString('en-IN'), shop: shopName }, uiLang, amc.customer_phone);
                            if (!confirm(`Send AMC renewal reminder to ${amc.customer_name}?\n\n${text}`)) e.preventDefault();
                          }}
                          className="shrink-0 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 hover:bg-emerald-100 transition-colors"
                        >📲 Remind</a>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-2 mt-1">
                    <div>
                      <p className="text-[10px] text-slate-400">Ends</p>
                      <p className="text-xs font-black text-slate-700">{new Date(amc.amc_end_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Amount</p>
                      <p className="text-xs font-black text-slate-700">₹{fmt(amc.amc_amount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Visits</p>
                      <p className="text-xs font-black text-slate-700">{amc.visits_used}/{amc.visits_included || '∞'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* CREATE MODAL */}
        {createMode && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-lg sm:rounded-[28px] max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black text-slate-900">New AMC</h2>
                <button onClick={() => setCreateMode(false)} className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black">✕</button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Customer Name *', key: 'customer_name', placeholder: 'e.g. Rajesh Kumar' },
                  { label: 'Customer Phone', key: 'customer_phone', placeholder: '98XXXXXXXX' },
                  { label: 'Product Name *', key: 'product_name', placeholder: 'e.g. Samsung Refrigerator' },
                  { label: 'Brand', key: 'product_brand', placeholder: 'e.g. Samsung' },
                  { label: 'Serial Number', key: 'serial_number', placeholder: 'Optional' },
                  { label: 'Model Number', key: 'model_number', placeholder: 'Optional' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{label}</label>
                    <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                      placeholder={placeholder} value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Start Date *</label>
                    <input type="date" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                      value={form.amc_start_date} onChange={e => setForm(f => ({ ...f, amc_start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">End Date *</label>
                    <input type="date" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                      value={form.amc_end_date} onChange={e => setForm(f => ({ ...f, amc_end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">AMC Amount (₹)</label>
                    <input type="number" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                      placeholder="0" value={form.amc_amount} onChange={e => setForm(f => ({ ...f, amc_amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Visits Included (0=∞)</label>
                    <input type="number" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                      placeholder="0" value={form.visits_included} onChange={e => setForm(f => ({ ...f, visits_included: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Payment Status</label>
                  <select className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                    value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setCreateMode(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 h-12 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Creating…' : 'Create AMC'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AMC DETAIL SHEET */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-[28px] flex flex-col" style={{ maxHeight: '92vh' }}>
              <div className="flex-shrink-0 p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">{selected.amc_number}</p>
                    <h2 className="text-xl font-black text-slate-900 mt-0.5">{selected.customer_name}</h2>
                    <p className="text-sm text-slate-500">{selected.product_name}{selected.product_brand ? ` · ${selected.product_brand}` : ''}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black">✕</button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Expires', val: new Date(selected.amc_end_date).toLocaleDateString() },
                    { label: 'Amount', val: `₹${fmt(selected.amc_amount || 0)}` },
                    { label: 'Visits', val: `${selected.visits_used}/${selected.visits_included || '∞'}` },
                  ].map(k => (
                    <div key={k.label} className="rounded-2xl bg-slate-50 p-2.5 text-center">
                      <p className="text-[10px] text-slate-400">{k.label}</p>
                      <p className="text-xs font-black text-slate-800">{k.val}</p>
                    </div>
                  ))}
                </div>
                {selected.status === 'active' && (
                  <button
                    onClick={() => setVisitMode(true)}
                    className="mt-3 w-full h-11 rounded-2xl bg-blue-600 text-sm font-black text-white"
                  >
                    + Log Visit
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {selected.visits?.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-6">No visits logged yet.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Visit History</p>
                    {[...(selected.visits || [])].reverse().map((v, i) => (
                      <div key={i} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black text-slate-700">{new Date(v.visit_date).toLocaleDateString()}</p>
                          {v.technician_name && <p className="text-xs text-slate-500">{v.technician_name}</p>}
                        </div>
                        {v.issue_reported && <p className="text-sm text-slate-700 mt-1"><span className="font-bold text-slate-500">Issue: </span>{v.issue_reported}</p>}
                        {v.work_done      && <p className="text-sm text-slate-700 mt-0.5"><span className="font-bold text-slate-500">Work done: </span>{v.work_done}</p>}
                        {v.parts_used     && <p className="text-sm text-slate-500 mt-0.5">Parts: {v.parts_used}</p>}
                        {v.next_visit_date && <p className="text-xs text-blue-600 mt-1">Next visit: {new Date(v.next_visit_date).toLocaleDateString()}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOG VISIT SHEET */}
        {visitMode && selected && (
          <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/40">
            <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900">Log Service Visit</h3>
                <button onClick={() => setVisitMode(false)} className="h-10 w-10 rounded-2xl border border-slate-200 text-slate-600 font-black">✕</button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Technician Name', key: 'technician_name', placeholder: '' },
                  { label: 'Issue Reported', key: 'issue_reported', placeholder: 'What did the customer report?' },
                  { label: 'Work Done *', key: 'work_done', placeholder: 'Describe the work performed' },
                  { label: 'Parts Used', key: 'parts_used', placeholder: 'e.g. Capacitor 10μF x2' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{label}</label>
                    <input className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                      placeholder={placeholder} value={visit[key]}
                      onChange={e => setVisit(v => ({ ...v, [key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Next Visit Date</label>
                  <input type="date" className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium focus:border-blue-400 focus:outline-none"
                    value={visit.next_visit_date} onChange={e => setVisit(v => ({ ...v, next_visit_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setVisitMode(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600">Cancel</button>
                <button onClick={handleLogVisit} disabled={saving} className="flex-1 h-12 rounded-2xl bg-blue-600 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Saving…' : 'Log Visit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
