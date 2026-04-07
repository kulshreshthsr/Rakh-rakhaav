'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { cancelDeferred, readPageCache, scheduleDeferred, writePageCache } from '../../../lib/pageCache';
import { apiUrl } from '../../../lib/api';

const PURCHASES_CACHE_KEY = 'purchases-page';
const getToken = () => localStorage.getItem('token');
const cleanPhone = (phone = '') => phone.replace(/\D/g, '');
const formatFullDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function SupplierDirectoryPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplierKey, setSelectedSupplierKey] = useState('');
  const hasBootstrappedRef = useRef(false);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/purchases'), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const nextPurchases = data.purchases || [];
      setPurchases(nextPurchases);
      writePageCache(PURCHASES_CACHE_KEY, { purchases: nextPurchases, summary: data.summary || {} });
      setError('');
    } catch {
      setError('Supplier list could not be loaded');
    }
  }, [router]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return undefined;
    hasBootstrappedRef.current = true;
    if (!localStorage.getItem('token')) { router.push('/login'); return; }

    const cached = readPageCache(PURCHASES_CACHE_KEY);
    if (cached?.purchases) {
      setPurchases(cached.purchases);
      setLoading(false);
    }

    const deferredId = scheduleDeferred(async () => {
      setRefreshing(Boolean(cached?.purchases));
      await fetchPurchases();
      setLoading(false);
      setRefreshing(false);
    });

    return () => cancelDeferred(deferredId);
  }, [fetchPurchases, router]);

  const suppliers = useMemo(() => {
    const map = new Map();
    purchases.forEach((purchase) => {
      const name = String(purchase.supplier_name || '').trim();
      const phone = cleanPhone(purchase.supplier_phone || '');
      if (!name && !phone) return;
      const key = `${name.toLowerCase()}|${phone}`;
      if (!map.has(key)) {
        map.set(key, { key, name: name || 'Unknown Supplier', phone, purchases: [] });
      }
      map.get(key).purchases.push(purchase);
    });

    const list = Array.from(map.values()).map((supplier) => {
      const sortedPurchases = supplier.purchases
        .slice()
        .sort((a, b) => new Date(b.createdAt || b.purchased_at || 0) - new Date(a.createdAt || a.purchased_at || 0));
      const totalSpend = sortedPurchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0);
      const totalDue = sortedPurchases.reduce((sum, purchase) => sum + Number(purchase.balance_due || 0), 0);
      const lastDate = sortedPurchases[0]?.createdAt || sortedPurchases[0]?.purchased_at || '';
      return {
        ...supplier,
        purchases: sortedPurchases,
        totalSpend,
        totalDue,
        lastDate,
      };
    });

    return list.sort((a, b) => new Date(b.lastDate || 0) - new Date(a.lastDate || 0));
  }, [purchases]);

  const normalizedSupplierSearch = supplierSearch.trim().toLowerCase();
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!normalizedSupplierSearch) return true;
    return supplier.name.toLowerCase().includes(normalizedSupplierSearch)
      || supplier.phone.includes(cleanPhone(normalizedSupplierSearch));
  });

  const selectedSupplier = suppliers.find((supplier) => supplier.key === selectedSupplierKey)
    || suppliers[0]
    || null;

  useEffect(() => {
    if (selectedSupplierKey || suppliers.length === 0) return;
    setSelectedSupplierKey(suppliers[0].key);
  }, [selectedSupplierKey, suppliers]);

  useEffect(() => {
    if (!selectedSupplierKey) return;
    const stillExists = suppliers.some((supplier) => supplier.key === selectedSupplierKey);
    if (!stillExists) {
      setSelectedSupplierKey(suppliers[0]?.key || '');
    }
  }, [selectedSupplierKey, suppliers]);

  return (
    <Layout>
      <div className="page-shell purchases-shell supplier-page">
        <section className="hero-panel purchases-hero supplier-hero">
          <div className="page-toolbar">
            <div className="min-w-0">
              <p className="rr-page-eyebrow">Suppliers</p>
              <div className="page-title">Supplier Directory</div>
              {refreshing ? <p className="rr-meta-line">Refreshing suppliers…</p> : null}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link href="/purchases" className="btn-ghost w-auto shrink-0">Back to Purchases</Link>
            </div>
          </div>
        </section>

        <div className="toolbar-card">
          <div className="toolbar">
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Search supplier name or phone..."
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
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
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">SP</div>
            <div>No suppliers found.</div>
          </div>
        ) : (
          <div className="supplier-page-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(360px, 2fr)', gap: 14 }}>
            <div className="supplier-list-panel" style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#f8fafc' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                All Suppliers ({filteredSuppliers.length})
              </div>
              <div className="supplier-list-scroll" style={{ maxHeight: 520, overflowY: 'auto' }}>
                {filteredSuppliers.map((supplier) => (
                  <button
                    type="button"
                    key={supplier.key}
                    onClick={() => setSelectedSupplierKey(supplier.key)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: '1px solid #e2e8f0',
                      background: supplier.key === selectedSupplier?.key ? '#e0f2fe' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{supplier.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {supplier.phone ? `+91 ${supplier.phone}` : 'Phone missing'} • {supplier.purchases.length} deals
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="supplier-detail-panel" style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#ffffff' }}>
              {selectedSupplier ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedSupplier.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {selectedSupplier.phone ? `+91 ${selectedSupplier.phone}` : 'Phone number not available'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={selectedSupplier.phone ? `tel:+91${selectedSupplier.phone}` : undefined}
                        className="btn-ghost"
                        style={{ pointerEvents: selectedSupplier.phone ? 'auto' : 'none', opacity: selectedSupplier.phone ? 1 : 0.5 }}
                      >
                        Call Now
                      </a>
                      <a
                        href={selectedSupplier.phone ? `https://wa.me/91${selectedSupplier.phone}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost"
                        style={{ pointerEvents: selectedSupplier.phone ? 'auto' : 'none', opacity: selectedSupplier.phone ? 1 : 0.5 }}
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '8px 10px', fontSize: 12, color: '#475569' }}>
                      Total Spend <strong style={{ color: '#0f172a' }}>₹{selectedSupplier.totalSpend.toFixed(2)}</strong>
                    </div>
                    <div style={{ background: '#fef2f2', borderRadius: 12, padding: '8px 10px', fontSize: 12, color: '#991b1b' }}>
                      Balance Due <strong>₹{selectedSupplier.totalDue.toFixed(2)}</strong>
                    </div>
                    <div style={{ background: '#ecfeff', borderRadius: 12, padding: '8px 10px', fontSize: 12, color: '#0f766e' }}>
                      Last Deal <strong>{selectedSupplier.lastDate ? formatFullDateTime(selectedSupplier.lastDate) : '—'}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Past Deals</div>
                  <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    {selectedSupplier.purchases.map((purchase) => (
                      <div key={purchase._id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{purchase.invoice_number || '—'}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                              {formatFullDateTime(purchase.createdAt || purchase.purchased_at)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#f59e0b' }}>₹{Number(purchase.total_amount || 0).toFixed(2)}</div>
                            {(purchase.balance_due || 0) > 0 ? (
                              <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>Due ₹{Number(purchase.balance_due || 0).toFixed(2)}</div>
                            ) : (
                              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>Paid</div>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                          {purchase.items && purchase.items.length > 1
                            ? `${purchase.items.length} items`
                            : purchase.product_name || 'Items'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Select a supplier to see details.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
