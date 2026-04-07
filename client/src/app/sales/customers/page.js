'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../../lib/pageCache';
import { apiUrl } from '../../../lib/api';

const SALES_CACHE_KEY = 'sales-page';
const getToken = () => localStorage.getItem('token');
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');

export default function CustomersDirectoryPage() {
  const router = useRouter();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
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

    const cached = readPageCache(SALES_CACHE_KEY);
    if (cached?.sales) {
      setSales(cached.sales);
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.sales));
      await fetchSales();
      setLoading(false);
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, [fetchSales, router]);

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
        <section className="hero-panel sales-hero">
          <div className="page-toolbar">
            <div className="min-w-0">
              <p className="rr-page-eyebrow">Customers</p>
              <div className="page-title">Customer Directory</div>
              {refreshing ? <p className="rr-meta-line">Refreshing customers…</p> : null}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link href="/sales" className="btn-ghost w-auto shrink-0">Back to Sales</Link>
            </div>
          </div>
        </section>

        <div className="toolbar-card">
          <div className="toolbar">
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Search customer name or phone..."
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="alert-error">{error}</div>
        ) : null}

        {loading ? (
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton" style={{ height: 72 }} />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">CU</div>
            <div>No customers found.</div>
          </div>
        ) : (
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            {filteredCustomers.map((customer) => (
              <div key={customer.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{customer.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>+91 {customer.phone}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
