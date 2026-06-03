'use client';
import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import EmptyState from '../../components/ui/EmptyState';
import { useIndustry } from '../../contexts/IndustryContext';

const getToken = () => localStorage.getItem('token');
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN');

const SPECIES_EMOJI = { Dog: '🐕', Cat: '🐈', Bird: '🐦', Fish: '🐠', Rabbit: '🐰', Hamster: '🐹', Reptile: '🦎', Other: '🐾' };
const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Hamster', 'Reptile', 'Other'];
const GENDER_OPTIONS  = ['Male', 'Female', 'Unknown'];

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
  if (years >= 1) return `${years}y ${months % 12}m`;
  return `${months} months`;
}

function nextVaccDue(vaccinations) {
  if (!vaccinations?.length) return null;
  const withDue = vaccinations.filter(v => v.nextDueDate).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
  return withDue[0] || null;
}

function VaccStatus({ vacc }) {
  if (!vacc?.nextDueDate) return null;
  const now = new Date();
  const due = new Date(vacc.nextDueDate);
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)  return <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">OVERDUE</span>;
  if (diffDays <= 30) return <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Due soon: {due.toLocaleDateString('en-IN')}</span>;
  return <span className="text-[10px] font-bold text-green-700">{due.toLocaleDateString('en-IN')}</span>;
}

const BLANK_PET = { ownerName: '', ownerPhone: '', ownerAddress: '', petName: '', species: 'Dog', breed: '', gender: 'Unknown', dateOfBirth: '', color: '', weight: '', microchipNo: '', medicalNotes: '', vetName: '', vetPhone: '', groomingFrequency: '' };
const BLANK_VACC = { vaccineName: '', givenDate: '', nextDueDate: '', vetName: '', notes: '' };

