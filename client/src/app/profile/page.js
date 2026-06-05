'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { validateGSTIN, STATE_CODES } from '../../lib/gstValidation';
import { useIndustry } from '../../contexts/IndustryContext';
import {
  INDIAN_STATES, UNION_TERRITORIES, GSTIN_LENGTH, GSTIN_REGEX,
  GST_STATE_CODE_MAP, normalizeGstin, getToken,
} from '../../lib/constants';
import { INVOICE_TEMPLATES, getSavedTemplate, saveTemplate } from '../../lib/invoiceTemplates';
import { getBusinessConfig } from '../../lib/business-configs';

/* ─── Constants & pure helpers ───────────────────────────────────── */
const STATES = [...INDIAN_STATES, ...UNION_TERRITORIES];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'rent',        labelHi: 'किराया',      labelEn: 'Rent',        emoji: '🏠' },
  { id: 'salary',      labelHi: 'वेतन',         labelEn: 'Salary',      emoji: '👷' },
  { id: 'transport',   labelHi: 'परिवहन',       labelEn: 'Transport',   emoji: '🚛' },
  { id: 'utility',     labelHi: 'बिजली-पानी',   labelEn: 'Utility',     emoji: '💡' },
  { id: 'maintenance', labelHi: 'मरम्मत',        labelEn: 'Maintenance', emoji: '🔧' },
  { id: 'misc',        labelHi: 'अन्य',          labelEn: 'Misc',        emoji: '📦' },
];

const emptyShopForm = {
  name:'', address:'', city:'', state:'', pincode:'', gstin:'',
  phone:'', email:'', bank_name:'', bank_account:'', bank_ifsc:'', bank_branch:'',
  cash_opening_balance:'0', bank_opening_balance:'0', terms:'',
  gst_type: 'regular',
  composition_category: null,
  filing_frequency: 'monthly',
  dashboardMode: 'b2c',
  invoice_prefix: '',
  invoice_number_digits: 4,
  invoice_start_number: 1,
  monthly_target: 0,
};

const getStateFromGstin = (gstin = '') => {
  const n = normalizeGstin(gstin);
  if (n.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(n)) return null;
  return GST_STATE_CODE_MAP[n.slice(0, 2)] || null;
};

const avatarColors = ['from-green-500 to-emerald-600', 'from-violet-500 to-purple-600', 'from-teal-500 to-cyan-600', 'from-rose-500 to-pink-600'];
const getAvatarGrad = (name) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length];

