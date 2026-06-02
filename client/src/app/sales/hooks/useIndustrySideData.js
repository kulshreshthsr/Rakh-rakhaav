'use client';
import { useCallback, useState } from 'react';
import { apiUrl } from '../../../lib/api';

const getToken = () => localStorage.getItem('token');

export default function useIndustrySideData({ businessType }) {
  // Contractor state (hardware)
  const [contractors, setContractors] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [contractorSearch, setContractorSearch] = useState('');
  const [showContractorDrop, setShowContractorDrop] = useState(false);
  const [contractorsLoaded, setContractorsLoaded] = useState(false);

  // Pet profiles (pet shop)
  const [petProfiles, setPetProfiles] = useState([]);

  // Salon state
  const [stylists, setStylists] = useState([]);
  const [clientHistory, setClientHistory] = useState(null);
  const [clientMemberships, setClientMemberships] = useState([]);
  const [redemptionMembershipId, setRedemptionMembershipId] = useState(null);

  const fetchStylists = useCallback(async () => {
    if (businessType !== 'salon') return;
    try {
      const res = await fetch(apiUrl('/api/stylists'), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const data = await res.json(); setStylists(Array.isArray(data) ? data : []); }
    } catch {}
  }, [businessType]);

  const fetchClientHistory = useCallback(async (phone) => {
    if (businessType !== 'salon' || !phone || phone.replace(/\D/g, '').length < 10) return;
    try {
      const [histRes, memRes] = await Promise.all([
        fetch(apiUrl(`/api/sales/client-history?phone=${phone}`), { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(apiUrl(`/api/memberships/client?phone=${phone}`), { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (histRes.ok) { const d = await histRes.json(); setClientHistory(d.summary?.visitCount > 0 ? d : null); }
      if (memRes.ok) { const d = await memRes.json(); setClientMemberships(Array.isArray(d) ? d.filter((m) => m.isActive) : []); }
    } catch {}
  }, [businessType]);

  const loadContractors = useCallback(async () => {
    if (businessType !== 'hardware' || contractorsLoaded) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/contractors'), { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      setContractors(data);
      setContractorsLoaded(true);
    } catch {}
  }, [businessType, contractorsLoaded]);

  return {
    contractors, setContractors,
    selectedContractor, setSelectedContractor,
    contractorSearch, setContractorSearch,
    showContractorDrop, setShowContractorDrop,
    contractorsLoaded,
    petProfiles, setPetProfiles,
    stylists,
    clientHistory, setClientHistory,
    clientMemberships, setClientMemberships,
    redemptionMembershipId, setRedemptionMembershipId,
    fetchStylists,
    fetchClientHistory,
    loadContractors,
  };
}