export default function PetsPage() {
  const { businessType } = useIndustry();
  const [pets, setPets]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState(BLANK_PET);
  const [saving, setSaving]         = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [showVaccModal, setShowVaccModal] = useState(false);
  const [vaccForm, setVaccForm]     = useState(BLANK_VACC);
  const [vaccSaving, setVaccSaving] = useState(false);

  const fetchPets = useCallback(async () => {
    setLoading(true);
    try {
      const url = search ? apiUrl(`/api/pets?search=${encodeURIComponent(search)}`) : apiUrl('/api/pets');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setPets(Array.isArray(data) ? data : []);
    } catch { setError('Failed to load pet profiles'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchPets(); }, [fetchPets]);

  const openAdd = () => { setForm(BLANK_PET); setEditingId(null); setShowModal(true); };
  const openEdit = (pet) => {
    setForm({
      ownerName: pet.ownerName || '', ownerPhone: pet.ownerPhone || '', ownerAddress: pet.ownerAddress || '',
      petName: pet.petName || '', species: pet.species || 'Dog', breed: pet.breed || '',
      gender: pet.gender || 'Unknown', dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.slice(0, 10) : '',
      color: pet.color || '', weight: pet.weight || '', microchipNo: pet.microchipNo || '',
      medicalNotes: pet.medicalNotes || '', vetName: pet.vetName || '', vetPhone: pet.vetPhone || '',
      groomingFrequency: pet.groomingFrequency || '',
    });
    setEditingId(pet._id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.ownerName || !form.ownerPhone || !form.petName || !form.species) {
      setError('Owner name, phone, pet name and species are required'); return;
    }
    setSaving(true); setError('');
    try {
      const url    = editingId ? apiUrl(`/api/pets/${editingId}`) : apiUrl('/api/pets');
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, weight: form.weight ? Number(form.weight) : undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || 'Save failed'); return; }
      setShowModal(false); fetchPets();
    } catch { setError('Save failed'); }
    finally { setSaving(false); }
  };

  const openVacc = (pet) => { setSelectedPet(pet); setVaccForm(BLANK_VACC); setShowVaccModal(true); };

  const handleVacc = async () => {
    if (!vaccForm.vaccineName) { setError('Vaccine name required'); return; }
    setVaccSaving(true); setError('');
    try {
      const res = await fetch(apiUrl(`/api/pets/${selectedPet._id}/vaccinate`), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(vaccForm),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || 'Failed'); return; }
      setShowVaccModal(false); fetchPets();
    } catch { setError('Failed to add vaccination'); }
    finally { setVaccSaving(false); }
  };

  const sendWhatsApp = (pet) => {
    const dueVacc = nextVaccDue(pet.vaccinations);
    const msg = dueVacc?.nextDueDate
      ? `Namaste ${pet.ownerName} ji! 🐾\n\n${pet.petName} (${pet.species}) ka vaccination due hai:\n${dueVacc.vaccineName} — Due: ${new Date(dueVacc.nextDueDate).toLocaleDateString('en-IN')}\n\nKripya schedule karein.\n\nDhanyawad! 🙏`
      : `Namaste ${pet.ownerName} ji! 🐾\n\n${pet.petName} (${pet.species}) ke baare mein koi update hai.\n\nKripya humse contact karein.\n\nDhanyawad! 🙏`;
    const phone = pet.ownerPhone?.replace(/\D/g, '').slice(-10);
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (businessType && businessType !== 'pet_shop') {
    return (
      <Layout><div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-slate-500">Pet Profiles is only available for Pet Shop accounts.</p>
      </div></Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Pet Profiles</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Customer pet health records</p>
          </div>
          <button onClick={openAdd}
            className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-[13px] font-black hover:bg-teal-700 transition-colors shadow-md">
            + Add Pet
          </button>
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by owner name, phone, or pet name..."
          className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-[14px] font-medium bg-white focus:outline-none focus:border-teal-400 transition-colors"
        />

        {error && <p className="text-[13px] font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-200">{error}</p>}

        {/* Pet cards */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-bold">Loading...</div>
        ) : pets.length === 0 ? (
          <EmptyState
            emoji="🐾"
            title="कोई pet profile नहीं"
            subtitle="Pet shop के customers के pets की जानकारी यहाँ रखें।"
            actionLabel="Pet जोड़ें"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="space-y-3">
            {pets.map(pet => {
              const dueVacc = nextVaccDue(pet.vaccinations);
              const age = calcAge(pet.dateOfBirth);
              return (
                <div key={pet._id} className="rr-accent-card accent-violet overflow-hidden">
                  <div>
                    {/* Pet header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl flex-shrink-0">{SPECIES_EMOJI[pet.species] || '🐾'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-black text-slate-900 leading-tight">{pet.petName}</p>
                        <p className="rr-section-label mt-0.5">{pet.breed || pet.species} {pet.gender && pet.gender !== 'Unknown' ? `· ${pet.gender}` : ''}</p>
                      </div>
                    </div>

                    {/* Owner info */}
                    <p className="text-[13px] font-black text-slate-900 mb-0.5">{pet.ownerName}</p>
                    <p className="text-[12px] text-slate-500 mb-1">{pet.ownerPhone}</p>
                    {(age || pet.weight) && (
                      <p className="text-[12px] text-slate-500 font-medium mb-2">
                        {age && `Age: ${age}`}{age && pet.weight ? '  •  ' : ''}{pet.weight ? `Weight: ${pet.weight}kg` : ''}
                      </p>
                    )}

                    {/* Vaccination status */}
                    {pet.vaccinations?.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] text-slate-500 font-bold">Next vaccine:</span>
                        {dueVacc ? <VaccStatus vacc={dueVacc} /> : <span className="text-[11px] text-slate-400">—</span>}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => openEdit(pet)}
                        className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:border-teal-300 hover:bg-teal-50 transition-all">
                        ✏️ Edit
                      </button>
                      <button onClick={() => openVacc(pet)}
                        className="px-3 py-1.5 rounded-lg border-2 border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all">
                        💉 Add Vaccination
                      </button>
                      <button onClick={() => sendWhatsApp(pet)}
                        className="px-3 py-1.5 rounded-lg border-2 border-green-200 bg-green-50 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-all">
                        📱 WhatsApp Owner
                      </button>
                    </div>
                  </div>

                  {/* Vaccination history */}
                  {pet.vaccinations?.length > 0 && (
                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Vaccination History</p>
                      <div className="space-y-1">
                        {pet.vaccinations.slice(-3).reverse().map((v, i) => {
                          const isDue = v.nextDueDate && new Date(v.nextDueDate) < new Date();
                          return (
                            <div key={i} className={`flex items-center justify-between text-[11px] py-1 px-2 rounded-lg ${isDue ? 'bg-red-50 text-red-700' : 'text-slate-600'}`}>
                              <span className="font-bold">{v.vaccineName}</span>
                              <span className="text-slate-400">{v.givenDate ? new Date(v.givenDate).toLocaleDateString('en-IN') : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Pet Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between z-10">
              <h2 className="text-[17px] font-black text-slate-900">{editingId ? 'Edit Pet Profile' : 'Add Pet Profile'}</h2>
              <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors text-lg font-black">×</button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {error && <p className="text-[12px] text-red-600 font-bold bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Owner Details</p>
              {[['ownerName','Owner Name *','text'],['ownerPhone','Owner Phone *','tel'],['ownerAddress','Address','text']].map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(p => ({...p, [key]: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400" />
                </div>
              ))}

              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider pt-2">Pet Details</p>
              {[['petName','Pet Name *','text'],['breed','Breed','text'],['color','Color','text']].map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(p => ({...p, [key]: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400" />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">Species *</label>
                  <select value={form.species} onChange={e => setForm(p => ({...p, species: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400 bg-white">
                    {SPECIES_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">Gender</label>
                  <select value={form.gender} onChange={e => setForm(p => ({...p, gender: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400 bg-white">
                    {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({...p, dateOfBirth: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">Weight (kg)</label>
                  <input type="number" step="0.1" value={form.weight} onChange={e => setForm(p => ({...p, weight: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1">Microchip No.</label>
                <input type="text" value={form.microchipNo} onChange={e => setForm(p => ({...p, microchipNo: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400" />
              </div>

              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider pt-2">Medical / Vet</p>
              {[['vetName','Vet Name','text'],['vetPhone','Vet Phone','tel'],['groomingFrequency','Grooming Frequency','text']].map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(p => ({...p, [key]: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400" />
                </div>
              ))}

              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1">Medical Notes</label>
                <textarea value={form.medicalNotes} onChange={e => setForm(p => ({...p, medicalNotes: e.target.value}))} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-teal-400 resize-none" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4">
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-teal-600 text-white font-black text-[15px] hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-lg">
                {saving ? 'Saving...' : editingId ? 'Update Profile' : 'Add Pet Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vaccination Modal */}
      {showVaccModal && selectedPet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowVaccModal(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-black text-slate-900">Add Vaccination</h2>
                <p className="text-[12px] text-slate-500">{selectedPet.petName} ({selectedPet.species})</p>
              </div>
              <button onClick={() => setShowVaccModal(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-lg font-black">×</button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {error && <p className="text-[12px] text-red-600 font-bold">{error}</p>}
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1">Vaccine Name *</label>
                <input type="text" value={vaccForm.vaccineName} onChange={e => setVaccForm(p => ({...p, vaccineName: e.target.value}))}
                  placeholder="e.g. Rabies, DHPPi, Bordetella"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">Given Date</label>
                  <input type="date" value={vaccForm.givenDate} onChange={e => setVaccForm(p => ({...p, givenDate: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1">Next Due Date</label>
                  <input type="date" value={vaccForm.nextDueDate} onChange={e => setVaccForm(p => ({...p, nextDueDate: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1">Vet Name</label>
                <input type="text" value={vaccForm.vetName} onChange={e => setVaccForm(p => ({...p, vetName: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1">Notes</label>
                <input type="text" value={vaccForm.notes} onChange={e => setVaccForm(p => ({...p, notes: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-[14px] font-medium focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={handleVacc} disabled={vaccSaving}
                className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-black text-[15px] hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {vaccSaving ? 'Saving...' : '💉 Add Vaccination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
