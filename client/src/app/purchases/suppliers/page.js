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

const buildPurchaseWhatsAppMessage = (purchase) => {
  const purchaseDate = new Date(purchase.createdAt || purchase.purchased_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const itemLines = purchase.items && purchase.items.length > 0
    ? purchase.items.map((item, index) => (
        `  ${index + 1}. ${item.product_name} x ${item.quantity} @ Rs ${Number(item.price_per_unit || 0).toFixed(2)} = Rs ${Number(item.total_amount || 0).toFixed(2)}`
      )).join('\n')
    : `  1. ${purchase.product_name} x ${purchase.quantity || 1} @ Rs ${Number(purchase.price_per_unit || 0).toFixed(2)} = Rs ${Number(purchase.total_amount || 0).toFixed(2)}`;

  return [
    purchase.supplier_name ? `Namaste ${purchase.supplier_name} ji,` : 'Namaste,',
    '',
    'Purchase confirmation',
    `Bill No: ${purchase.invoice_number || '-'}`,
    `Date: ${purchaseDate}`,
    'Items:',
    itemLines,
    `Taxable Amount: Rs ${Number(purchase.taxable_amount || 0).toFixed(2)}`,
    `GST / ITC: Rs ${Number(purchase.total_gst || 0).toFixed(2)}`,
    `Total Amount: Rs ${Number(purchase.total_amount || 0).toFixed(2)}`,
    `Paid: Rs ${Number(purchase.amount_paid || 0).toFixed(2)}`,
    ...(Number(purchase.balance_due || 0) > 0 ? [`Balance Due: Rs ${Number(purchase.balance_due || 0).toFixed(2)}`] : []),
    '',
    'Please review and confirm the purchase details.',
  ].join('\n');
};

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
      if (res.status === 401) {
        router.push('/login');
        return;
      }

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

    if (!localStorage.getItem('token')) {
      router.push('/login');
      return undefined;
    }

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

      return {
        ...supplier,
        purchases: sortedPurchases,
        totalSpend: sortedPurchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0),
        totalDue: sortedPurchases.reduce((sum, purchase) => sum + Number(purchase.balance_due || 0), 0),
        lastDate: sortedPurchases[0]?.createdAt || sortedPurchases[0]?.purchased_at || '',
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

  const selectedLatestPurchase = selectedSupplier?.purchases?.[0] || null;

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
              <div className="page-title">सप्लायर लिस्ट</div>
              {refreshing ? <p className="rr-meta-line">Refreshing suppliers...</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/purchases" className="btn-ghost w-auto shrink-0">Purchases par wapas</Link>
            </div>
          </div>
        </section>

        <div className="toolbar-card supplier-toolbar-card">
          <div className="toolbar">
            <input
              className="form-input min-w-[220px] flex-1"
              placeholder="Supplier ka naam ya phone search karein..."
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
            />
          </div>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}

        {loading ? (
          <div className="card grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-[72px]" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">SP</div>
            <div>No suppliers found.</div>
          </div>
        ) : (
          <div className="supplier-page-grid grid grid-cols-[minmax(240px,1fr)_minmax(360px,2fr)] gap-[14px]">
            <div className="supplier-list-panel overflow-hidden rounded-[18px] border border-blue-100 bg-blue-50/40">
              <div className="border-b border-blue-100 px-3 py-2.5 text-[12px] font-bold text-slate-500">
                All Suppliers ({filteredSuppliers.length})
              </div>
              <div className="supplier-list-scroll max-h-[520px] overflow-y-auto">
                {filteredSuppliers.map((supplier) => (
                  <button
                    type="button"
                    key={supplier.key}
                    onClick={() => setSelectedSupplierKey(supplier.key)}
                    className={`supplier-list-item w-full cursor-pointer border-0 border-b border-blue-100 px-3 py-3 text-left ${supplier.key === selectedSupplier?.key ? 'bg-blue-100' : 'bg-white/80'}`}
                  >
                    <div className="text-[13px] font-bold text-slate-900">{supplier.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {supplier.phone ? `+91 ${supplier.phone}` : 'Phone missing'} • {supplier.purchases.length} deals
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="supplier-detail-panel rounded-[18px] border border-slate-200 bg-white p-[14px] shadow-sm">
              {selectedSupplier ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[18px] font-bold text-slate-900">{selectedSupplier.name}</div>
                      <div className="text-[12px] text-slate-500">
                        {selectedSupplier.phone ? `+91 ${selectedSupplier.phone}` : 'Phone number not available'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={selectedSupplier.phone ? `tel:+91${selectedSupplier.phone}` : undefined}
                        className={`btn-ghost w-auto ${selectedSupplier.phone ? '' : 'pointer-events-none opacity-50'}`}
                      >
                        Call Now
                      </a>
                      <a
                        href={selectedSupplier.phone
                          ? `https://wa.me/91${selectedSupplier.phone}?text=${encodeURIComponent(
                              selectedLatestPurchase ? buildPurchaseWhatsAppMessage(selectedLatestPurchase) : 'Namaste'
                            )}`
                          : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={`action-soft whatsapp w-auto ${selectedSupplier.phone ? '' : 'pointer-events-none opacity-50'}`}
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                      Total Spend <strong className="text-slate-900">₹{selectedSupplier.totalSpend.toFixed(2)}</strong>
                    </div>
                    <div className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                      Balance Due <strong>₹{selectedSupplier.totalDue.toFixed(2)}</strong>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
                      Last Deal <strong>{selectedSupplier.lastDate ? formatFullDateTime(selectedSupplier.lastDate) : '-'}</strong>
                    </div>
                  </div>

                  <div className="mt-[14px] text-[12px] font-bold text-slate-500">Past Deals</div>
                  <div className="mt-2 grid gap-2">
                    {selectedSupplier.purchases.map((purchase) => (
                      <div key={purchase._id} className="supplier-deal-card rounded-xl border border-slate-200 p-3">
                        <div className="flex justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-bold text-slate-900">{purchase.invoice_number || '-'}</div>
                            <div className="text-[11px] text-slate-400">
                              {formatFullDateTime(purchase.createdAt || purchase.purchased_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">₹{Number(purchase.total_amount || 0).toFixed(2)}</div>
                            {(purchase.balance_due || 0) > 0 ? (
                              <div className="text-[11px] font-bold text-rose-500">Due ₹{Number(purchase.balance_due || 0).toFixed(2)}</div>
                            ) : (
                              <div className="text-[11px] font-bold text-emerald-500">Paid</div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 text-[11px] text-slate-500">
                          {purchase.items && purchase.items.length > 1
                            ? `${purchase.items.length} items`
                            : purchase.product_name || 'Items'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-[13px] text-slate-400">Select a supplier to see details.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
