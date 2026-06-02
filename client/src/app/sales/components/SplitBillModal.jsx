'use client';

export default function SplitBillModal({
  splitSale,
  splitMode,
  setSplitMode,
  splitCount,
  setSplitCount,
  splitAssignments,
  setSplitAssignments,
  onClose,
  onSplitComplete,
  apiUrl,
  getToken,
  fmt,
}) {
  const total = splitSale.total_amount || 0;
  const saleItems = splitSale.items || [];
  const perPerson = splitCount > 0 ? (total / splitCount).toFixed(2) : '0.00';

  const handleCreateSplits = async () => {
    try {
      if (splitMode === 'equal') {
        const splitPromises = Array.from({ length: splitCount }, (_, i) => {
          const ef = splitSale.extra_fields instanceof Map ? Object.fromEntries(splitSale.extra_fields) : (splitSale.extra_fields || {});
          return fetch(apiUrl('/api/sales'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({
              items: saleItems,
              payment_type: 'cash',
              amount_paid: 0,
              extra_fields: { ...ef, split_from: splitSale.invoice_number, split_part: `${i + 1} of ${splitCount}` },
            }),
          });
        });
        const results = await Promise.all(splitPromises);
        const created = await Promise.all(results.map(r => r.json()));
        const nums = created.map(c => c.invoice_number).filter(Boolean).join(', ');
        alert(`Created ${splitCount} split bills: ${nums}`);
        onSplitComplete();
      } else {
        const bills = {};
        saleItems.forEach((item, idx) => { const b = splitAssignments[idx] || 1; bills[b] = [...(bills[b] || []), item]; });
        const splitPromises = Object.entries(bills).map(([, billItems]) => {
          const ef = splitSale.extra_fields instanceof Map ? Object.fromEntries(splitSale.extra_fields) : (splitSale.extra_fields || {});
          return fetch(apiUrl('/api/sales'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ items: billItems, payment_type: 'cash', amount_paid: 0, extra_fields: { ...ef, split_from: splitSale.invoice_number } }),
          });
        });
        const results = await Promise.all(splitPromises);
        const created = await Promise.all(results.map(r => r.json()));
        const nums = created.map(c => c.invoice_number).filter(Boolean).join(', ');
        alert(`Created ${Object.keys(bills).length} split bills: ${nums}`);
        onSplitComplete();
      }
    } catch { alert('Split bill creation failed'); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-black text-slate-900">Split Bill</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">{splitSale.invoice_number} — ₹{fmt(total)}</p>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
          </div>
          <div className="flex gap-2 mt-3">
            {['equal', 'custom'].map(m => (
              <button key={m} type="button" onClick={() => setSplitMode(m)}
                className={`flex-1 py-2 rounded-xl text-[12px] font-black border-2 ${splitMode === m ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 text-slate-600'}`}
              >{m === 'equal' ? '⚖️ Equal Split' : '✂️ By Item'}</button>
            ))}
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-72 overflow-y-auto">
          {splitMode === 'equal' ? (
            <div className="space-y-3">
              <p className="text-[13px] font-bold text-slate-700">Split among how many people?</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSplitCount(c => Math.max(2, c - 1))} className="w-10 h-10 rounded-xl border-2 border-slate-200 text-[18px] font-black text-slate-600 hover:bg-slate-50">−</button>
                <span className="text-[22px] font-black text-slate-900 w-8 text-center">{splitCount}</span>
                <button type="button" onClick={() => setSplitCount(c => Math.min(10, c + 1))} className="w-10 h-10 rounded-xl border-2 border-slate-200 text-[18px] font-black text-slate-600 hover:bg-slate-50">+</button>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-50 border border-purple-200">
                <span className="text-[12px] font-bold text-purple-800">Each person pays</span>
                <span className="text-[16px] font-black text-purple-800">₹{perPerson}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] font-bold text-slate-600">Assign each item to a bill:</p>
              {saleItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[12px] font-semibold text-slate-800">{item.product_name} ×{item.quantity}</span>
                  <select
                    className="h-8 px-2 rounded-lg border border-slate-200 text-[11px] bg-white"
                    value={splitAssignments[idx] || 1}
                    onChange={e => setSplitAssignments(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                  >
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Bill {n}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-slate-100">
          <button type="button" onClick={handleCreateSplits}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-700 text-white font-black text-[14px] shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 transition-all"
          >Create {splitMode === 'equal' ? `${splitCount} Bills` : 'Split Bills'}</button>
        </div>
      </div>
    </div>
  );
}
