'use client';

export default function InlineProductForm({
  newProductForm,
  setNewProductForm,
  creatingProduct,
  onCancel,
  onSubmit,
  INPUT,
}) {
  const update = (patch) => setNewProductForm((prev) => ({ ...prev, ...patch }));

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 space-y-3">
      <p className="text-[13px] font-black text-green-700">Naya product yahin add karein</p>
      <input
        className={INPUT}
        placeholder="Jaise: New Chips 45g"
        value={newProductForm.name}
        onChange={(e) => update({ name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          className={INPUT}
          type="number"
          min="0"
          step="0.01"
          placeholder="MRP / selling price"
          value={newProductForm.price}
          onChange={(e) => update({ price: e.target.value })}
        />
        <select
          className={INPUT}
          value={newProductForm.gst_rate}
          onChange={(e) => update({ gst_rate: e.target.value })}
        >
          {[0, 5, 12, 18, 28].map((rate) => (
            <option key={rate} value={String(rate)}>{rate}%</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          className={INPUT}
          placeholder="pcs / box / kg"
          value={newProductForm.unit}
          onChange={(e) => update({ unit: e.target.value })}
        />
        <input
          className={INPUT}
          placeholder="Optional HSN"
          value={newProductForm.hsn_code}
          onChange={(e) => update({ hsn_code: e.target.value })}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={creatingProduct}
          className="flex-1 py-3 rounded-xl text-[13px] font-black text-white bg-gradient-to-r from-green-600 to-emerald-700 shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
        >
          {creatingProduct ? 'Adding...' : 'Save Product'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={creatingProduct}
          className="px-4 py-3 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
