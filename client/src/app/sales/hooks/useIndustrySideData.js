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
    loadContractors,
  };
}
