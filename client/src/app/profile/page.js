'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

/* ─── Constants & pure helpers ───────────────────────────────────── */
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
  phone:'', email:'', bank_name:'', bank_account:'', bank_ifsc:'', bank_branch:'',
  cash_opening_balance:'0', bank_opening_balance:'0', owner_photo:'', terms:'',
};

const normalizeGstin = (value = '') => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, GSTIN_LENGTH);
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
            <p className="text-[14px] font-black text-slate-900">{title}</p>
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const getToken = () => localStorage.getItem('token');

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
      owner_photo:  data?.owner_photo  || '',
      terms:        data?.terms        || '',
    });
    setIsDirty(false);
  };

  const fetchShop = useCallback(async () => {
    try {
      const res  = await fetch(apiUrl('/api/auth/shop'), { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setShop(data);
      loadShopIntoForm(data);
    } catch {}
  }, []);

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
        setPwMsg('Password changed successfully');
      } else {
        setPwError(data.message || 'Failed to change password');
      }
    } catch { setPwError('Server error'); }
    setSavingPw(false);
  };

  /* ── Shop helpers (owners only) ── */
  const gstinDetectedState = getStateFromGstin(shopForm.gstin);
  const gstinInvalid = shopForm.gstin.length > 0 && shopForm.gstin.length === GSTIN_LENGTH && !gstinDetectedState;

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

  const handleOwnerPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setShopError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setShopError('Photo size should be 5MB or less.'); return; }
    setPhotoUploading(true); setShopError(''); setShopMsg('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Image read failed'));
        reader.readAsDataURL(file);
      });
      patchShop({ owner_photo: dataUrl });
      setShopMsg('Photo selected. Save changes to update dashboard.');
    } catch {
      setShopError('Photo upload nahi ho paaya.');
    } finally {
      setPhotoUploading(false);
    }
  };

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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50/60 to-green-50/40 border border-slate-200 p-5 lg:p-6 shadow-sm">
              <div className="pointer-events-none absolute -top-12 -right-10 w-48 h-48 rounded-full bg-green-200/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-emerald-200/15 blur-3xl" />
              <div className="relative flex items-center gap-4">
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
        <div className="max-w-3xl mx-auto space-y-5">

          {/* ══ HERO HEADER ══════════════════════════════════════════ */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50/60 to-green-50/40 border border-slate-200 p-5 lg:p-6 shadow-sm">
            <div className="pointer-events-none absolute -top-12 -right-10 w-48 h-48 rounded-full bg-green-200/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-emerald-200/15 blur-3xl" />

            <div className="relative flex items-start gap-4">
              {shopForm.owner_photo ? (
                <img
                  src={shopForm.owner_photo}
                  alt={user?.name || 'Shopkeeper'}
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg flex-shrink-0 border border-white/60"
                />
              ) : (
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-[22px] shadow-lg flex-shrink-0`}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}

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

              <Field label="Shopkeeper Photo" hint="Dashboard ke Namaste card par yahi photo dikhegi">
                <div className="flex items-center gap-4 flex-wrap">
                  {shopForm.owner_photo ? (
                    <img
                      src={shopForm.owner_photo}
                      alt={user?.name || 'Shopkeeper'}
                      className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-[28px] shadow-sm`}>
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-[13px] font-bold cursor-pointer hover:from-green-700 hover:to-emerald-800 transition-all shadow-md shadow-green-500/20">
                      {photoUploading ? 'Uploading...' : 'Upload Photo'}
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleOwnerPhotoChange} />
                    </label>
                    {shopForm.owner_photo && (
                      <button
                        type="button"
                        onClick={() => patchShop({ owner_photo: '' })}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </Field>

              <Field label="Shop Name" required>
                <input
                  id="name"
                  className={INPUT}
                  placeholder="Ramesh General Store"
                  value={shopForm.name}
                  onChange={(e) => patchShop({ name: e.target.value })}
                  required
                />
              </Field>

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
