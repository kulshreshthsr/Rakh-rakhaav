'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

/* ─── Constants & pure helpers (ALL UNCHANGED) ───────────────────── */
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh'];
const GSTIN_LENGTH = 15;
const GSTIN_REGEX  = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_STATE_CODE_MAP = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand',
  '06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim',
  '12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
  '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh',
  '23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli and Daman & Diu','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu',
  '34':'Puducherry','35':'Andaman & Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh',
};

const emptyShopForm = {
  name:'', address:'', city:'', state:'', pincode:'', gstin:'',
  phone:'', email:'', bank_name:'', bank_account:'', bank_ifsc:'', bank_branch:'', terms:'',
};

const normalizeGstin = (value = '') => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, GSTIN_LENGTH);
const getStateFromGstin = (gstin = '') => {
  const n = normalizeGstin(gstin);
  if (n.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(n)) return null;
  return GST_STATE_CODE_MAP[n.slice(0, 2)] || null;
};

/* ─── Section wrapper ────────────────────────────────────────────── */
function Section({ icon, title, subtitle, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-black text-slate-900">{title}</p>
            {badge && <span className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-[10px] font-bold text-cyan-700">{badge}</span>}
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

/* ─── Form field ─────────────────────────────────────────────────── */
function Field({ label, hint, error, success, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {success && <p className="text-[11px] font-semibold text-emerald-600">✓ {success}</p>}
      {error   && <p className="text-[11px] font-semibold text-rose-600">⚠️ {error}</p>}
      {hint    && !success && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const INPUT = 'h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 focus:bg-white transition-all';
const INPUT_ERR = 'h-11 w-full px-4 rounded-xl border border-rose-300 bg-rose-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all';

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  /* ── All state (UNCHANGED) ── */
  const [user] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [shop,       setShop]       = useState(null);
  const [shopForm,   setShopForm]   = useState(emptyShopForm);
  const [shopMsg,    setShopMsg]    = useState('');
  const [shopError,  setShopError]  = useState('');
  const [savingShop, setSavingShop] = useState(false);
  const router = useRouter();

  /* ── NEW: track which section is "dirty" so save button highlights ── */
  const [isDirty, setIsDirty] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const loadShopIntoForm = (data) => {
    setShopForm({
      name:         data?.name         || '',
      address:      data?.address      || '',
      city:         data?.city         || '',
      state:        data?.state        || '',
      pincode:      data?.pincode      || '',
      gstin:        data?.gstin        || '',
      phone:        data?.phone        || '',
      email:        data?.email        || '',
      bank_name:    data?.bank_name    || '',
      bank_account: data?.bank_account || '',
      bank_ifsc:    data?.bank_ifsc    || '',
      bank_branch:  data?.bank_branch  || '',
      terms:        data?.terms        || '',
    });
    setIsDirty(false);
  };

  const fetchShop = useCallback(async () => {
    try {
      const res  = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      setShop(data);
      loadShopIntoForm(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    const id = setTimeout(() => fetchShop(), 0);
    return () => clearTimeout(id);
  }, [fetchShop, router, user]);

  /* ── Derived (UNCHANGED) ── */
  const gstinDetectedState = getStateFromGstin(shopForm.gstin);
  const gstinInvalid = shopForm.gstin.length > 0 && shopForm.gstin.length === GSTIN_LENGTH && !gstinDetectedState;

  const handleGstinChange = (value) => {
    const normalized    = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    patch({ gstin: normalized, ...(detectedState ? { state: detectedState } : {}) });
  };

  /* patch helper — sets dirty */
  const patch = (fields) => {
    setShopForm((c) => ({ ...c, ...fields }));
    setIsDirty(true);
    setShopMsg('');
    setShopError('');
  };

  const updateShop = async (e) => {
    e.preventDefault(); setShopMsg(''); setShopError('');
    if (gstinInvalid) { setShopError('Please enter a valid GSTIN before saving.'); return; }
    setSavingShop(true);
    try {
      const res  = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(shopForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShop(data); loadShopIntoForm(data);
        setShopMsg('Shop details saved successfully ✓');
        setIsDirty(false);
      } else {
        setShopError(data.message || 'Failed to update shop details.');
      }
    } catch { setShopError('Server error'); }
    setSavingShop(false);
  };

  const resetShopForm = () => { loadShopIntoForm(shop || emptyShopForm); setShopMsg(''); setShopError(''); };

  /* ── Profile completeness (NEW) ── */
  const completeness = useMemo(() => {
    const fields = [shopForm.name, shopForm.phone, shopForm.gstin, shopForm.state, shopForm.address, shopForm.bank_name, shopForm.bank_account, shopForm.bank_ifsc];
    const filled  = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [shopForm]);

  /* Avatar gradient */
  const avatarColors = ['from-cyan-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600'];
  const avatarGrad   = avatarColors[(user?.name?.charCodeAt(0) || 0) % avatarColors.length];

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* ══ HERO HEADER ══════════════════════════════════════════ */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50/60 to-cyan-50/40 border border-slate-200 p-5 lg:p-6 shadow-sm">
            <div className="pointer-events-none absolute -top-12 -right-10 w-48 h-48 rounded-full bg-cyan-200/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-blue-200/15 blur-3xl" />

            <div className="relative flex items-start gap-4">
              {/* Avatar */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-[22px] shadow-lg flex-shrink-0`}>
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-cyan-200 text-[10px] font-bold uppercase tracking-widest text-cyan-700 mb-2">
                  🏪 Shop Profile
                </span>
                <h1 className="text-[22px] lg:text-[26px] font-black text-slate-900 leading-tight truncate">
                  {user?.name || 'Profile & Settings'}
                </h1>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Shop identity, invoice details और account setup — सब एक जगह
                </p>
              </div>
            </div>

            {/* Profile completeness bar */}
            <div className="relative mt-5">
              <div className="flex items-center justify-between text-[12px] mb-2">
                <span className="font-bold text-slate-600">Profile Completeness</span>
                <span className={`font-black ${completeness >= 80 ? 'text-emerald-600' : completeness >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {completeness}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    completeness >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                    completeness >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                    'bg-gradient-to-r from-rose-500 to-pink-500'
                  }`}
                  style={{ width: `${completeness}%` }}
                />
              </div>
              {completeness < 100 && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {completeness < 50 ? 'Shop name, GSTIN और bank details add करें' :
                   completeness < 80 ? 'Bank details add करने से invoice professional लगेगा' :
                   'Almost done — address और email add करें'}
                </p>
              )}
            </div>

            {/* Quick info chips */}
            <div className="relative flex flex-wrap gap-2 mt-4">
              {[
                { label: shopForm.gstin   || 'GSTIN missing',  icon: '📋', ok: Boolean(shopForm.gstin)   },
                { label: shopForm.phone   || 'Phone missing',  icon: '📞', ok: Boolean(shopForm.phone)   },
                { label: shopForm.state   || 'State not set',  icon: '📍', ok: Boolean(shopForm.state)   },
                { label: shopForm.email   || 'Email missing',  icon: '✉️', ok: Boolean(shopForm.email)   },
              ].map((chip) => (
                <span key={chip.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${
                  chip.ok
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {chip.icon} {chip.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Dirty banner ── */}
          {isDirty && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[13px] font-black text-amber-800">Unsaved changes हैं</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={resetShopForm}
                  className="text-[12px] font-bold text-amber-700 hover:underline"
                >Discard</button>
                <button type="button" onClick={updateShop} disabled={savingShop}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[12px] font-black hover:bg-amber-600 transition-colors"
                >Save Now</button>
              </div>
            </div>
          )}

          {/* ── Global alerts ── */}
          {shopMsg && (
            <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[13px] font-bold text-emerald-700">
              ✓ {shopMsg}
            </div>
          )}
          {shopError && (
            <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-[13px] font-bold text-rose-700">
              ⚠️ {shopError}
            </div>
          )}

          {/* ── FORM ── */}
          <form onSubmit={updateShop} className="space-y-5">

            {/* ══ SHOP DETAILS ════════════════════════════════════ */}
            <Section icon="🏪" title="Shop Details" subtitle="GST, billing identity और printed invoice information">

              {/* Shop name */}
              <Field label="Shop Name" required>
                <input
                  id="name"
                  className={INPUT}
                  placeholder="Ramesh General Store"
                  value={shopForm.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  required
                />
              </Field>

              {/* GSTIN */}
              <Field
                label="GSTIN"
                hint="15-digit GST number — state auto-detect होगी"
                success={gstinDetectedState && shopForm.state ? `State detected: ${shopForm.state}` : ''}
                error={gstinInvalid ? 'Invalid GSTIN format' : ''}
              >
                <input
                  id="gstin"
                  className={gstinInvalid ? INPUT_ERR : INPUT}
                  placeholder="22AAAAA0000A1Z5"
                  value={shopForm.gstin}
                  maxLength={GSTIN_LENGTH}
                  onChange={(e) => handleGstinChange(e.target.value)}
                />
                {shopForm.gstin && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          shopForm.gstin.length === GSTIN_LENGTH
                            ? gstinInvalid ? 'bg-rose-500' : 'bg-emerald-500'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${(shopForm.gstin.length / GSTIN_LENGTH) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">
                      {shopForm.gstin.length}/{GSTIN_LENGTH}
                    </span>
                  </div>
                )}
              </Field>

              {/* Phone + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone">
                  <input
                    id="phone"
                    className={INPUT}
                    placeholder="9876543210"
                    value={shopForm.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    id="email"
                    className={INPUT}
                    placeholder="shop@email.com"
                    type="email"
                    value={shopForm.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
              </div>

              {/* Address */}
              <Field label="Address" hint="Invoice पर print होगा">
                <textarea
                  className={`${INPUT} h-auto py-3 resize-none`}
                  rows={3}
                  placeholder="Street, area, landmark..."
                  value={shopForm.address}
                  onChange={(e) => patch({ address: e.target.value })}
                />
              </Field>

              {/* City + Pincode + State */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="City">
                  <input
                    className={INPUT}
                    placeholder="Lucknow"
                    value={shopForm.city}
                    onChange={(e) => patch({ city: e.target.value })}
                  />
                </Field>
                <Field label="Pincode">
                  <input
                    className={INPUT}
                    placeholder="226001"
                    maxLength={6}
                    value={shopForm.pincode}
                    onChange={(e) => patch({ pincode: e.target.value })}
                  />
                </Field>
                <div className="col-span-2 sm:col-span-1">
                  <Field label="State">
                    <select
                      id="state"
                      className={`${INPUT} cursor-pointer`}
                      value={shopForm.state}
                      onChange={(e) => patch({ state: e.target.value })}
                    >
                      <option value="">State चुनें</option>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </Section>

            {/* ══ BANK DETAILS ════════════════════════════════════ */}
            <Section
              icon="🏦"
              title="Bank Details"
              subtitle="Invoice पर print होगा — professional billing के लिए"
              badge="Optional"
            >
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 -mt-1">
                <span className="text-base flex-shrink-0">💡</span>
                <p className="text-[12px] text-blue-700 leading-relaxed">
                  Bank details add करने से customers directly आपके account में payment कर सकते हैं और invoice professional लगती है।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bank Name">
                  <input
                    className={INPUT}
                    placeholder="State Bank of India"
                    value={shopForm.bank_name}
                    onChange={(e) => patch({ bank_name: e.target.value })}
                  />
                </Field>
                <Field label="Branch">
                  <input
                    className={INPUT}
                    placeholder="Main Branch, Hazratganj"
                    value={shopForm.bank_branch}
                    onChange={(e) => patch({ bank_branch: e.target.value })}
                  />
                </Field>
                <Field label="Account Number">
                  <input
                    className={INPUT}
                    placeholder="0000000000"
                    value={shopForm.bank_account}
                    onChange={(e) => patch({ bank_account: e.target.value })}
                  />
                </Field>
                <Field label="IFSC Code">
                  <input
                    className={INPUT}
                    placeholder="SBIN0000000"
                    value={shopForm.bank_ifsc}
                    onChange={(e) => patch({ bank_ifsc: e.target.value.toUpperCase() })}
                  />
                </Field>
              </div>

              {/* Bank preview */}
              {(shopForm.bank_name || shopForm.bank_account) && (
                <div className="mt-2 px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Invoice Preview</p>
                  <div className="space-y-1">
                    {shopForm.bank_name    && <div className="text-[12px] text-slate-700">Bank: <span className="font-bold">{shopForm.bank_name}</span></div>}
                    {shopForm.bank_branch  && <div className="text-[12px] text-slate-700">Branch: <span className="font-bold">{shopForm.bank_branch}</span></div>}
                    {shopForm.bank_account && <div className="text-[12px] text-slate-700">A/C: <span className="font-bold font-mono">{shopForm.bank_account}</span></div>}
                    {shopForm.bank_ifsc    && <div className="text-[12px] text-slate-700">IFSC: <span className="font-bold font-mono">{shopForm.bank_ifsc}</span></div>}
                  </div>
                </div>
              )}
            </Section>

            {/* ══ TERMS & CONDITIONS ══════════════════════════════ */}
            <Section
              icon="📄"
              title="Terms & Conditions"
              subtitle="Invoice पर print होगा — clear business communication के लिए"
              badge="Optional"
            >
              <Field
                label="Terms"
                hint="Each line = one term. Invoice पर numbered list बनेगी।"
              >
                <textarea
                  className={`${INPUT} h-auto py-3 resize-none`}
                  rows={5}
                  placeholder={`Goods once sold will not be taken back.\nPayment due within 30 days.\nSubject to local jurisdiction.`}
                  value={shopForm.terms}
                  onChange={(e) => patch({ terms: e.target.value })}
                />
              </Field>

              {/* Terms preview */}
              {shopForm.terms && (
                <div className="px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Invoice Preview</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    {shopForm.terms.split('\n').filter(Boolean).map((term, i) => (
                      <li key={i} className="text-[12px] text-slate-700">{term}</li>
                    ))}
                  </ol>
                </div>
              )}
            </Section>

            {/* ══ SAVE ACTIONS ════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[13px] font-black text-slate-900">Changes save करें</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isDirty ? '⚠️ Unsaved changes हैं — save करना न भूलें' : '✓ All changes saved'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetShopForm}
                    disabled={savingShop || !isDirty}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingShop}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[14px] font-black text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:translate-y-0 transition-all ${
                      isDirty
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/25'
                        : 'bg-gradient-to-r from-slate-400 to-slate-500 shadow-slate-400/20'
                    }`}
                  >
                    {savingShop ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Saving...
                      </>
                    ) : isDirty ? 'Save Changes →' : 'Saved ✓'}
                  </button>
                </div>
              </div>

              {/* Completeness reminder */}
              {completeness < 80 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 mb-2">Complete करने के लिए add करें:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'GSTIN',        missing: !shopForm.gstin        },
                      { label: 'Phone',         missing: !shopForm.phone        },
                      { label: 'State',         missing: !shopForm.state        },
                      { label: 'Address',       missing: !shopForm.address      },
                      { label: 'Bank Details',  missing: !shopForm.bank_name    },
                      { label: 'Account No.',   missing: !shopForm.bank_account },
                    ].filter((f) => f.missing).map((f) => (
                      <span key={f.label} className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">
                        + {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>

        </div>
      </div>
    </Layout>
  );
}