/* ─── Section wrapper ────────────────────────────────────────────── */
function Section({ icon, title, subtitle, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:border-green-200 transition-colors">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-green-100/60 bg-green-50/30">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-black text-slate-900">{title}</p>
            {badge && <span className="px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700">{badge}</span>}
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

const INPUT = 'h-11 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all';
const INPUT_ERR = 'h-11 w-full px-4 rounded-xl border border-rose-300 bg-rose-50 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all';

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const router = useRouter();
  const { updateDashboardMode } = useIndustry();
  const isSubUser = user?.isSubUser === true;

  /* ── Personal profile state (all users) ── */
  const [profileForm, setProfileForm]   = useState({ name: '' });
  const [profileMsg,  setProfileMsg]    = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  /* ── Password state (all users) ── */
  const [pwForm,   setPwForm]   = useState({ current: '', newPwd: '', confirm: '' });
  const [pwMsg,    setPwMsg]    = useState('');
  const [pwError,  setPwError]  = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [showPw,   setShowPw]   = useState({ current: false, newPwd: false, confirm: false });

  /* ── Shop state (owners only) ── */
  const [shop,       setShop]       = useState(null);
  const [shopForm,   setShopForm]   = useState(emptyShopForm);
  const [shopMsg,    setShopMsg]    = useState('');
  const [shopError,  setShopError]  = useState('');
  const [savingShop, setSavingShop] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [nameSubmitAttempted, setNameSubmitAttempted] = useState(false);
  const [gstinError, setGstinError] = useState('');

  /* ── Invoice template preference ── */
  const [invoiceTemplate, setInvoiceTemplate] = useState(() => getSavedTemplate());

  /* ── Expense budget state (owners only) ── */
  const [expenseBudgets, setExpenseBudgets] = useState({});
  const [budgetSaving,   setBudgetSaving]   = useState(false);
  const [budgetMsg,      setBudgetMsg]      = useState('');
  const [budgetError,    setBudgetError]    = useState('');

  const handleTemplateSelect = (templateId) => {
    setInvoiceTemplate(templateId);
    saveTemplate(templateId);
  };

  /* ── Seed personal form from user object ── */
  useEffect(() => {
    if (user?.name) setProfileForm({ name: user.name });
  }, [user?.name]);

  /* ── Load shop data (owners only) ── */
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
      cash_opening_balance: String(data?.cash_opening_balance ?? 0),
      bank_opening_balance: String(data?.bank_opening_balance ?? 0),
      terms:        data?.terms        || '',
      gst_type:     data?.gst_type     || 'regular',
      composition_category: data?.composition_category || null,
      filing_frequency:     data?.filing_frequency     || 'monthly',
      dashboardMode: data?.dashboardMode || 'b2c',
      invoice_prefix:        data?.invoice_prefix        || '',
      invoice_number_digits: data?.invoice_number_digits ?? 4,
      invoice_start_number:  data?.invoice_start_number  ?? 1,
      monthly_target:        data?.monthly_target         ?? 0,
    });
    setIsDirty(false);
  };

  const fetchShop = useCallback(async () => {
    try {
      const res  = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) return;
      const data = await res.json();
      setShop(data);
      loadShopIntoForm(data);
      // Load expense budgets into local map
      const bm = {};
      (data.expense_budgets || []).forEach((b) => { bm[b.category] = b.monthly_limit; });
      setExpenseBudgets(bm);
    } catch {}
  }, []);

  /* ── Save expense budgets (separate from shop form) ── */
  const saveBudgets = async () => {
    setBudgetSaving(true); setBudgetMsg(''); setBudgetError('');
    const budgetArray = Object.entries(expenseBudgets)
      .filter(([, limit]) => Number(limit) > 0)
      .map(([category, monthly_limit]) => ({ category, monthly_limit: Number(monthly_limit) }));
    try {
      const res = await fetch(apiUrl('/api/auth/shop/expense-budgets'), {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ expense_budgets: budgetArray }),
      });
      if (res.ok) {
        setBudgetMsg('Budget limits सेव हो गए');
      } else {
        const d = await res.json();
        setBudgetError(d.message || 'Budget save नहीं हुई।');
      }
    } catch { setBudgetError('Server error — दोबारा try करें।'); }
    setBudgetSaving(false);
  };

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (!isSubUser) {
      const id = setTimeout(() => fetchShop(), 0);
      return () => clearTimeout(id);
    }
  }, [fetchShop, router, user, isSubUser]);

  /* ── Personal profile save ── */
  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(''); setProfileError('');
    const trimmed = profileForm.name.trim();
    if (!trimmed) { setProfileError('Name cannot be empty'); return; }
    setSavingProfile(true);
    try {
      const res = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const updated = { ...stored, name: data.name };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setProfileMsg('Name updated successfully');
      } else {
        setProfileError(data.message || 'Failed to update name');
      }
    } catch { setProfileError('Server error'); }
    setSavingProfile(false);
  };

  /* ── Password change ── */
  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(''); setPwError('');
    if (!pwForm.current) { setPwError('Current password is required'); return; }
    if (pwForm.newPwd.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.newPwd !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    setSavingPw(true);
    try {
      const res = await fetch(apiUrl('/api/auth/password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwForm({ current: '', newPwd: '', confirm: '' });
        setPwMsg('✅ Password बदला गया');
      } else {
        setPwError('❌ ' + (data.message || 'Password नहीं बदला। दोबारा try करें।'));
      }
    } catch { setPwError('Server error'); }
    setSavingPw(false);
  };

  /* ── Shop helpers (owners only) ── */
  const gstinDetectedState = getStateFromGstin(shopForm.gstin);
  const _gstinValidation   = shopForm.gstin.length === GSTIN_LENGTH ? validateGSTIN(shopForm.gstin) : null;
  const gstinInvalid       = shopForm.gstin.length === GSTIN_LENGTH && _gstinValidation && !_gstinValidation.valid;

  const handleGstinChange = (value) => {
    const normalized    = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);
    patchShop({ gstin: normalized, ...(detectedState ? { state: detectedState } : {}) });
  };

  const patchShop = (fields) => {
    setShopForm((c) => ({ ...c, ...fields }));
    setIsDirty(true);
    setShopMsg('');
    setShopError('');
  };

  const updateShop = async (e) => {
    e.preventDefault(); setShopMsg(''); setShopError('');
    setNameSubmitAttempted(true);
    if (!shopForm.name.trim()) { return; }
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
        if (data?.dashboardMode) updateDashboardMode(data.dashboardMode);
        setShopMsg('✅ दुकान की जानकारी सेव हुई');
        setIsDirty(false);
      } else {
        setShopError(data.message || 'Failed to update shop details.');
      }
    } catch { setShopError('Server error'); }
    setSavingShop(false);
  };

  const resetShopForm = () => { loadShopIntoForm(shop || emptyShopForm); setShopMsg(''); setShopError(''); setNameSubmitAttempted(false); setGstinError(''); };

  const completeness = useMemo(() => {
    const fields = [shopForm.name, shopForm.phone, shopForm.gstin, shopForm.state, shopForm.address, shopForm.bank_name, shopForm.bank_account, shopForm.bank_ifsc, shopForm.cash_opening_balance, shopForm.bank_opening_balance];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [shopForm]);

  const avatarGrad = getAvatarGrad(user?.name);

  /* ── Eye toggle button ── */
  const EyeBtn = ({ field }) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
    >
      {showPw[field] ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );

  /* ── Reusable personal + password sections ── */
  const PersonalSection = (
    <Section icon="👤" title="My Details" subtitle="Apna naam update karein">
      {profileMsg && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] font-bold text-emerald-700">
          ✓ {profileMsg}
        </div>
      )}
      {profileError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[12px] font-bold text-rose-700">
          ⚠️ {profileError}
        </div>
      )}
      <form onSubmit={saveProfile} className="space-y-4">
        <Field label="Display Name" required>
          <input
            className={INPUT}
            placeholder="Your name"
            value={profileForm.name}
            onChange={(e) => { setProfileForm({ name: e.target.value }); setProfileMsg(''); setProfileError(''); }}
            required
          />
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile || profileForm.name.trim() === (user?.name || '')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[13px] font-black shadow-md shadow-green-500/20 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 transition-all"
          >
            {savingProfile ? 'Saving...' : 'Update Name'}
          </button>
        </div>
      </form>
    </Section>
  );

  const PasswordSection = (
    <Section icon="🔒" title="Change Password" subtitle="Account security ke liye strong password rakhein">
      {pwMsg && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] font-bold text-emerald-700">
          ✓ {pwMsg}
        </div>
      )}
      {pwError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[12px] font-bold text-rose-700">
          ⚠️ {pwError}
        </div>
      )}
      <form onSubmit={changePassword} className="space-y-4">
        <Field label="Current Password" required>
          <div className="relative">
            <input
              className={INPUT}
              type={showPw.current ? 'text' : 'password'}
              placeholder="Current password"
              value={pwForm.current}
              onChange={(e) => { setPwForm(p => ({ ...p, current: e.target.value })); setPwMsg(''); setPwError(''); }}
              required
            />
            <EyeBtn field="current" />
          </div>
        </Field>
        <Field label="New Password" required>
          <div className="relative">
            <input
              className={INPUT}
              type={showPw.newPwd ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              value={pwForm.newPwd}
              onChange={(e) => { setPwForm(p => ({ ...p, newPwd: e.target.value })); setPwMsg(''); setPwError(''); }}
              required
            />
            <EyeBtn field="newPwd" />
          </div>
        </Field>
        <Field label="Confirm New Password" required>
          <div className="relative">
            <input
              className={pwForm.confirm && pwForm.confirm !== pwForm.newPwd ? INPUT_ERR : INPUT}
              type={showPw.confirm ? 'text' : 'password'}
              placeholder="Repeat new password"
              value={pwForm.confirm}
              onChange={(e) => { setPwForm(p => ({ ...p, confirm: e.target.value })); setPwMsg(''); setPwError(''); }}
              required
            />
            <EyeBtn field="confirm" />
          </div>
          {pwForm.confirm && pwForm.confirm !== pwForm.newPwd && (
            <p className="text-[11px] font-semibold text-rose-600">⚠️ Passwords do not match</p>
          )}
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPw}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[13px] font-black shadow-md shadow-green-500/20 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 transition-all"
          >
            {savingPw ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </form>
    </Section>
  );

  /* ════════════════════════════════════════════════════════════════
     SUB-USER VIEW — only personal sections
  ════════════════════════════════════════════════════════════════ */
  if (isSubUser) {
    return (
      <Layout>
        <div className="desktop-expand w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Hero */}
            <div className="rr-page-hero rr-fade-in">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-[22px] shadow-lg flex-shrink-0`}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-green-200 text-[10px] font-bold uppercase tracking-widest text-green-700 mb-2">
                    👤 My Account
                  </span>
                  <h1 className="text-[22px] lg:text-[24px] font-black text-slate-900 leading-tight truncate">
                    {user?.name || 'My Profile'}
                  </h1>
                  <p className="text-[12px] text-slate-500 mt-0.5 capitalize">
                    {user?.role || 'Team Member'} · @{user?.username}
                  </p>
                </div>
              </div>
            </div>

            {PersonalSection}
            {PasswordSection}

          </div>
        </div>
      </Layout>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     OWNER VIEW — personal sections + full shop management
  ════════════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="desktop-expand w-full px-4 sm:px-6 lg:px-8 pt-6 pb-28">
        <div className="max-w-3xl mx-auto space-y-5 rr-fade-in">

          {/* ══ HERO HEADER ══════════════════════════════════════════ */}
          <div className="rr-page-hero">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-[22px] shadow-lg flex-shrink-0`}>
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-green-200 text-[10px] font-bold uppercase tracking-widest text-green-700 mb-2">
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
            <div className="mt-5">
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
            <div className="flex flex-wrap gap-2 mt-4">
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

          {/* ── Personal + Password (owner) ── */}
          {PersonalSection}
          {PasswordSection}

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

          {/* ── Shop alerts ── */}
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

          {/* ── SHOP FORM ── */}
          <form onSubmit={updateShop} className="space-y-5">

            {/* ══ SHOP DETAILS ════════════════════════════════════ */}
            <Section icon="🏪" title="Shop Details" subtitle="GST, billing identity और printed invoice information">

              <Field label="Shop Name" required>
                <input
                  id="name"
                  className={INPUT}
                  placeholder="Ramesh General Store"
                  value={shopForm.name}
                  onChange={(e) => patchShop({ name: e.target.value })}
                  required
                />
                {nameSubmitAttempted && !shopForm.name.trim() && (
                  <p className="text-[11px] text-rose-600 mt-1 px-1">दुकान का नाम ज़रूरी है</p>
                )}
              </Field>

              {/* ── GST Registration Type ── */}
              <Field label="GST Registration Type" hint="Aapka GST scheme type select karein">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'regular',       label: 'Regular',       desc: 'GSTR-1 + 3B' },
                    { value: 'composition',   label: 'Composition',   desc: 'No ITC, % on turnover' },
                    { value: 'unregistered',  label: 'Unregistered',  desc: 'No GSTIN yet' },
                    { value: 'exempt',        label: 'Exempt',        desc: 'GST not applicable' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patchShop({ gst_type: opt.value, composition_category: null })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-center transition-all ${
                        shopForm.gst_type === opt.value
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-[12px] font-black">{opt.label}</span>
                      <span className="text-[10px] text-slate-400">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>

              {/* ── Composition: category + rate ── */}
              {shopForm.gst_type === 'composition' && (
                <div className="space-y-3">
                  <Field label="Composition Category">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'trader',     label: 'Trader / Manufacturer', rate: '1%' },
                        { value: 'restaurant', label: 'Restaurant',             rate: '5%' },
                        { value: 'service',    label: 'Service Provider',       rate: '6%' },
                      ].map(cat => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => patchShop({ composition_category: cat.value })}
                          className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-center transition-all ${
                            shopForm.composition_category === cat.value
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[12px] font-black">{cat.label}</span>
                          <span className="text-[11px] font-bold text-blue-600">{cat.rate} on turnover</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <p className="text-[12px] text-amber-800 leading-relaxed">
                      <strong>Composition Scheme:</strong> You cannot collect GST from customers or claim ITC on purchases.
                      File CMP-08 quarterly (due 18th of month after quarter end).
                    </p>
                  </div>
                </div>
              )}

              {/* ── Regular: filing frequency ── */}
              {shopForm.gst_type === 'regular' && (
                <Field label="Filing Frequency" hint="QRMP = Quarterly GSTR-1 + GSTR-3B (eligible if turnover ≤ ₹5 crore)">
                  <div className="flex gap-2">
                    {[
                      { value: 'monthly',   label: 'Monthly',              desc: 'GSTR-1: 11th, 3B: 20th' },
                      { value: 'quarterly', label: 'Quarterly (QRMP)',     desc: 'GSTR-1: 13th, 3B: 22nd/24th' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => patchShop({ filing_frequency: opt.value })}
                        className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-center transition-all ${
                          shopForm.filing_frequency === opt.value
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-[13px] font-black">{opt.label}</span>
                        <span className="text-[10px] text-slate-400">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {/* ── Unregistered: turnover warning ── */}
              {shopForm.gst_type === 'unregistered' && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-base flex-shrink-0">⚠️</span>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    If annual turnover exceeds <strong>₹40 lakh</strong> (₹20 lakh for services), GST registration is mandatory.
                    Contact your CA to register before crossing the threshold.
                  </p>
                </div>
              )}

              {/* ── GSTIN field (show for registered types) ── */}
              {(shopForm.gst_type === 'regular' || shopForm.gst_type === 'composition') && (
                <Field
                  label="GSTIN"
                  hint="15-digit GST Identification Number"
                  success={(() => {
                    if (shopForm.gstin.length !== 15) return '';
                    const r = validateGSTIN(shopForm.gstin);
                    return r.valid ? `✓ ${r.stateName} (${r.stateCode})` : '';
                  })()}
                  error={(() => {
                    if (!shopForm.gstin || shopForm.gstin.length < 15) return '';
                    const r = validateGSTIN(shopForm.gstin);
                    return r.valid ? '' : r.error;
                  })()}
                >
                  {(() => {
                    if (shopForm.gstin.length === 15) {
                      const r = validateGSTIN(shopForm.gstin);
                      if (r.valid && r.checksumWarning) {
                        return <p className="text-[11px] text-amber-600 mb-1">⚠️ {r.checksumWarning}</p>;
                      }
                    }
                    return null;
                  })()}
                  <input
                    id="gstin"
                    className={(() => {
                      if (!shopForm.gstin || shopForm.gstin.length < 15) return INPUT;
                      return validateGSTIN(shopForm.gstin).valid ? INPUT : INPUT_ERR;
                    })()}
                    placeholder="22AAAAA0000A1Z5"
                    value={shopForm.gstin}
                    maxLength={GSTIN_LENGTH}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    onBlur={() => {
                      if (shopForm.gstin.length > 0 && !GSTIN_REGEX.test(shopForm.gstin)) {
                        setGstinError('GSTIN format सही नहीं है (उदाहरण: 22AAAAA0000A1Z5)');
                      } else {
                        setGstinError('');
                      }
                    }}
                    onFocus={() => setGstinError('')}
                  />
                  {shopForm.gstin && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            shopForm.gstin.length === GSTIN_LENGTH
                              ? validateGSTIN(shopForm.gstin).valid ? 'bg-emerald-500' : 'bg-rose-500'
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
                  {gstinError && <p className="text-[11px] text-rose-600 mt-1 px-1">{gstinError}</p>}
                </Field>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone">
                  <input
                    id="phone"
                    className={INPUT}
                    placeholder="9876543210"
                    value={shopForm.phone}
                    onChange={(e) => patchShop({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    id="email"
                    className={INPUT}
                    placeholder="shop@email.com"
                    type="email"
                    value={shopForm.email}
                    onChange={(e) => patchShop({ email: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Address" hint="Invoice पर print होगा">
                <textarea
                  className={`${INPUT} h-auto py-3 resize-none`}
                  rows={3}
                  placeholder="Street, area, landmark..."
                  value={shopForm.address}
                  onChange={(e) => patchShop({ address: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="City">
                  <input
                    className={INPUT}
                    placeholder="Lucknow"
                    value={shopForm.city}
                    onChange={(e) => patchShop({ city: e.target.value })}
                  />
                </Field>
                <Field label="Pincode">
                  <input
                    className={INPUT}
                    placeholder="226001"
                    maxLength={6}
                    value={shopForm.pincode}
                    onChange={(e) => patchShop({ pincode: e.target.value })}
                  />
                </Field>
                <div className="col-span-2 sm:col-span-1">
                  <Field label="State">
                    <select
                      id="state"
                      className={`${INPUT} cursor-pointer`}
                      value={shopForm.state}
                      onChange={(e) => patchShop({ state: e.target.value })}
                    >
                      <option value="">State चुनें</option>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </Section>

            {/* ══ BANK DETAILS ════════════════════════════════════ */}
            <Section icon="🏦" title="Bank Details" subtitle="Invoice पर print होगा — professional billing के लिए" badge="Optional">
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-100 -mt-1">
                <span className="text-base flex-shrink-0">💡</span>
                <p className="text-[12px] text-green-700 leading-relaxed">
                  Bank details add करने से customers directly आपके account में payment कर सकते हैं और invoice professional लगती है।
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bank Name">
                  <input className={INPUT} placeholder="State Bank of India" value={shopForm.bank_name} onChange={(e) => patchShop({ bank_name: e.target.value })} />
                </Field>
                <Field label="Branch">
                  <input className={INPUT} placeholder="Main Branch, Hazratganj" value={shopForm.bank_branch} onChange={(e) => patchShop({ bank_branch: e.target.value })} />
                </Field>
                <Field label="Account Number">
                  <input className={INPUT} placeholder="0000000000" value={shopForm.bank_account} onChange={(e) => patchShop({ bank_account: e.target.value })} />
                </Field>
                <Field label="IFSC Code">
                  <input className={INPUT} placeholder="SBIN0000000" value={shopForm.bank_ifsc} onChange={(e) => patchShop({ bank_ifsc: e.target.value.toUpperCase() })} />
                </Field>
              </div>
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

            <Section icon="📒" title="Accounting Setup" subtitle="Opening balances yahin se carry forward honge" badge="Ledger">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Cash Opening Balance" hint="Cash book ka brought forward amount">
                  <input className={INPUT} type="number" step="0.01" value={shopForm.cash_opening_balance} onChange={(e) => patchShop({ cash_opening_balance: e.target.value })} />
                </Field>
                <Field label="Bank Opening Balance" hint="Bank ledger ka opening amount">
                  <input className={INPUT} type="number" step="0.01" value={shopForm.bank_opening_balance} onChange={(e) => patchShop({ bank_opening_balance: e.target.value })} />
                </Field>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Accounting Preview</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <div className="text-[11px] text-slate-400">Cash</div>
                    <div className="text-[16px] font-black text-emerald-600">₹{Number(shopForm.cash_opening_balance || 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <div className="text-[11px] text-slate-400">Bank</div>
                    <div className="text-[16px] font-black text-green-700">₹{Number(shopForm.bank_opening_balance || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ══ INVOICE NUMBER FORMAT ═══════════════════════════ */}
            <Section icon="🧾" title="Invoice Number Format" subtitle="अपनी दुकान का invoice numbering customize करें">
              <Field label="Invoice Prefix" hint="जैसे INV, RAM/24-25, या खाली छोड़ें (max 10 chars)">
                <input
                  className={INPUT}
                  placeholder="INV"
                  maxLength={10}
                  value={shopForm.invoice_prefix}
                  onChange={(e) => patchShop({ invoice_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9\/\-_]/g, '') })}
                />
              </Field>

              <Field label="Digits" hint="4 digits = 0001, 0002 | 3 digits = 001, 002">
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((d) => (
                    <button key={d} type="button"
                      onClick={() => patchShop({ invoice_number_digits: d })}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-[14px] font-black transition-all ${
                        shopForm.invoice_number_digits === d
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >{d}</button>
                  ))}
                </div>
              </Field>

              <Field
                label="शुरुआती Number"
                hint="अगला invoice इस number से शुरू होगा"
                error={shop?.invoice_last_number > 0 && Number(shopForm.invoice_start_number) <= (shop.invoice_last_number || 0)
                  ? `⚠️ आपके पास पहले से ${shop.invoice_last_number} invoices हैं। Duplicate numbers बन सकते हैं।`
                  : ''}
              >
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  value={shopForm.invoice_start_number}
                  onChange={(e) => patchShop({ invoice_start_number: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>

              {/* Live preview */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Preview</p>
                <p className="text-[18px] font-black text-green-800">
                  {shopForm.invoice_prefix
                    ? `${shopForm.invoice_prefix}-${String(shopForm.invoice_start_number || 1).padStart(shopForm.invoice_number_digits || 4, '0')}`
                    : String(shopForm.invoice_start_number || 1).padStart(shopForm.invoice_number_digits || 4, '0')
                  }
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">अगले invoice का number</p>
              </div>
            </Section>

            {/* ══ TERMS & CONDITIONS ══════════════════════════════ */}
            <Section icon="📄" title="Terms & Conditions" subtitle="Invoice पर print होगा — clear business communication के लिए" badge="Optional">
              <Field label="Terms" hint="Each line = one term. Invoice पर numbered list बनेगी।">
                <textarea
                  className={`${INPUT} h-auto py-3 resize-none`}
                  rows={5}
                  placeholder={`Goods once sold will not be taken back.\nPayment due within 30 days.\nSubject to local jurisdiction.`}
                  value={shopForm.terms}
                  onChange={(e) => patchShop({ terms: e.target.value })}
                />
              </Field>
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

            {/* ══ DASHBOARD MODE ══════════════════════════════════ */}
            <Section icon="📊" title="Dashboard का प्रकार" subtitle="आपका business किस तरह काम करता है?">
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    value: 'b2c',
                    emoji: '🛍️',
                    label: 'केवल Retail (B2C)',
                    desc: 'सीधे ग्राहकों को बेचते हो',
                    subdesc: 'Fast cash billing, Udhaar, Stock alerts',
                  },
                  {
                    value: 'b2b',
                    emoji: '🏭',
                    label: 'Wholesale / B2B',
                    desc: 'दुकानदारों / dealers को बेचते हो',
                    subdesc: 'Tax invoice, Challan, Outstanding receivables',
                  },
                  {
                    value: 'hybrid',
                    emoji: '🔄',
                    label: 'दोनों (Hybrid)',
                    desc: 'Retail भी, Wholesale भी',
                    subdesc: 'Full feature access, smart panels',
                  },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patchShop({ dashboardMode: opt.value })}
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                      shopForm.dashboardMode === opt.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-black leading-tight ${shopForm.dashboardMode === opt.value ? 'text-green-800' : 'text-slate-900'}`}>
                        {opt.label}
                      </p>
                      <p className={`text-[12px] font-medium mt-0.5 ${shopForm.dashboardMode === opt.value ? 'text-green-700' : 'text-slate-500'}`}>
                        {opt.desc}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{opt.subdesc}</p>
                    </div>
                    {shopForm.dashboardMode === opt.value && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[11px] font-black">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </Section>

            {/* ══ DEFAULT INVOICE TEMPLATE ════════════════════════ */}
            <Section icon="🧾" title="Default Invoice Template" subtitle="Print और share के लिए default template चुनें" badge="Billing">
              <div className="grid grid-cols-1 gap-3">
                {Object.values(INVOICE_TEMPLATES).map((t) => {
                  const isSelected = invoiceTemplate === t.id;
                  const PREVIEW_LINES = {
                    minimal:  ['Shop Name', '─────────', 'Item      Qty  ₹Amt', 'Product A  2   60.00', '─────────', 'Total: ₹60.00'],
                    detailed: ['SHOP NAME           TAX INVOICE', '──────────────────────────────', 'Bill To: Customer Name', 'Particulars | HSN | Qty | Rate | CGST | SGST | Amt', '═══════════════════════════', 'Grand Total: ₹1,200.00'],
                    gst_tax:  ['GST TAX INVOICE', '──────────────────', 'IRN: (Not Generated)', 'Reverse Charge: No', 'CGST% | CGST ₹ | SGST% | SGST ₹', '══════════════════', 'Authorised Signatory'],
                  };
                  return (
                    <button key={t.id} type="button" onClick={() => handleTemplateSelect(t.id)}
                      className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                        isSelected ? 'border-green-500 shadow-md shadow-green-500/10' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Mini preview area */}
                      <div className={`px-4 py-3 font-mono text-[9px] leading-relaxed ${isSelected ? 'bg-green-50' : 'bg-slate-50'}`}>
                        {(PREVIEW_LINES[t.id] || []).map((line, i) => (
                          <div key={i} className="text-slate-600 truncate">{line}</div>
                        ))}
                      </div>
                      {/* Label row */}
                      <div className={`flex items-center justify-between px-4 py-3 ${isSelected ? 'bg-green-50 border-t border-green-200' : 'bg-white border-t border-slate-100'}`}>
                        <div>
                          <p className={`text-[14px] font-black ${isSelected ? 'text-green-800' : 'text-slate-900'}`}>{t.label} <span className="text-[11px] font-semibold text-slate-400">({t.labelHi})</span></p>
                          <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>{t.description}</p>
                        </div>
                        {isSelected && <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[11px] font-black ml-3">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 text-center">Bill बनाते time per-bill override भी कर सकते हो।</p>
            </Section>

            {/* ══ MONTHLY SALES TARGET ══════════════════════════════ */}
            <Section icon="🎯" title="Monthly Sales Target" subtitle="Dashboard पर progress track करने के लिए" badge="Optional">
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-100 -mt-1">
                <span className="text-base flex-shrink-0">💡</span>
                <p className="text-[12px] text-green-700 leading-relaxed">
                  Monthly target set करने पर dashboard पर progress bar दिखेगा — ₹0 रखने पर feature बंद हो जाएगा।
                </p>
              </div>
              <Field label="Monthly Revenue Target (₹)" hint="इस महीने कितना कमाना है?">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-[15px]">₹</span>
                  <input
                    className={`${INPUT} pl-7`}
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="0"
                    value={shopForm.monthly_target || ''}
                    onChange={(e) => patchShop({ monthly_target: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </Field>
              {shopForm.monthly_target > 0 && (
                <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Target Preview</p>
                  <p className="text-[18px] font-black text-green-800">₹{Number(shopForm.monthly_target).toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">हर महीने dashboard पर यही दिखेगा</p>
                </div>
              )}
            </Section>

            {/* ══ EXPENSE BUDGET LIMITS ══════════════════════════ */}
            <Section icon="📊" title="Monthly Expense Budgets" subtitle="हर category के लिए monthly limit set करें" badge="Optional">
              {budgetMsg && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] font-bold text-emerald-700">
                  ✓ {budgetMsg}
                </div>
              )}
              {budgetError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[12px] font-bold text-rose-700">
                  ⚠️ {budgetError}
                </div>
              )}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 -mt-1">
                <span className="text-base flex-shrink-0">💡</span>
                <p className="text-[12px] text-blue-700 leading-relaxed">
                  Monthly budget set करने पर expenses page पर progress bar दिखेगा। ₹0 मतलब no limit।
                </p>
              </div>
              <div className="space-y-3">
                {(() => {
                  const bizCfg    = getBusinessConfig(shop?.businessType || '');
                  const categories = bizCfg.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
                  return categories.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">
                        {cat.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-700">
                          {cat.labelHi}{' '}
                          <span className="text-slate-400 font-normal">/ {cat.labelEn}</span>
                        </p>
                      </div>
                      <div className="relative w-28 flex-shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-[13px]">₹</span>
                        <input
                          className={`${INPUT} pl-6 text-[13px] h-10`}
                          type="number"
                          min={0}
                          step={100}
                          placeholder="0"
                          value={expenseBudgets[cat.id] || ''}
                          onChange={(e) => {
                            setExpenseBudgets((prev) => ({
                              ...prev,
                              [cat.id]: Math.max(0, Number(e.target.value) || 0),
                            }));
                            setBudgetMsg('');
                            setBudgetError('');
                          }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={saveBudgets} disabled={budgetSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-[13px] font-black shadow-md disabled:opacity-50 transition-all hover:from-blue-700 hover:to-indigo-800">
                  {budgetSaving ? 'Saving...' : 'Budget Save करें →'}
                </button>
              </div>
            </Section>

            {/* ══ SAVE ACTIONS ════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
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
                        ? 'bg-gradient-to-r from-green-600 to-emerald-700 shadow-green-500/25'
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
