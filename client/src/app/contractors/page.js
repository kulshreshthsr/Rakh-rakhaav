'use client';
import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';
import { useRouter } from 'next/navigation';
import EmptyState from '../../components/ui/EmptyState';
import Link from 'next/link';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = () => ({
  name: '', phone: '', gst_no: '', address: '',
  contractor_discount: '', credit_limit: '', site_names: '', notes: '',
});

function CreditBar({ outstanding, limit }) {
  if (!limit || limit <= 0) return <p className="text-[11px] text-slate-400">No credit limit set</p>;
  const pct = Math.min(100, (outstanding / limit) * 100);
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-green-500';
  const textColor = pct > 80 ? 'text-red-700' : pct > 50 ? 'text-amber-700' : 'text-green-700';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={`font-bold ${textColor}`}>₹{fmt(outstanding)} outstanding</span>
        <span className="text-slate-500">/ ₹{fmt(limit)} limit</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {pct > 80 && <p className="text-[10px] font-bold text-red-600">⚠️ {pct > 100 ? 'OVER LIMIT' : 'Near limit'}</p>}
    </div>
  );
}

export default function ContractorsPage() {
  const router = useRouter();
  const { businessType } = useIndustry();

  const [contractors, setContractors]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [form, setForm]                 = useState(emptyForm());
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget]       = useState(null);
  const [payForm, setPayForm]           = useState({ amount: '', mode: 'cash', reference: '' });
  const [payError, setPayError]         = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [search, setSearch]             = useState('');

  const fetchContractors = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/contractors'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Failed to load contractors');
      setContractors(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchContractors(); }, [fetchContractors]);

  if (businessType && businessType !== 'hardware') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 pt-10">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
            <p className="text-[16px] font-black text-slate-800">Contractor Accounts</p>
            <p className="text-[13px] text-slate-500 mt-2">Available for Hardware stores only.</p>
            <Link href="/dashboard" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold">Back to Dashboard</Link>
          </div>
        </div>
      </Layout>
    );
  }

  const openAdd = () => { setEditTarget(null); setForm(emptyForm()); setFormError(''); setShowModal(true); };
  const openEdit = (c) => {
    setEditTarget(c);
    setForm({
      name: c.name || '', phone: c.phone || '', gst_no: c.gst_no || '', address: c.address || '',
      contractor_discount: c.contractor_discount != null ? String(c.contractor_discount) : '',
      credit_limit: c.credit_limit != null ? String(c.credit_limit) : '',
      site_names: Array.isArray(c.site_names) ? c.site_names.join(', ') : '',
      notes: c.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        gst_no: form.gst_no.trim(),
        address: form.address.trim(),
        contractor_discount: Number(form.contractor_discount) || 0,
        credit_limit: Number(form.credit_limit) || 0,
        site_names: form.site_names.split(',').map(s => s.trim()).filter(Boolean),
        notes: form.notes.trim(),
      };
      const url = editTarget ? apiUrl(`/api/contractors/${editTarget._id}`) : apiUrl('/api/contractors');
      const method = editTarget ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Save failed'); }
      setShowModal(false);
      fetchContractors();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const openPayment = (c) => { setPayTarget(c); setPayForm({ amount: '', mode: 'cash', reference: '' }); setPayError(''); setShowPayModal(true); };
  const handlePayment = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) { setPayError('Enter a valid amount'); return; }
    setPaySubmitting(true); setPayError('');
    try {
      const res = await fetch(apiUrl(`/api/contractors/${payTarget._id}/payment`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ amount: Number(payForm.amount), mode: payForm.mode, reference: payForm.reference }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Payment failed'); }
      setShowPayModal(false);
      fetchContractors();
    } catch (e) { setPayError(e.message); }
    finally { setPaySubmitting(false); }
  };

  const filtered = contractors.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-black text-slate-900">Contractor Accounts</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Credit limits, discounts & outstanding dues</p>
          </div>
          <button
            onClick={openAdd}
            className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-[13px] font-black hover:bg-amber-700 transition-colors shadow-md"
          >+ Add Contractor</button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
        />

        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700 font-medium">{error}</div>}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          search ? (
            <div className="empty-state">
              <div className="empty-state-icon mx-auto mb-4 text-[26px]">🔍</div>
              <p className="text-[14px] font-extrabold text-slate-700">कोई contractor नहीं मिला</p>
              <p className="text-[12px] text-slate-400 mt-1">अलग keyword try करें</p>
            </div>
          ) : (
            <EmptyState
              emoji="🔨"
              title="कोई contractor नहीं"
              subtitle="Repair और service के लिए contractors यहाँ track करें।"
              actionLabel="Contractor जोड़ें"
              onAction={openAdd}
            />
          )
        ) : (
          <div className="space-y-3">
            {filtered.map(c => {
              const pct = c.credit_limit > 0 ? Math.min(100, (c.current_outstanding / c.credit_limit) * 100) : 0;
              const creditBadge = c.credit_limit > 0
                ? pct > 100 ? 'bg-red-100 border-red-300 text-red-800'
                  : pct > 80 ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-green-100 border-green-300 text-green-800'
                : 'bg-slate-100 border-slate-200 text-slate-600';

              return (
                <div key={c._id} className={`rounded-2xl border-2 bg-white overflow-hidden shadow-sm ${pct > 80 ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className="px-4 py-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-black text-slate-900 leading-tight">{c.name}</p>
                        {c.phone && <p className="text-[12px] text-slate-500 mt-0.5">📞 {c.phone}</p>}
                        {c.gst_no && <p className="text-[11px] text-slate-400 font-mono">GST: {c.gst_no}</p>}
                      </div>
                      <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl border text-[12px] font-black ${creditBadge}`}>
                        {c.contractor_discount > 0 ? `${c.contractor_discount}% off` : 'No discount'}
                      </div>
                    </div>

                    {/* Credit bar */}
                    <CreditBar outstanding={c.current_outstanding} limit={c.credit_limit} />

                    {/* Sites */}
                    {Array.isArray(c.site_names) && c.site_names.length > 0 && (
                      <p className="text-[11px] text-slate-500">📍 {c.site_names.join(' • ')}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Link
                        href={`/sales?contractor=${c._id}`}
                        className="flex-1 h-9 flex items-center justify-center rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-700 hover:border-amber-400 hover:text-amber-700 transition-colors"
                      >View Sales</Link>
                      <button
                        onClick={() => openPayment(c)}
                        className="flex-1 h-9 rounded-xl border-2 border-green-300 bg-green-50 text-[12px] font-bold text-green-700 hover:bg-green-100 transition-colors"
                      >💳 Record Payment</button>
                      <button
                        onClick={() => openEdit(c)}
                        className="h-9 px-3 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-600 hover:border-slate-400 transition-colors"
                      >Edit</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[18px] font-black text-slate-900">{editTarget ? 'Edit Contractor' : 'Add Contractor'}</h2>
              <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors text-[18px] leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {formError && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">{formError}</div>}

              {[
                { key: 'name', label: 'Name *', placeholder: 'Contractor / Company name' },
                { key: 'phone', label: 'Phone', placeholder: '9876543210' },
                { key: 'gst_no', label: 'GST No.', placeholder: '29XXXXXX' },
                { key: 'address', label: 'Address', placeholder: 'Full address' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Discount (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={form.contractor_discount}
                    onChange={e => setForm(p => ({ ...p, contractor_discount: e.target.value }))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Credit Limit (₹)</label>
                  <input
                    type="number" min="0"
                    value={form.credit_limit}
                    onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Site Names (comma-separated)</label>
                <input
                  value={form.site_names}
                  onChange={e => setForm(p => ({ ...p, site_names: e.target.value }))}
                  placeholder="DLF Phase 2, Sector 18"
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any notes about this contractor"
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-amber-600 text-white text-[14px] font-black hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Contractor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && payTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-black text-slate-900">Record Payment</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">{payTarget.name} — Outstanding: ₹{fmtD(payTarget.current_outstanding)}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-[18px] leading-none hover:bg-slate-200 transition-colors">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {payError && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">{payError}</div>}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Received (₹) *</label>
                <input
                  type="number" min="1"
                  value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="Enter amount"
                  className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 text-[16px] font-bold text-slate-900 focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'upi', 'bank'].map(m => (
                    <button key={m} onClick={() => setPayForm(p => ({ ...p, mode: m }))}
                      className={`h-9 rounded-xl border-2 text-[12px] font-bold transition-colors capitalize ${payForm.mode === m ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >{m === 'bank' ? 'Bank Transfer' : m.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reference (Cheque / UTR)</label>
                <input
                  value={payForm.reference}
                  onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))}
                  placeholder="Optional reference number"
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowPayModal(false)} className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handlePayment} disabled={paySubmitting} className="flex-1 h-11 rounded-xl bg-green-600 text-white text-[14px] font-black hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {paySubmitting ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
