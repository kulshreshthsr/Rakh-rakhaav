'use client';
import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';
import { useRouter } from 'next/navigation';
import EmptyState from '../../components/ui/EmptyState';
import Link from 'next/link';

const getToken = () => localStorage.getItem('token');

const STATUS_CONFIG = {
  received:      { label: 'Received',       badge: 'bg-slate-100 border-slate-300 text-slate-700',   dot: 'bg-slate-400' },
  sent_to_brand: { label: 'Sent to Brand',  badge: 'bg-blue-100 border-blue-300 text-blue-700',      dot: 'bg-blue-500'  },
  under_repair:  { label: 'Under Repair',   badge: 'bg-amber-100 border-amber-300 text-amber-700',   dot: 'bg-amber-500' },
  ready:         { label: 'Ready',          badge: 'bg-green-100 border-green-300 text-green-700',   dot: 'bg-green-500' },
  delivered:     { label: 'Delivered ✓',    badge: 'bg-emerald-100 border-emerald-300 text-emerald-700', dot: 'bg-emerald-500' },
  rejected:      { label: 'Rejected',       badge: 'bg-red-100 border-red-300 text-red-700',         dot: 'bg-red-500'   },
};

const CLAIM_FILTERS = ['all', 'received', 'sent_to_brand', 'under_repair', 'ready', 'delivered', 'rejected'];

const emptyNewClaim = () => ({
  originalInvoiceNo: '', productName: '', serialNumber: '', imeiNumber: '',
  brandName: '', modelNumber: '', issueDescription: '', claimType: 'repair',
  customerName: '', customerPhone: '', brandTicketNo: '', receivedBy: '', notes: '',
});

