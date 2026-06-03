'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../../lib/pageCache';
import { apiUrl } from '../../../lib/api';
import EmptyState from '../../../components/ui/EmptyState';
import { useCustomerTerms } from '../../../hooks/useEntityTerms';

const SALES_CACHE_KEY = 'sales-page';
const getToken = () => localStorage.getItem('token');
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const getInitialSalesCache = () => (typeof window === 'undefined' ? null : readPageCache(SALES_CACHE_KEY));

export default function CustomersDirectoryPage() {
  const router = useRouter();
  const { labelPlural, pageTitle, refreshing: refreshingLabel, backToSales, searchPlaceholder, emptyState } = useCustomerTerms();
  const initialCache = getInitialSalesCache();
  const [sales, setSales] = useState(() => initialCache?.sales || []);
  const [loading, setLoading] = useState(() => !Boolean(initialCache?.sales));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const hasBootstrappedRef = useRef(false);

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/sales'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextSales = data.sales || (Array.isArray(data) ? data : []);
      setSales(nextSales);
      writePageCache(SALES_CACHE_KEY, { sales: nextSales, summary: data.summary || {} });
      setError('');
    } catch {
      setError('Customer list could not be loaded');
    }
  }, [router]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(initialCache?.sales));
      await fetchSales();
      setLoading(false);
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, [fetchSales, initialCache?.sales, router]);

  const customers = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const name = String(sale.buyer_name || '').trim();
      const phone = cleanPhone(sale.buyer_phone || '');
      if (!name || name.toLowerCase() === 'walk-in customer') return;
      if (!phone) return;
      const key = `${name.toLowerCase()}|${phone}`;
      if (!map.has(key)) {
        map.set(key, { key, name, phone });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  const normalizedSearch = customerSearch.trim().toLowerCase();
  const filteredCustomers = customers.filter((customer) => {
    if (!normalizedSearch) return true;
    return customer.name.toLowerCase().includes(normalizedSearch)
      || customer.phone.includes(cleanPhone(normalizedSearch));
  });

  return (
    <Layout>
      <div className="page-shell sales-shell customer-page">
        <section className="hero-panel sales-hero customer-hero">
          <div className="page-toolbar">
            <div className="min-w-0">
              <p className="rr-page-eyebrow">{labelPlural}</p>
              <div className="page-title">{pageTitle}</div>
              {refreshing ? <p className="rr-meta-line">{refreshingLabel}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/sales" className="btn-ghost w-auto shrink-0">{backToSales}</Link>
            </div>
          </div>
        </section>

        <div className="toolbar-card customer-toolbar-card">
          <div className="toolbar">
            <input
              className="form-input min-w-[220px] flex-1"
              placeholder={searchPlaceholder}
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="alert-error">{error}</div>
        ) : null}

        {loading ? (
          <div className="card grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-[72px]" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            emoji="👥"
            title="कोई customer नहीं मिला"
            subtitle="जब आप credit sale करेंगे या customer add करेंगे, वे यहाँ दिखेंगे।"
            actionLabel="पहली Sale बनाएं"
            onAction={() => router.push('/sales')}
          />
        ) : (
          <div className="card customer-list-card overflow-hidden p-0">
            {filteredCustomers.map((customer) => (
              <div key={customer.key} className="rr-list-row">
                <div className="rr-avatar rr-avatar-sm bg-gradient-to-br from-green-600 to-emerald-700">
                  {customer.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900">{customer.name}</div>
                  <div className="text-[12px] text-slate-500">+91 {customer.phone}</div>
                </div>
                {customer.udhaarBalance > 0 && (
                  <span className="rr-pill rr-pill-rose flex-shrink-0">₹{customer.udhaarBalance}</span>
                )}
                <div className="flex gap-2 flex-shrink-0">
                  <a href={`tel:+91${customer.phone}`} className="btn-ghost">Call Now</a>
                  <a href={`https://wa.me/91${customer.phone}`} className="btn-ghost" target="_blank" rel="noreferrer">WhatsApp</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
