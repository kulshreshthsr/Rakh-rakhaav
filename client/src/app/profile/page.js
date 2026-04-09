'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh'];
const GSTIN_LENGTH = 15;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const emptyShopForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  phone: '',
  email: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  bank_branch: '',
  terms: '',
};

const normalizeGstin = (value = '') => value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, GSTIN_LENGTH);
const getStateFromGstin = (gstin = '') => {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== GSTIN_LENGTH || !GSTIN_REGEX.test(normalized)) return null;
  return GST_STATE_CODE_MAP[normalized.slice(0, 2)] || null;
};

const PencilIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" />
  </svg>
);

export default function ProfilePage() {
  const [user] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [shop, setShop] = useState(null);
  const [shopForm, setShopForm] = useState(emptyShopForm);
  const [shopMsg, setShopMsg] = useState('');
  const [shopError, setShopError] = useState('');
  const [savingShop, setSavingShop] = useState(false);
  const router = useRouter();

  const getToken = () => localStorage.getItem('token');

  const loadShopIntoForm = (data) => {
    setShopForm({
      name: data?.name || '',
      address: data?.address || '',
      city: data?.city || '',
      state: data?.state || '',
      pincode: data?.pincode || '',
      gstin: data?.gstin || '',
      phone: data?.phone || '',
      email: data?.email || '',
      bank_name: data?.bank_name || '',
      bank_account: data?.bank_account || '',
      bank_ifsc: data?.bank_ifsc || '',
      bank_branch: data?.bank_branch || '',
      terms: data?.terms || '',
    });
  };

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/shop'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setShop(data);
      loadShopIntoForm(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const timeoutId = setTimeout(() => {
      fetchShop();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchShop, router, user]);

  const gstinDetectedState = getStateFromGstin(shopForm.gstin);
  const gstinInvalid = shopForm.gstin.length > 0 && shopForm.gstin.length === GSTIN_LENGTH && !gstinDetectedState;

  const quickInfoCards = useMemo(() => ([
    { label: 'GSTIN', value: shopForm.gstin || 'Not added', field: 'gstin' },
    { label: 'Phone', value: shopForm.phone || 'Add phone', field: 'phone' },
    { label: 'State', value: shopForm.state || 'Not set', field: 'state' },
  ]), [shopForm.gstin, shopForm.phone, shopForm.state]);

  const handleGstinChange = (value) => {
    const normalized = normalizeGstin(value);
    const detectedState = getStateFromGstin(normalized);

    setShopForm((current) => ({
      ...current,
      gstin: normalized,
      ...(detectedState ? { state: detectedState } : {}),
    }));
  };

  const focusField = (fieldId) => {
    document.getElementById(fieldId)?.focus();
  };

  const updateShop = async (e) => {
    e.preventDefault();
    setShopMsg('');
    setShopError('');

    if (gstinInvalid) {
      setShopError('Please enter a valid GSTIN before saving.');
      return;
    }

    setSavingShop(true);
    try {
      const res = await fetch(apiUrl('/api/auth/shop'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(shopForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShop(data);
        loadShopIntoForm(data);
        setShopMsg('Shop details updated successfully.');
      } else {
        setShopError(data.message || 'Failed to update shop details.');
      }
    } catch {
      setShopError('Server error');
    } finally {
      setSavingShop(false);
    }
  };

  const resetShopForm = () => {
    loadShopIntoForm(shop || emptyShopForm);
    setShopMsg('');
    setShopError('');
  };

  return (
    <Layout>
      <div className="page-shell profile-shell profile-settings-shell">
        <section className="profile-settings-header">
          <div className="profile-settings-header-line" />
          <div className="profile-settings-tag">Shop profile</div>
          <div className="profile-settings-title">Profile / Shop Settings</div>
          <div className="profile-settings-subtitle">Shop identity, invoice details और account setup को एक जगह से manage करें.</div>
        </section>

        <section className="profile-user-card profile-settings-stagger">
          <div className="profile-user-avatar">{user?.name?.charAt(0).toUpperCase() || 'M'}</div>
          <div className="profile-user-copy">
            <div className="profile-user-name">{user?.name || 'Profile & Settings'}</div>
            <div className="profile-user-note">Shop identity, invoice details aur account security yahan se control hoti hai.</div>
          </div>
        </section>

        <section className="profile-quick-grid profile-settings-stagger" aria-label="Quick profile info">
          {quickInfoCards.map((item) => (
            <button
              key={item.label}
              type="button"
              className="profile-quick-card"
              onClick={() => focusField(item.field)}
            >
              <div className="profile-quick-top">
                <span className="profile-quick-label">{item.label}</span>
                <span className="profile-quick-icon"><PencilIcon /></span>
              </div>
              <div className="profile-quick-value">{item.value}</div>
            </button>
          ))}
        </section>

        <form onSubmit={updateShop} className="profile-settings-form">
          <section className="profile-settings-section profile-settings-stagger">
            <div className="profile-section-title">Shop Details</div>
            <div className="profile-section-subtitle">GST, billing identity aur printed invoice information</div>

            {shopMsg && <div className="alert-success">{shopMsg}</div>}
            {shopError && <div className="alert-error">{shopError}</div>}

            <div className="form-group">
              <label className="form-label">Shop Name *</label>
              <input id="name" className="form-input profile-settings-input" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required />
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input
                id="gstin"
                className={`form-input profile-settings-input${gstinInvalid ? ' is-error' : ''}`}
                placeholder="22AAAAA0000A1Z5"
                value={shopForm.gstin}
                maxLength={GSTIN_LENGTH}
                onChange={(e) => handleGstinChange(e.target.value)}
              />
              {gstinDetectedState && shopForm.state ? <div className="profile-field-success">State auto-detected from GSTIN</div> : null}
              {gstinInvalid ? <div className="profile-field-error">Invalid GSTIN format</div> : null}
            </div>

            <div className="form-group">
              <label className="form-label">Phone</label>
              <input id="phone" className="form-input profile-settings-input" placeholder="9876543210" value={shopForm.phone} onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="email" className="form-input profile-settings-input" placeholder="shop@email.com" value={shopForm.email} onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-input profile-settings-input profile-settings-textarea profile-settings-address" placeholder="Street, area, city and pincode" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">State</label>
              <select id="state" className="form-input profile-settings-input" value={shopForm.state} onChange={(e) => setShopForm({ ...shopForm, state: e.target.value })}>
                <option value="">Select State</option>
                {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>
          </section>

          <section className="profile-settings-section profile-settings-stagger">
            <div className="profile-section-title">Bank Details</div>
            <div className="profile-section-subtitle">Available hone par invoice par dikh jayega</div>
            <div className="profile-section-note">Optional - professional invoice ke liye bank details add karein</div>

            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input className="form-input profile-settings-input" placeholder="State Bank of India" value={shopForm.bank_name} onChange={(e) => setShopForm({ ...shopForm, bank_name: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Branch</label>
              <input className="form-input profile-settings-input" placeholder="Main Branch" value={shopForm.bank_branch} onChange={(e) => setShopForm({ ...shopForm, bank_branch: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Account No.</label>
              <input className="form-input profile-settings-input" placeholder="0000000000" value={shopForm.bank_account} onChange={(e) => setShopForm({ ...shopForm, bank_account: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input className="form-input profile-settings-input" placeholder="SBIN0000000" value={shopForm.bank_ifsc} onChange={(e) => setShopForm({ ...shopForm, bank_ifsc: e.target.value })} />
            </div>
          </section>

          <section className="profile-settings-section profile-settings-stagger">
            <div className="profile-section-title">Terms &amp; Conditions</div>
            <div className="profile-section-subtitle">Invoice par print hoga for clearer business communication</div>

            <div className="form-group">
              <label className="form-label">Terms</label>
              <textarea
                className="form-input profile-settings-input profile-settings-textarea profile-settings-terms"
                placeholder="Goods once sold will not be taken back..."
                value={shopForm.terms}
                onChange={(e) => setShopForm({ ...shopForm, terms: e.target.value })}
              />
            </div>
          </section>

          <div className="profile-settings-actions profile-settings-stagger">
            <button type="submit" className="profile-settings-save" disabled={savingShop}>
              {savingShop ? 'Saving changes...' : 'Save changes'}
            </button>
            <button type="button" className="profile-settings-cancel" onClick={resetShopForm} disabled={savingShop}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