export default function WarrantyPage() {
  const router = useRouter();
  const { businessType } = useIndustry();

  const [claims, setClaims]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]           = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm]         = useState(emptyNewClaim());
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [serialAlert, setSerialAlert] = useState(null);

  // Update status modal
  const [showUpdateModal, setShowUpdateModal]   = useState(false);
  const [updateTarget, setUpdateTarget]         = useState(null);
  const [updateForm, setUpdateForm]             = useState({ claimStatus: '', brandTicketNo: '', resolution: '', notes: '' });
  const [updateSaving, setUpdateSaving]         = useState(false);
  const [updateError, setUpdateError]           = useState('');

  const fetchClaims = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await fetch(apiUrl(`/api/warranty?${params}`), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Failed to load claims');
      const d = await res.json();
      setClaims(d.claims || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [router, statusFilter, search]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  if (businessType && businessType !== 'electronics') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 pt-10">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
            <p className="text-[16px] font-black text-slate-800">Warranty Claims</p>
            <p className="text-[13px] text-slate-500 mt-2">Available for Electronics shops only.</p>
            <Link href="/dashboard" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold">Back</Link>
          </div>
        </div>
      </Layout>
    );
  }

  const lookupInvoice = async (invoiceNo) => {
    if (!invoiceNo) return;
    setInvoiceLookupLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/sales?invoice_number=${encodeURIComponent(invoiceNo)}&limit=1`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const d = await res.json();
        const sale = Array.isArray(d) ? d[0] : d?.sales?.[0];
        if (sale) {
          const firstItem = sale.items?.[0];
          setNewForm(f => ({
            ...f,
            customerName: sale.buyer_name || f.customerName,
            customerPhone: sale.buyer_phone || f.customerPhone,
            productName: firstItem?.product_name || f.productName,
          }));
        }
      }
    } catch { /* ignore */ }
    finally { setInvoiceLookupLoading(false); }
  };

  const checkSerial = async (sn) => {
    if (!sn || sn.length < 3) { setSerialAlert(null); return; }
    try {
      const res = await fetch(apiUrl(`/api/warranty/serial/${encodeURIComponent(sn)}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSerialAlert(data.length > 0 ? `⚠️ Open claim already exists for this serial (${data[0]?.claimStatus})` : null);
      }
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!newForm.productName.trim()) { setFormError('Product name required'); return; }
    if (!newForm.issueDescription.trim()) { setFormError('Issue description required'); return; }
    if (!newForm.customerName.trim()) { setFormError('Customer name required'); return; }
    setSaving(true); setFormError('');
    try {
      const res = await fetch(apiUrl('/api/warranty'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(newForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed'); }
      setShowNewModal(false);
      setNewForm(emptyNewClaim());
      fetchClaims();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  const openUpdate = (claim) => {
    setUpdateTarget(claim);
    setUpdateForm({ claimStatus: claim.claimStatus, brandTicketNo: claim.brandTicketNo || '', resolution: claim.resolution || '', notes: claim.notes || '' });
    setUpdateError('');
    setShowUpdateModal(true);
  };

  const handleUpdate = async () => {
    setUpdateSaving(true); setUpdateError('');
    try {
      const res = await fetch(apiUrl(`/api/warranty/${updateTarget._id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(updateForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed'); }
      setShowUpdateModal(false);
      fetchClaims();
    } catch (e) { setUpdateError(e.message); }
    finally { setUpdateSaving(false); }
  };

  const buildWhatsAppMsg = (claim) => {
    return `Dear ${claim.customerName},\n\nYour ${claim.productName} warranty claim is ready for pickup.\nClaim Ref: ${claim.brandTicketNo || 'N/A'}.\n\nPlease bring your original invoice.\n\nThank you.`;
  };

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-black text-slate-900">Warranty Claims</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Register & track warranty service requests</p>
          </div>
          <button
            onClick={() => { setNewForm(emptyNewClaim()); setFormError(''); setSerialAlert(null); setShowNewModal(true); }}
            className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-[13px] font-black hover:bg-teal-700 transition-colors shadow-md"
          >+ New Claim</button>
        </div>

        {/* Filter tabs */}
        <div className="rr-tab-bar">
          {CLAIM_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`rr-tab ${statusFilter === f ? 'active' : ''}`}>
              {STATUS_CONFIG[f]?.label || 'All'}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search serial no. / customer / model / invoice…"
          className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
        />

        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : claims.length === 0 ? (
          <EmptyState
            emoji="🛡️"
            title="कोई warranty claim नहीं"
            subtitle="Products की warranty और claims यहाँ track होती हैं।"
          />
        ) : (
          <div className="space-y-3">
            {claims.map(c => {
              const sc = STATUS_CONFIG[c.claimStatus] || STATUS_CONFIG.received;
              return (
                <div key={c._id} className="rr-list-row flex-col items-start">
                  <div className="w-full space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-black text-slate-900 leading-tight">{c.productName}</p>
                        {c.serialNumber && <p className="text-[11px] font-mono text-slate-500 mt-0.5">S/N: {c.serialNumber}</p>}
                        {c.brandName && <p className="text-[11px] text-slate-400">{c.brandName}{c.modelNumber ? ` — ${c.modelNumber}` : ''}</p>}
                      </div>
                      <span className={`rr-pill flex-shrink-0 ${
                        c.claimStatus === 'received' ? 'rr-pill-amber' :
                        c.claimStatus === 'sent_to_brand' ? 'rr-pill-blue' :
                        c.claimStatus === 'under_repair' ? 'rr-pill-violet' :
                        c.claimStatus === 'ready' ? 'rr-pill-green' :
                        'rr-pill-slate'
                      }`}>{sc.label}</span>
                    </div>

                    {/* Customer + issue */}
                    <div>
                      <p className="text-[12px] font-bold text-slate-700">👤 {c.customerName} {c.customerPhone ? `• ${c.customerPhone}` : ''}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{c.issueDescription}</p>
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 capitalize">{c.claimType}</span>
                      {c.originalInvoiceNo && <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-500">Inv: {c.originalInvoiceNo}</span>}
                      {c.brandTicketNo && <span className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-bold">Ticket: {c.brandTicketNo}</span>}
                      <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-400">{new Date(c.claimDate).toLocaleDateString('en-IN')}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => openUpdate(c)}
                        className="flex-1 h-9 rounded-xl border-2 border-teal-200 bg-teal-50 text-[12px] font-bold text-teal-700 hover:bg-teal-100 transition-colors">Update Status</button>
                      {c.originalInvoiceNo && (
                        <Link href={`/sales?invoice=${c.originalInvoiceNo}`}
                          className="flex-1 h-9 flex items-center justify-center rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-600 hover:border-slate-400 transition-colors">View Invoice</Link>
                      )}
                      {c.claimStatus === 'ready' && c.customerPhone && (
                        <a href={`https://wa.me/91${c.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(buildWhatsAppMsg(c))}`}
                          target="_blank" rel="noreferrer"
                          className="h-9 px-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center">WhatsApp</a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Claim Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-[18px] font-black text-slate-900">New Warranty Claim</h2>
              <button onClick={() => setShowNewModal(false)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-[18px] leading-none hover:bg-slate-200 transition-colors">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {formError && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">{formError}</div>}

              {/* Invoice lookup */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice No. (Lookup)</label>
                <div className="flex gap-2">
                  <input
                    value={newForm.originalInvoiceNo}
                    onChange={e => setNewForm(f => ({ ...f, originalInvoiceNo: e.target.value }))}
                    placeholder="INV/25-26/0001"
                    className="flex-1 h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                  <button type="button" onClick={() => lookupInvoice(newForm.originalInvoiceNo)} disabled={invoiceLookupLoading}
                    className="h-10 px-3 rounded-xl bg-teal-600 text-white text-[12px] font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                    {invoiceLookupLoading ? '…' : 'Lookup'}
                  </button>
                </div>
              </div>

              {[
                { key: 'customerName', label: 'Customer Name *', placeholder: 'Customer name' },
                { key: 'customerPhone', label: 'Phone', placeholder: '9876543210' },
                { key: 'productName', label: 'Product Name *', placeholder: 'e.g. Samsung 43" TV' },
                { key: 'brandName', label: 'Brand', placeholder: 'Samsung, LG, Sony…' },
                { key: 'modelNumber', label: 'Model No.', placeholder: 'UA43T5500' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    value={newForm[f.key]}
                    onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              ))}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Serial Number</label>
                <input
                  value={newForm.serialNumber}
                  onChange={e => { setNewForm(p => ({ ...p, serialNumber: e.target.value })); checkSerial(e.target.value); }}
                  placeholder="Serial number"
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                />
                {serialAlert && <p className="text-[11px] text-amber-700 font-semibold mt-1">{serialAlert}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">IMEI (if mobile)</label>
                <input
                  value={newForm.imeiNumber}
                  onChange={e => setNewForm(p => ({ ...p, imeiNumber: e.target.value }))}
                  placeholder="15-digit IMEI"
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Issue Description *</label>
                <textarea
                  value={newForm.issueDescription}
                  onChange={e => setNewForm(p => ({ ...p, issueDescription: e.target.value }))}
                  rows={3}
                  placeholder="Describe the problem in detail…"
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Claim Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {['repair', 'replacement', 'refund'].map(t => (
                    <button key={t} type="button" onClick={() => setNewForm(p => ({ ...p, claimType: t }))}
                      className={`h-9 rounded-xl border-2 text-[12px] font-bold capitalize transition-colors ${newForm.claimType === t ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {[
                { key: 'brandTicketNo', label: 'Brand Ticket No.', placeholder: 'Service ticket number' },
                { key: 'receivedBy', label: 'Received By', placeholder: 'Staff name' },
                { key: 'notes', label: 'Notes', placeholder: 'Any additional notes' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    value={newForm[f.key]}
                    onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              ))}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowNewModal(false)} className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 h-11 rounded-xl bg-teal-600 text-white text-[14px] font-black hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Log Claim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && updateTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-black text-slate-900">Update Claim</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">{updateTarget.productName} — {updateTarget.serialNumber || 'No serial'}</p>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-[18px] leading-none hover:bg-slate-200 transition-colors">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {updateError && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">{updateError}</div>}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={updateForm.claimStatus}
                  onChange={e => setUpdateForm(f => ({ ...f, claimStatus: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                >
                  {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>

              {[
                { key: 'brandTicketNo', label: 'Brand Ticket No.', placeholder: 'Service ticket number' },
                { key: 'resolution', label: 'Resolution', placeholder: 'What was done?' },
                { key: 'notes', label: 'Notes', placeholder: 'Any notes' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    value={updateForm[f.key]}
                    onChange={e => setUpdateForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[14px] text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              ))}

              {updateForm.claimStatus === 'ready' && updateTarget.customerPhone && (
                <a href={`https://wa.me/91${updateTarget.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(buildWhatsAppMsg({ ...updateTarget, brandTicketNo: updateForm.brandTicketNo || updateTarget.brandTicketNo }))}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-[13px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
                  📲 Send WhatsApp Notification
                </a>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowUpdateModal(false)} className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleUpdate} disabled={updateSaving} className="flex-1 h-11 rounded-xl bg-teal-600 text-white text-[14px] font-black hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  {updateSaving ? 'Saving…' : 'Save Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
