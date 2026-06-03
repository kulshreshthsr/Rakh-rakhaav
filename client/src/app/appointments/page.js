'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import EmptyState from '../../components/ui/EmptyState';
import { useIndustry } from '../../contexts/IndustryContext';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function isoDate(date) { return date.toISOString().split('T')[0]; }
function dayLabel(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function shortDay(date) { return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }); }

const STATUS_COLORS = { scheduled: 'purple', in_service: 'pink', completed: 'green', paid: 'slate' };
const STATUS_LABELS = { scheduled: '📅 Scheduled', in_service: '✂️ In Chair', completed: '✅ Done', paid: '💰 Paid' };

export default function AppointmentsPage() {
  const router = useRouter();
  const { businessType, config } = useIndustry();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedStylist, setSelectedStylist] = useState('');
  const [stylists, setStylists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newApptSlot, setNewApptSlot] = useState({ time: '', stylistId: '' });
  const [newForm, setNewForm] = useState({ buyer_name: '', buyer_phone: '', productId: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (businessType && businessType !== 'salon') router.push('/dashboard');
    if (!localStorage.getItem('token')) router.push('/login');
  }, [businessType, router]);

  const fetchStylists = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/stylists'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setStylists(await res.json());
    } catch {}
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json(); setProducts(Array.isArray(d) ? d : d.products || []); }
    } catch {}
  }, []);

  const fetchAppointments = useCallback(async (date) => {
    setLoading(true);
    try {
      const dateStr = isoDate(date);
      let url = `/api/sales/appointments?date=${dateStr}`;
      if (selectedStylist) url += `&stylist_id=${selectedStylist}`;
      const res = await fetch(apiUrl(url), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json(); setAppointments(d.appointments || []); }
    } catch {} finally { setLoading(false); }
  }, [selectedStylist]);

  useEffect(() => { fetchStylists(); fetchProducts(); }, [fetchStylists, fetchProducts]);
  useEffect(() => { fetchAppointments(selectedDate); }, [fetchAppointments, selectedDate]);

  const changeDate = (delta) => setSelectedDate(d => addDays(d, delta));

  // Generate time slots from 09:00 to 20:00 in 30-min increments
  const slots = [];
  for (let h = 9; h < 20; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }

  // Map appointments by time + stylist
  const apptMap = {};
  appointments.forEach(a => {
    const ef = a.extra_fields instanceof Map ? Object.fromEntries(a.extra_fields) : (a.extra_fields || {});
    const time = ef.appointment_time || '';
    const sid  = ef.stylist_id || 'any';
    const key  = `${time}__${sid}`;
    apptMap[key] = a;
  });

  const updateStatus = async (apptId, newStatus) => {
    await fetch(apiUrl(`/api/sales/${apptId}/workflow`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ workflow_status: newStatus }),
    });
    fetchAppointments(selectedDate);
    setSelectedAppt(null);
  };

  const handleBookNew = async () => {
    if (!newForm.buyer_name.trim()) return;
    setSubmitting(true);
    try {
      const prod = products.find(p => p._id === newForm.productId);
      const body = {
        buyer_name: newForm.buyer_name,
        buyer_phone: newForm.buyer_phone,
        items: prod ? [{ product_id: prod._id, quantity: 1, price_per_unit: prod.price }] : [],
        payment_type: 'credit',
        amount_paid: 0,
        extra_fields: {
          appointment_date: isoDate(selectedDate),
          appointment_time: newApptSlot.time,
          stylist_id: newApptSlot.stylistId || '',
          client_notes: newForm.notes,
          workflow_status: 'scheduled',
        },
      };
      const res = await fetch(apiUrl('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { setShowNewModal(false); fetchAppointments(selectedDate); setNewForm({ buyer_name: '', buyer_phone: '', productId: '', notes: '' }); }
    } catch {} finally { setSubmitting(false); }
  };

  if (businessType && businessType !== 'salon') return null;

  const weekDays = [-3, -2, -1, 0, 1, 2, 3].map(d => addDays(selectedDate, d));
  const displayStylists = selectedStylist ? stylists.filter(s => s._id === selectedStylist) : stylists.slice(0, 4);

  return (
    <Layout>
      <div className="desktop-expand max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-28 space-y-4">

        {/* Header */}
        <div className="rr-page-hero rr-fade-in">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <span className="rr-section-label">📅 Calendar</span>
              <h1 className="mt-1 text-[20px] font-black text-slate-900">{dayLabel(selectedDate)}</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => changeDate(-1)} className="w-9 h-9 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:border-purple-300 transition-all">←</button>
              <button onClick={() => setSelectedDate(new Date())} className="px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-[11px] font-black text-slate-600 hover:border-purple-300 transition-all">Today</button>
              <button onClick={() => changeDate(1)} className="w-9 h-9 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:border-purple-300 transition-all">→</button>
            </div>
          </div>

          {/* Week strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {weekDays.map(d => {
              const isToday = isoDate(d) === isoDate(new Date());
              const isSel   = isoDate(d) === isoDate(selectedDate);
              return (
                <button key={isoDate(d)} onClick={() => setSelectedDate(d)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${isSel ? 'border-purple-500 bg-purple-600 text-white' : isToday ? 'border-purple-300 bg-purple-50 text-purple-800' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200'}`}
                >{shortDay(d)}</button>
              );
            })}
          </div>

          {/* Stylist filter */}
          {stylists.length > 0 && (
            <div className="rr-tab-bar mt-3">
              <button onClick={() => setSelectedStylist('')}
                className={`rr-tab ${!selectedStylist ? 'active' : ''}`}
              >All Stylists</button>
              {stylists.map(s => (
                <button key={s._id} onClick={() => setSelectedStylist(s._id === selectedStylist ? '' : s._id)}
                  className={`rr-tab ${selectedStylist === s._id ? 'active' : ''}`}
                >{s.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : stylists.length === 0 ? (
          <EmptyState
            emoji="📅"
            title="कोई appointment नहीं"
            subtitle="Salon, clinic या service के लिए appointments यहाँ book करें।"
            actionLabel="Appointment लें"
            onAction={() => setShowNewModal(true)}
          />
        ) : (
          <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-md">
            {/* Column headers */}
            {displayStylists.length > 0 && (
              <div className={`grid border-b border-slate-100 bg-slate-50`}
                style={{ gridTemplateColumns: `80px repeat(${displayStylists.length}, 1fr)` }}>
                <div className="p-2 text-[10px] font-bold uppercase text-slate-400 border-r border-slate-100">Time</div>
                {displayStylists.map(s => (
                  <div key={s._id} className="p-2 text-center border-r border-slate-100 last:border-r-0">
                    <p className="text-[11px] font-black text-slate-800">{s.name}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Time rows */}
            <div className="max-h-[600px] overflow-y-auto">
              {slots.map(slot => {
                return (
                  <div key={slot}
                    className={`grid border-b border-slate-50 hover:bg-slate-50/60 transition-colors`}
                    style={{ gridTemplateColumns: displayStylists.length > 0 ? `80px repeat(${displayStylists.length}, 1fr)` : '80px 1fr' }}
                  >
                    <div className="px-2 py-2.5 border-r border-slate-100 flex items-center">
                      <span className="text-[11px] font-bold text-slate-400">{slot}</span>
                    </div>
                    {(displayStylists.length > 0 ? displayStylists : [{ _id: 'any' }]).map(s => {
                      const appt = apptMap[`${slot}__${s._id}`] || apptMap[`${slot}__any`];
                      const ef = appt ? (appt.extra_fields instanceof Map ? Object.fromEntries(appt.extra_fields) : (appt.extra_fields || {})) : null;
                      const wfStatus = ef?.workflow_status || 'scheduled';
                      if (appt) {
                        return (
                          <button key={s._id}
                            onClick={() => setSelectedAppt(appt)}
                            className="px-2 py-1.5 border-r border-slate-100 last:border-r-0 text-left hover:brightness-95 transition-all"
                            style={{ backgroundColor: `${s.color || '#6366f1'}20`, borderLeft: `3px solid ${s.color || '#6366f1'}` }}
                          >
                            <p className="text-[11px] font-black text-slate-900 truncate">{appt.buyer_name}</p>
                            <p className="text-[9px] text-slate-600 truncate">{appt.items?.[0]?.product_name || 'Appointment'}</p>
                          </button>
                        );
                      }
                      return (
                        <button key={s._id}
                          onClick={() => { setNewApptSlot({ time: slot, stylistId: s._id === 'any' ? '' : s._id }); setNewForm({ buyer_name: '', buyer_phone: '', productId: '', notes: '' }); setShowNewModal(true); }}
                          className="px-2 py-1.5 border-r border-slate-100 last:border-r-0 text-slate-200 hover:bg-purple-50/60 hover:text-purple-400 text-[10px] transition-all"
                        >+</button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Appointment Detail Panel */}
      {selectedAppt && (() => {
        const ef = selectedAppt.extra_fields instanceof Map ? Object.fromEntries(selectedAppt.extra_fields) : (selectedAppt.extra_fields || {});
        const stylist = stylists.find(s => s._id === ef.stylist_id);
        const wfStatus = ef.workflow_status || 'scheduled';
        return (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-black text-slate-900">{selectedAppt.buyer_name}</h3>
                <button onClick={() => setSelectedAppt(null)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
              </div>
              <div className="space-y-1.5 text-[13px]">
                {selectedAppt.buyer_phone && <p>📞 {selectedAppt.buyer_phone}</p>}
                {selectedAppt.items?.length > 0 && <p>💆 {selectedAppt.items.map(i => i.product_name).join(', ')}</p>}
                {ef.appointment_time && <p>🕐 {ef.appointment_time}{ef.appointment_duration ? ` (${ef.appointment_duration} min)` : ''}</p>}
                {stylist && <p>✂️ {stylist.name}</p>}
                {ef.advance_paid && Number(ef.advance_paid) > 0 && <p>💰 Advance: ₹{fmt(ef.advance_paid)}</p>}
                {ef.client_notes && <p className="text-amber-700 bg-amber-50 rounded-lg px-2 py-1">📝 {ef.client_notes}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {['scheduled', 'in_service', 'completed', 'paid'].map(st => (
                    <button key={st} onClick={() => updateStatus(selectedAppt._id, st)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all ${wfStatus === st ? 'border-purple-500 bg-purple-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300'}`}
                    >{STATUS_LABELS[st]}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/sales`} className="flex-1 py-2 text-center rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50">Edit</Link>
                <button onClick={() => { setSelectedAppt(null); }} className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-[12px] font-bold hover:bg-purple-700">Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* New Appointment Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-black text-slate-900">New Appointment</h3>
              <button onClick={() => setShowNewModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
            </div>
            <p className="text-[12px] text-slate-500">{dayLabel(selectedDate)} @ {newApptSlot.time}</p>

            <div className="space-y-3">
              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Client Name *</p>
                <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={newForm.buyer_name} onChange={e => setNewForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="Client name" /></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Phone</p>
                <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={newForm.buyer_phone} onChange={e => setNewForm(p => ({ ...p, buyer_phone: e.target.value }))} placeholder="Phone number" /></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Service</p>
                <select className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={newForm.productId} onChange={e => setNewForm(p => ({ ...p, productId: e.target.value }))}>
                  <option value="">— Select service —</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} — ₹{p.price}</option>)}
                </select></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Notes</p>
                <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 text-[14px] bg-white focus:outline-none focus:border-purple-500" value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} placeholder="Client preferences..." /></div>
            </div>

            <button onClick={handleBookNew} disabled={submitting || !newForm.buyer_name.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-700 text-white font-black text-[14px] shadow-lg shadow-purple-500/30 disabled:opacity-60 hover:-translate-y-0.5 transition-all"
            >{submitting ? 'Booking...' : 'Book Appointment'}</button>
          </div>
        </div>
      )}
    </Layout>
  );
}
