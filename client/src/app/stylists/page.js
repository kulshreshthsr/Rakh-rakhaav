'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { useIndustry } from '../../contexts/IndustryContext';

const getToken = () => localStorage.getItem('token');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SPECIALITIES = ['Hair', 'Skin', 'Nails', 'Bridal', 'Makeup', 'Other'];
const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

const emptyForm = () => ({
  name: '', phone: '', speciality: [], for_gender: 'All',
  working_days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  start_time: '09:00', end_time: '20:00', slot_duration: 30, color: '#6366f1',
});

function getInitials(name) {
  return name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
}

export default function StylistsPage() {
  const router = useRouter();
  const { businessType } = useIndustry();
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (businessType && businessType !== 'salon') router.push('/dashboard');
    if (!localStorage.getItem('token')) router.push('/login');
  }, [businessType, router]);

  const fetchStylists = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/stylists'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setStylists(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStylists(); }, [fetchStylists]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setError(''); setShowModal(true); };
  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({ name: s.name, phone: s.phone || '', speciality: s.speciality || [], for_gender: s.for_gender || 'All', working_days: s.working_days || [], start_time: s.start_time || '09:00', end_time: s.end_time || '20:00', slot_duration: s.slot_duration || 30, color: s.color || '#6366f1' });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    try {
      const url  = editingId ? apiUrl(`/api/stylists/${editingId}`) : apiUrl('/api/stylists');
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(form) });
      if (res.ok) { setShowModal(false); fetchStylists(); }
      else { const d = await res.json(); setError(d.message || 'Failed'); }
    } catch { setError('Server error'); }
    setSubmitting(false);
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this stylist?')) return;
    await fetch(apiUrl(`/api/stylists/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
    fetchStylists();
  };

  const toggleSpec = (s) => setForm(prev => ({ ...prev, speciality: prev.speciality.includes(s) ? prev.speciality.filter(x => x !== s) : [...prev.speciality, s] }));
  const toggleDay  = (d) => setForm(prev => ({ ...prev, working_days: prev.working_days.includes(d) ? prev.working_days.filter(x => x !== d) : [...prev.working_days, d] }));

  if (businessType && businessType !== 'salon') return null;

  return (
    <Layout>
      <div className="desktop-expand max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-5">

        {/* Header */}
        <div className="rr-page-hero rr-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="rr-section-label">✂️ Stylists</span>
              <h1 className="mt-1 text-[22px] font-black text-slate-900">Staff Management</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">{stylists.length} stylists registered</p>
            </div>
            <button onClick={openAdd} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-700 text-white text-[13px] font-black shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 transition-all">
              + Add Stylist
            </button>
          </div>
        </div>

        {/* Stylists grid */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
        ) : stylists.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-5xl mb-3">✂️</p>
            <p className="font-black text-[15px] text-slate-700">No stylists yet</p>
            <button onClick={openAdd} className="mt-4 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-[13px] font-black hover:bg-purple-700">Add First Stylist</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stylists.map(s => (
              <div key={s._id} className="rr-accent-card accent-violet space-y-3 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="rr-avatar rr-avatar-lg flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${s.color || '#6366f1'}, ${s.color || '#4f46e5'})` }}>
                    {getInitials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-slate-900">{s.name}</p>
                    {s.phone && <p className="text-[11px] text-slate-500">📞 {s.phone}</p>}
                  </div>
                  {s.todayCount > 0 && (
                    <span className="flex-shrink-0 bg-purple-100 text-purple-800 text-[11px] font-black px-2.5 py-1 rounded-full">{s.todayCount} today</span>
                  )}
                </div>

                {s.speciality?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.speciality.map(sp => (
                      <span key={sp} className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[10px] font-semibold text-purple-700">{sp}</span>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  {s.working_days?.slice(0, 3).map(d => d.slice(0, 3)).join(', ')}{s.working_days?.length > 3 ? ' +more' : ''}
                  {' · '}{s.start_time}–{s.end_time}
                </p>

                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="flex-1 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-purple-300 hover:bg-purple-50 transition-colors">Edit</button>
                  <button onClick={() => deactivate(s._id)} className="flex-1 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors">Deactivate</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-[18px] font-black text-slate-900">{editingId ? 'Edit Stylist' : 'Add Stylist'}</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <p className="text-[12px] text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">⚠️ {error}</p>}

              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Name *</p>
                <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Stylist name" /></div>

              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Phone</p>
                <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" /></div>

              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Speciality</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALITIES.map(s => (
                    <button key={s} type="button" onClick={() => toggleSpec(s)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${form.speciality.includes(s) ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 text-slate-600 bg-white hover:border-purple-300'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">For Gender</p>
                <select className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={form.for_gender} onChange={e => setForm(p => ({ ...p, for_gender: e.target.value }))}>
                  {['All', 'Female', 'Male'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Working Days</p>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${form.working_days.includes(d) ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 text-slate-600 bg-white hover:border-purple-300'}`}
                    >{d.slice(0, 3)}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Start</p>
                  <input type="time" className="h-11 w-full px-3 rounded-xl border-2 border-slate-200 text-[13px] bg-white focus:outline-none focus:border-purple-500" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></div>
                <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">End</p>
                  <input type="time" className="h-11 w-full px-3 rounded-xl border-2 border-slate-200 text-[13px] bg-white focus:outline-none focus:border-purple-500" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} /></div>
                <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Slot (min)</p>
                  <select className="h-11 w-full px-2 rounded-xl border-2 border-slate-200 text-[13px] bg-white focus:outline-none focus:border-purple-500" value={form.slot_duration} onChange={e => setForm(p => ({ ...p, slot_duration: Number(e.target.value) }))}>
                    {[15, 30, 45, 60].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Color</p>
                <div className="flex gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-700 text-white font-black text-[14px] shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 disabled:opacity-60 transition-all"
              >{submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Stylist'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
