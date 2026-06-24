'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { apiUrl } from '../../lib/api';
import { getToken, fmt } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import FeatureLockedModal from '../../components/FeatureLockedModal';
import { isFeatureLockedError } from '../../lib/apiErrors';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'partially_received', label: 'Partial' },
  { id: 'received', label: 'Done' },
];

const emptyItem = () => ({
  product: '',
  product_name: '',
  hsn_code: '',
  ordered_quantity: 1,
  unit: '',
  agreed_price: 0,
  gst_rate: 0,
});

export default function PurchaseOrdersPage() {
  const { showToast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [lockedInfo, setLockedInfo] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [receiveMode, setReceiveMode] = useState(false);
  const [grnNotice, setGrnNotice] = useState('');

  const [form, setForm] = useState({
    supplier: '',
    supplier_name: '',
    status: 'draft',
    expected_delivery_date: '',
    delivery_site: '',
    notes: '',
    po_date: new Date().toISOString().slice(0, 10),
    items: [emptyItem()],
  });

  const [receiveItems, setReceiveItems] = useState([]);

  const token = typeof window === 'undefined' ? '' : getToken();

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return purchaseOrders;
    return purchaseOrders.filter((order) => order.status === statusFilter);
  }, [purchaseOrders, statusFilter]);

  const pendingGrnCount = useMemo(
    () => purchaseOrders.filter((o) => o.status === 'ordered' || o.status === 'partially_received').length,
    [purchaseOrders],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, supplierRes, productRes] = await Promise.all([
        fetch(apiUrl('/api/purchase-orders'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/suppliers'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/products'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const poData = await poRes.json();
      if (isFeatureLockedError(poRes, poData)) { setLockedInfo(poData); setLoading(false); return; }
      const supplierData = await supplierRes.json();
      const productData = await productRes.json();
      setPurchaseOrders(Array.isArray(poData.purchaseOrders) ? poData.purchaseOrders : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setProducts(Array.isArray(productData) ? productData : productData.products || []);
    } catch (err) {
      showToast('Could not load purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    if (!token) return;
    fetchAll();
  }, [fetchAll, token]);

  const resetForm = () => {
    setForm({
      supplier: '',
      supplier_name: '',
      status: 'draft',
      expected_delivery_date: '',
      delivery_site: '',
      notes: '',
      po_date: new Date().toISOString().slice(0, 10),
      items: [emptyItem()],
    });
  };

  const openCreate = () => {
    resetForm();
    setCreateMode(true);
  };

  const updateItem = (index, field, value) => {
    setForm((current) => {
      const items = [...current.items];
      const nextItem = { ...items[index], [field]: value };
      if (field === 'product') {
        const product = products.find((entry) => String(entry._id) === String(value));
        if (product) {
          nextItem.product_name = product.name || '';
          nextItem.hsn_code = product.hsn_code || '';
          nextItem.unit = product.unit || '';
          nextItem.gst_rate = Number(product.gst_rate || 0);
          nextItem.agreed_price = Number(product.price || 0);
        }
      }
      items[index] = nextItem;
      return { ...current, items };
    });
  };

  const addItem = () => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  const removeItem = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        supplier: form.supplier || undefined,
        items: form.items
          .filter((item) => item.product || item.product_name)
          .map((item) => ({
            product: item.product || undefined,
            product_name: item.product_name,
            hsn_code: item.hsn_code,
            ordered_quantity: Number(item.ordered_quantity || 0),
            unit: item.unit,
            agreed_price: Number(item.agreed_price || 0),
            gst_rate: Number(item.gst_rate || 0),
          })),
      };

      const res = await fetch(apiUrl('/api/purchase-orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isFeatureLockedError(res, data)) { setLockedInfo(data); return; }
        throw new Error(data.message || 'Could not create purchase order');
      }
      showToast(`PO ${data.po_number} created`, 'success');
      setCreateMode(false);
      await fetchAll();
    } catch (err) {
      showToast(err.message || 'Could not create purchase order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openPO = async (poId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/purchase-orders/${poId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (isFeatureLockedError(res, data)) { setLockedInfo(data); return; }
        throw new Error(data.message || 'Could not load purchase order');
      }
      setSelectedPO(data);
      setReceiveItems((data.items || []).map((item) => ({
        product: item.product?._id || item.product,
        product_name: item.product_name || item.product?.name || '',
        ordered_quantity: Number(item.ordered_quantity || 0),
        received_quantity: Number(item.pending_quantity || Math.max(0, Number(item.ordered_quantity || 0) - Number(item.received_quantity || 0))),
      })));
      setGrnNotice('');
    } catch (err) {
      showToast(err.message || 'Could not load purchase order', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!selectedPO) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/purchase-orders/${selectedPO._id}/receive`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: receiveItems
            .filter((item) => Number(item.received_quantity || 0) > 0)
            .map((item) => ({ product: item.product, received_quantity: Number(item.received_quantity || 0) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isFeatureLockedError(res, data)) { setLockedInfo(data); return; }
        throw new Error(data.message || 'Could not receive stock');
      }
      setGrnNotice(`GRN ${data.grn_number} created`);
      showToast(`GRN ${data.grn_number} created`, 'success');
      await fetchAll();
      setSelectedPO(data.purchaseOrder);
      setReceiveMode(false);
    } catch (err) {
      showToast(err.message || 'Could not receive stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedPO) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/purchase-orders/${selectedPO._id}/convert`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (isFeatureLockedError(res, data)) { setLockedInfo(data); return; }
        throw new Error(data.message || 'Could not convert purchase order');
      }
      showToast(`Converted to purchase ${data.purchase?.invoice_number || ''}`.trim(), 'success');
      await fetchAll();
      setSelectedPO(data.purchaseOrder);
      setGrnNotice(data.purchase ? `Purchase ${data.purchase.invoice_number}` : '');
    } catch (err) {
      showToast(err.message || 'Could not convert purchase order', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 pb-28">
        <div className="mb-5 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-100 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Purchase Orders</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900 flex items-center gap-2.5">
                PO to GRN flow
                {pendingGrnCount > 0 && (
                  <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-full bg-amber-500 px-1.5 text-[11px] font-black text-white">
                    {pendingGrnCount}
                  </span>
                )}
              </h1>
              <p className="mt-1 text-sm text-slate-600">Draft PO, receive stock in parts, and auto-create the purchase record.</p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-black text-white shadow-lg shadow-slate-900/20"
            >
              + New PO
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={`h-11 shrink-0 rounded-2xl border px-4 text-sm font-black ${
                statusFilter === filter.id
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-lg font-black text-slate-800">No purchase orders yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a PO for your supplier in a few taps.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map((po) => (
              <button
                key={po._id}
                type="button"
                onClick={() => openPO(po._id)}
                className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{po.po_number}</p>
                    <h2 className="mt-1 text-[17px] font-black text-slate-900">{po.supplier_name || po.supplier?.name || 'Unnamed supplier'}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase text-slate-600">
                    {po.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <span>{Array.isArray(po.items) ? po.items.length : 0} items</span>
                  <span className="font-black text-slate-900">₹{fmt(Number(po.total_amount || 0))}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {po.delivery_site || 'No delivery site'} • {new Date(po.po_date || po.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedPO && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-3xl sm:rounded-[28px] sm:max-h-[88vh] sm:overflow-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">{selectedPO.po_number}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">{selectedPO.supplier_name || selectedPO.supplier?.name || 'Purchase order'}</h2>
                  {grnNotice && <p className="mt-1 text-sm font-bold text-emerald-700">{grnNotice}</p>}
                </div>
                <button type="button" onClick={() => { setSelectedPO(null); setReceiveMode(false); }} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600">
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Status</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{selectedPO.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Total</p>
                  <p className="mt-1 text-lg font-black text-slate-900">₹{fmt(Number(selectedPO.total_amount || 0))}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">GRN</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{selectedPO.grn_number || '—'}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(selectedPO.items || []).map((item) => (
                  <div key={`${item.product?._id || item.product}-${item.product_name}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{item.product_name || item.product?.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Qty {Number(item.ordered_quantity || 0)} • Received {Number(item.received_quantity || 0)} • Pending {Number(item.pending_quantity || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">₹{fmt(Number(item.agreed_price || 0))}</p>
                        <p className="text-xs text-slate-500">GST {Number(item.gst_rate || 0)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setReceiveMode((value) => !value)}
                  className="h-11 rounded-2xl bg-amber-600 px-5 text-sm font-black text-white"
                >
                  Receive Stock
                </button>
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={saving || selectedPO.status !== 'received'}
                  className="h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700 disabled:opacity-40"
                >
                  Convert to Purchase
                </button>
              </div>

              {detailLoading && <p className="mt-4 text-sm text-slate-500">Loading...</p>}

              {receiveMode && (
                <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-900">Receive stock quantities</p>
                  <div className="mt-3 space-y-3">
                    {receiveItems.map((item, index) => (
                      <div key={`${item.product}-${index}`} className="grid grid-cols-12 gap-2 rounded-2xl bg-white p-3">
                        <div className="col-span-7">
                          <p className="text-sm font-bold text-slate-900">{item.product_name}</p>
                          <p className="text-xs text-slate-500">Ordered: {item.ordered_quantity}</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={item.ordered_quantity}
                          value={item.received_quantity}
                          onChange={(event) => {
                            const value = Number(event.target.value || 0);
                            setReceiveItems((current) => current.map((entry, entryIndex) => (
                              entryIndex === index ? { ...entry, received_quantity: value } : entry
                            )));
                          }}
                          className="col-span-5 h-11 rounded-xl border border-slate-200 px-3 text-right text-sm font-black"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={handleReceive}
                      disabled={saving}
                      className="h-11 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save GRN'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiveMode(false)}
                      className="h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {createMode && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 sm:items-center">
            <div className="w-full rounded-t-[28px] bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-4xl sm:rounded-[28px] sm:max-h-[90vh] sm:overflow-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Create PO</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">New purchase order</h2>
                </div>
                <button type="button" onClick={() => setCreateMode(false)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600">
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <select
                  value={form.supplier}
                  onChange={(event) => {
                    const supplier = suppliers.find((entry) => String(entry._id) === String(event.target.value));
                    setForm((current) => ({
                      ...current,
                      supplier: event.target.value,
                      supplier_name: supplier?.name || current.supplier_name,
                    }));
                  }}
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                  ))}
                </select>
                <input
                  value={form.supplier_name}
                  onChange={(event) => setForm((current) => ({ ...current, supplier_name: event.target.value }))}
                  placeholder="Supplier name"
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                />
                <input
                  type="date"
                  value={form.po_date}
                  onChange={(event) => setForm((current) => ({ ...current, po_date: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                />
                <input
                  type="date"
                  value={form.expected_delivery_date}
                  onChange={(event) => setForm((current) => ({ ...current, expected_delivery_date: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                />
                <input
                  value={form.delivery_site}
                  onChange={(event) => setForm((current) => ({ ...current, delivery_site: event.target.value }))}
                  placeholder="Delivery site"
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold sm:col-span-2"
                />
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Notes"
                  className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold sm:col-span-2"
                />
              </div>

              <div className="mt-5 space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="rounded-3xl border border-slate-200 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <select
                        value={item.product}
                        onChange={(event) => updateItem(index, 'product', event.target.value)}
                        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <input
                        value={item.product_name}
                        onChange={(event) => updateItem(index, 'product_name', event.target.value)}
                        placeholder="Product name"
                        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.ordered_quantity}
                        onChange={(event) => updateItem(index, 'ordered_quantity', event.target.value)}
                        placeholder="Qty"
                        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.agreed_price}
                        onChange={(event) => updateItem(index, 'agreed_price', event.target.value)}
                        placeholder="Agreed price"
                        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                      />
                      <input
                        value={item.hsn_code}
                        onChange={(event) => updateItem(index, 'hsn_code', event.target.value)}
                        placeholder="HSN"
                        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.gst_rate}
                        onChange={(event) => updateItem(index, 'gst_rate', event.target.value)}
                        placeholder="GST %"
                        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                        className="h-10 rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={addItem}
                  className="h-11 rounded-2xl border border-dashed border-slate-300 px-5 text-sm font-black text-slate-600"
                >
                  + Add item
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="h-11 rounded-2xl bg-amber-600 px-5 text-sm font-black text-white disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Create PO'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {lockedInfo && (
        <FeatureLockedModal
          feature={lockedInfo.feature}
          currentTier={lockedInfo.currentTier}
          onClose={() => setLockedInfo(null)}
        />
      )}
    </Layout>
  );
}
