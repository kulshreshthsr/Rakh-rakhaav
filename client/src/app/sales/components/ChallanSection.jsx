'use client';

export default function ChallanSection({ challanForm, setChallanForm, form, INPUT, billTotals }) {
  return (
    <div className="space-y-4">

      {/* Section 1 — Challan Header */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
        <p className="text-[12px] font-black text-blue-900 uppercase tracking-wider">Challan Details</p>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Challan Type</p>
          <div className="flex gap-1.5 flex-wrap">
            {[['supply_of_goods','Supply of Goods'],['job_work','Job Work'],['supply_on_approval','Supply on Approval'],['others','Others']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setChallanForm(p => ({ ...p, challan_type: v }))}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${challanForm.challan_type === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
              >{l}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Challan Date</p>
          <input className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all"
            type="date" value={challanForm.challan_date}
            onChange={e => setChallanForm(p => ({ ...p, challan_date: e.target.value }))}
          />
        </div>
      </div>

      {/* Section 2 — Consignee Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-[12px] font-black text-slate-900 uppercase tracking-wider">Consignee (Who Receives Goods)</p>
        <input className={INPUT} placeholder="Consignee / Company Name *" value={challanForm.consignee_name}
          onChange={e => setChallanForm(p => ({ ...p, consignee_name: e.target.value }))} />
        <textarea className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all resize-none"
          rows={2} placeholder="Full delivery site address *"
          value={challanForm.consignee_address}
          onChange={e => setChallanForm(p => ({ ...p, consignee_address: e.target.value }))} />
        <input className={INPUT} placeholder="Consignee GSTIN (if registered)" value={challanForm.consignee_gstin}
          onChange={e => setChallanForm(p => ({ ...p, consignee_gstin: e.target.value.toUpperCase().slice(0,15) }))} />
        <div className="grid grid-cols-2 gap-3">
          <input className={INPUT} placeholder="Site In-charge Name" value={challanForm.consignee_contact}
            onChange={e => setChallanForm(p => ({ ...p, consignee_contact: e.target.value }))} />
          <input className={INPUT} placeholder="Contact Phone" type="tel" value={challanForm.consignee_phone}
            onChange={e => setChallanForm(p => ({ ...p, consignee_phone: e.target.value }))} />
        </div>
      </div>

      {/* Section 3 — Dispatch Details */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
        <p className="text-[12px] font-black text-amber-900 uppercase tracking-wider">Dispatch & Transport</p>
        <div className="grid grid-cols-2 gap-3">
          <input className={INPUT} placeholder="Dispatch From (your address)" value={challanForm.dispatch_from}
            onChange={e => setChallanForm(p => ({ ...p, dispatch_from: e.target.value }))} />
          <input className={INPUT} placeholder="Deliver To (site address)" value={challanForm.deliver_to}
            onChange={e => setChallanForm(p => ({ ...p, deliver_to: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={INPUT} placeholder="Vehicle No. (UP80 AB 1234)" value={challanForm.vehicle_number}
            onChange={e => setChallanForm(p => ({ ...p, vehicle_number: e.target.value.toUpperCase() }))} />
          <input className={INPUT} placeholder="Transporter Name" value={challanForm.transport_name}
            onChange={e => setChallanForm(p => ({ ...p, transport_name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={INPUT} placeholder="LR / GR Number" value={challanForm.lr_number}
            onChange={e => setChallanForm(p => ({ ...p, lr_number: e.target.value }))} />
          <input className={INPUT} placeholder="E-way Bill No." value={challanForm.eway_bill_number}
            onChange={e => setChallanForm(p => ({ ...p, eway_bill_number: e.target.value }))} />
        </div>
        {billTotals && billTotals.total > 50000 && !challanForm.eway_bill_number && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-100 border border-amber-300 text-[11px] font-semibold text-amber-800">
            <span className="flex-shrink-0">⚠️</span>
            <span>Goods value exceeds ₹50,000 — E-way Bill is mandatory under GST rules. Please enter the e-way bill number.</span>
          </div>
        )}
      </div>

      {/* Section 4 — Reference Documents */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <p className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Reference Documents (Optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <input className={INPUT} placeholder="Buyer's PO Number" value={challanForm.po_number}
            onChange={e => setChallanForm(p => ({ ...p, po_number: e.target.value }))} />
          <input className="h-11 w-full px-4 rounded-xl border-2 border-slate-200 bg-white text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all"
            type="date" value={challanForm.po_date}
            onChange={e => setChallanForm(p => ({ ...p, po_date: e.target.value }))} />
        </div>
        <input className={INPUT} placeholder="Internal Indent / Requisition Number" value={challanForm.indent_number}
          onChange={e => setChallanForm(p => ({ ...p, indent_number: e.target.value }))} />
      </div>

    </div>
  );
}
