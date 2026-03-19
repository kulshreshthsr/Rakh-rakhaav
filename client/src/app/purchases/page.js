'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import SearchableProductSelect from '../../components/SearchableProductSelect';

const STATES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const UTS=['Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];
const API='https://rakh-rakhaav.onrender.com';
const getToken=()=>localStorage.getItem('token');
const emptyItem=()=>({product_id:'',quantity:1,price_per_unit:''});

export default function PurchasesPage() {
  const[purchases,setPurchases]=useState([]);
  const[products,setProducts]=useState([]);
  const[summary,setSummary]=useState({});
  const[loading,setLoading]=useState(true);
  const[showModal,setShowModal]=useState(false);
  const[submitting,setSubmitting]=useState(false);
  const[error,setError]=useState('');
  const[items,setItems]=useState([emptyItem()]);
  const[form,setForm]=useState({payment_type:'cash',amount_paid:'',supplier_name:'',supplier_phone:'',supplier_gstin:'',supplier_address:'',supplier_state:'',notes:''});
  const router=useRouter();

  useEffect(()=>{if(!localStorage.getItem('token')){router.push('/login');return;}fetchAll();},[]);
  const fetchAll=async()=>{setLoading(true);await Promise.all([fetchPurchases(),fetchProducts()]);setLoading(false);};
  const fetchPurchases=async()=>{try{const res=await fetch(`${API}/api/purchases`,{headers:{Authorization:`Bearer ${getToken()}`}});if(res.status===401){router.push('/login');return;}const data=await res.json();setPurchases(data.purchases||[]);setSummary(data.summary||{});}catch{setError('खरीद लोड नहीं हो सकी');}};
  const fetchProducts=async()=>{try{const res=await fetch(`${API}/api/products`,{headers:{Authorization:`Bearer ${getToken()}`}});const data=await res.json();setProducts(Array.isArray(data)?data:data.products||[]);}catch{}};
  const updateItem=(index,field,value)=>{const updated=[...items];updated[index][field]=value;if(field==='product_id'&&value){const prod=products.find(p=>p._id===value);if(prod)updated[index].price_per_unit=prod.cost_price||prod.price||'';}setItems(updated);};
  const addItem=()=>setItems([...items,emptyItem()]);
  const removeItem=(index)=>{if(items.length===1)return;setItems(items.filter((_,i)=>i!==index));};
  const calcRowGST=(item)=>{const prod=products.find(p=>p._id===item.product_id);if(!prod||!item.quantity||!item.price_per_unit)return null;const taxable=parseFloat(item.quantity)*parseFloat(item.price_per_unit);const gst_rate=prod.gst_rate||0;const gst=(taxable*gst_rate)/100;return{taxable,gst_rate,gst,total:taxable+gst};};
  const billTotals=items.reduce((acc,item)=>{const g=calcRowGST(item);if(!g)return acc;return{taxable:acc.taxable+g.taxable,gst:acc.gst+g.gst,total:acc.total+g.total};},{taxable:0,gst:0,total:0});
  const amountPaidNum=parseFloat(form.amount_paid)||0;
  const balanceDue=Math.max(0,billTotals.total-amountPaidNum);
  const handleSubmit=async(e)=>{e.preventDefault();setError('');if(form.payment_type==='credit'&&!form.supplier_name){setError('Credit purchase ke liye supplier naam zaroori hai!');return;}const validItems=items.filter(i=>i.product_id&&i.quantity&&i.price_per_unit);if(validItems.length===0){setError('Kam se kam ek product chunein');return;}setSubmitting(true);try{const payload={items:validItems,payment_type:form.payment_type,amount_paid:form.payment_type==='cash'?billTotals.total:(amountPaidNum||0),supplier_name:form.supplier_name,supplier_phone:form.supplier_phone,supplier_gstin:form.supplier_gstin,supplier_address:form.supplier_address,supplier_state:form.supplier_state,notes:form.notes};const res=await fetch(`${API}/api/purchases`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`},body:JSON.stringify(payload)});const data=await res.json();if(res.ok){setShowModal(false);setItems([emptyItem()]);setForm({payment_type:'cash',amount_paid:'',supplier_name:'',supplier_phone:'',supplier_gstin:'',supplier_address:'',supplier_state:'',notes:''});fetchPurchases();}else setError(data.message||'विफल');}catch{setError('सर्वर त्रुटि');}setSubmitting(false);};
  const handleDelete=async(id)=>{if(!confirm('इस खरीद को हटाएं?'))return;try{await fetch(`${API}/api/purchases/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${getToken()}`}});fetchPurchases();}catch{setError('हटाने में विफल');}};
  const resetModal=()=>{setShowModal(false);setError('');setItems([emptyItem()]);setForm({payment_type:'cash',amount_paid:'',supplier_name:'',supplier_phone:'',supplier_gstin:'',supplier_address:'',supplier_state:'',notes:''});};
  const PayBadge=({type})=>{const map={cash:{bg:'#DCFCE7',color:'#166534',label:'💵 नकद'},credit:{bg:'#FEE2E2',color:'#991B1B',label:'📒 उधार'},upi:{bg:'#EDE9FE',color:'#5B21B6',label:'📱 UPI'},bank:{bg:'#DBEAFE',color:'#1E40AF',label:'🏦 Bank'}};const s=map[type]||map.cash;return <span style={{background:s.bg,color:s.color,padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:700}}>{s.label}</span>;};
  const fmt=(n)=>parseFloat(n||0).toFixed(2);
  const IS={width:'100%',padding:'12px 14px',border:'2px solid #E2E8F0',borderRadius:10,fontSize:14,color:'#0F172A',background:'#fff',outline:'none',fontFamily:'DM Sans,sans-serif',boxSizing:'border-box',transition:'border-color 0.2s,box-shadow 0.2s'};
  const LS={fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,display:'block',marginBottom:7};
  const selStyle={...IS,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%2394A3B8' d='M5 6L0 0h10z'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:32,appearance:'none'};

  return (
    <Layout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');.pi:focus{border-color:#F59E0B!important;box-shadow:0 0 0 3px rgba(245,158,11,0.1)!important;}.prow:hover{background:#FFFBEB!important;}@keyframes spin{to{transform:rotate(360deg);}}@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}@keyframes modalIn{from{opacity:0;transform:scale(0.9) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);}}@media(max-width:640px){.hidden-xs{display:none!important;}.show-xs{display:flex!important;}}@media(min-width:641px){.show-xs{display:none!important;}}`}</style>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:26,fontWeight:800,color:'#0F172A',letterSpacing:'-0.5px',marginBottom:5}}>खरीद / Purchases 🛒</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#D97706',fontWeight:700,background:'#FFFBEB',padding:'2px 10px',borderRadius:20}}>₹{fmt(summary.totalPurchaseValue)} spent</span>
            {(summary.totalITC||0)>0&&<span style={{fontSize:12,color:'#6366F1',fontWeight:700,background:'#EEF2FF',padding:'2px 10px',borderRadius:20}}>ITC: ₹{fmt(summary.totalITC)}</span>}
            {(summary.totalDue||0)>0&&<span style={{fontSize:12,color:'#DC2626',fontWeight:700,background:'#FEF2F2',padding:'2px 10px',borderRadius:20}}>Due: ₹{fmt(summary.totalDue)}</span>}
          </div>
        </div>
        <button onClick={()=>setShowModal(true)} style={{padding:'10px 20px',background:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif',boxShadow:'0 3px 12px rgba(245,158,11,0.3)',transition:'all 0.2s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>+ खरीद दर्ज</button>
      </div>

      {error&&!showModal&&<div style={{background:'#FEF2F2',color:'#991B1B',border:'1px solid #FECACA',padding:'12px 16px',borderRadius:10,marginBottom:16,fontSize:13}}>⚠️ {error}</div>}

      {loading?(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:80,gap:12}}>
          <div style={{width:36,height:36,border:'3px solid #E2E8F0',borderTopColor:'#F59E0B',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
          <div style={{color:'#94A3B8',fontSize:14}}>लोड हो रहा है...</div>
        </div>
      ):purchases.length===0?(
        <div style={{background:'#fff',borderRadius:16,padding:'60px 20px',textAlign:'center',border:'1px solid #F1F5F9'}}>
          <div style={{fontSize:48,marginBottom:12}}>🛒</div>
          <div style={{fontWeight:700,fontSize:16,color:'#475569',marginBottom:4}}>अभी कोई खरीद नहीं</div>
          <div style={{fontSize:13,color:'#94A3B8'}}>पहली खरीद दर्ज करें</div>
        </div>
      ):(
        <>
          <div className="hidden-xs" style={{background:'#fff',borderRadius:16,border:'1px solid #F1F5F9',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.05)',animation:'fadeUp 0.4s ease both'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'linear-gradient(135deg,#060D1A,#0B1D35)'}}>
                  {['Bill No.','Product','Items','Taxable','GST (ITC)','Total','Paid','Due','Payment','Date','Action'].map(h=>(
                    <th key={h} style={{padding:'13px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.55)',textTransform:'uppercase',letterSpacing:0.8,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p,i)=>(
                  <tr key={p._id} className="prow" style={{borderBottom:'1px solid #F8FAFC',transition:'background 0.15s',animation:`fadeUp 0.3s ease ${i*0.03}s both`}}>
                    <td style={{padding:'12px',color:'#D97706',fontWeight:700,fontSize:12}}>{p.invoice_number}</td>
                    <td style={{padding:'12px'}}>
                      <div style={{fontWeight:600,color:'#0F172A',fontSize:13}}>{p.items&&p.items.length>1?p.items.map(i=>i.product_name).join(', '):p.product_name}</div>
                      {p.supplier_name&&<div style={{fontSize:11,color:'#94A3B8'}}>से: {p.supplier_name}</div>}
                    </td>
                    <td style={{padding:'12px',fontSize:12,color:'#64748B'}}>{p.items&&p.items.length>1?`${p.items.length} items`:`${p.quantity||1} pcs`}</td>
                    <td style={{padding:'12px',fontSize:13}}>₹{fmt(p.taxable_amount)}</td>
                    <td style={{padding:'12px'}}>{p.total_gst>0?<span style={{background:'#FEF9C3',color:'#92400E',padding:'3px 9px',borderRadius:100,fontSize:11,fontWeight:700}}>₹{fmt(p.total_gst)}</span>:<span style={{color:'#94A3B8'}}>—</span>}</td>
                    <td style={{padding:'12px',fontWeight:800,color:'#D97706',fontSize:14}}>₹{fmt(p.total_amount)}</td>
                    <td style={{padding:'12px',color:'#059669',fontWeight:600,fontSize:13}}>₹{fmt(p.amount_paid)}</td>
                    <td style={{padding:'12px'}}>{(p.balance_due||0)>0?<span style={{color:'#DC2626',fontWeight:700,fontSize:13}}>₹{fmt(p.balance_due)}</span>:<span style={{color:'#059669',fontSize:12}}>✓ Paid</span>}</td>
                    <td style={{padding:'12px'}}><PayBadge type={p.payment_type}/></td>
                    <td style={{padding:'12px',color:'#94A3B8',fontSize:12}}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                    <td style={{padding:'12px'}}><button onClick={()=>handleDelete(p._id)} style={{background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,padding:'5px 9px',fontFamily:'DM Sans,sans-serif'}}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="show-xs" style={{flexDirection:'column',gap:12}}>
            {purchases.map((p,i)=>(
              <div key={p._id} style={{background:'#fff',borderRadius:14,padding:'16px',border:'1px solid #F1F5F9',borderLeft:`4px solid ${p.payment_type==='credit'?'#EF4444':'#F59E0B'}`,boxShadow:'0 2px 8px rgba(0,0,0,0.04)',animation:`fadeUp 0.3s ease ${i*0.04}s both`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:'#0F172A'}}>{p.items&&p.items.length>1?`${p.items.length} products`:p.product_name}</div>
                    <div style={{fontSize:11,color:'#D97706',fontWeight:700}}>{p.invoice_number}</div>
                    {p.supplier_name&&<div style={{fontSize:11,color:'#94A3B8'}}>से: {p.supplier_name}</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:800,color:'#D97706',fontSize:17}}>₹{fmt(p.total_amount)}</div>
                    <PayBadge type={p.payment_type}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:12,marginBottom:10,flexWrap:'wrap'}}>
                  {[{l:'TAXABLE',v:`₹${fmt(p.taxable_amount)}`,c:'#475569'},{l:'ITC',v:`₹${fmt(p.total_gst)}`,c:'#6366F1'},{l:'PAID',v:`₹${fmt(p.amount_paid)}`,c:'#059669'},{l:'DATE',v:new Date(p.createdAt).toLocaleDateString('en-IN'),c:'#475569'}].map(x=>(
                    <div key={x.l}><div style={{fontSize:10,color:'#94A3B8',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>{x.l}</div><div style={{fontWeight:700,fontSize:12,color:x.c}}>{x.v}</div></div>
                  ))}
                  {(p.balance_due||0)>0&&<div><div style={{fontSize:10,color:'#94A3B8',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>DUE</div><div style={{fontWeight:700,fontSize:12,color:'#DC2626'}}>₹{fmt(p.balance_due)}</div></div>}
                </div>
                <button onClick={()=>handleDelete(p._id)} style={{width:'100%',padding:'9px',background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>🗑️ Delete</button>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(6,13,26,0.75)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,animation:'fadeIn 0.2s ease'}}>
          <div style={{background:'#fff',borderRadius:18,padding:'24px',width:'100%',maxWidth:560,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',animation:'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
              <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#F59E0B,#D97706)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🛒</div>
              <div><div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:800,color:'#0F172A'}}>खरीद दर्ज करें</div><div style={{fontSize:12,color:'#94A3B8'}}>Record new purchase</div></div>
            </div>
            {error&&<div style={{background:'#FEF2F2',color:'#991B1B',border:'1px solid #FECACA',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:14}}>⚠️ {error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>🛒 Products</div>
                {items.map((item,index)=>{
                  const rowGST=calcRowGST(item);
                  return(
                    <div key={index} style={{background:'#F8FAFC',borderRadius:12,padding:14,marginBottom:10,border:'1px solid #F1F5F9'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                        <span style={{fontSize:12,fontWeight:700,color:'#64748B'}}>Item {index+1}</span>
                        {items.length>1&&<button type="button" onClick={()=>removeItem(index)} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>}
                      </div>
                      <div style={{marginBottom:10}}><label style={LS}>Product *</label><SearchableProductSelect products={products} value={item.product_id} onChange={(id)=>updateItem(index,'product_id',id)} placeholder="Product khojein..."/></div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <div><label style={LS}>Quantity *</label><input className="pi" style={IS} type="number" min="1" value={item.quantity} onChange={e=>updateItem(index,'quantity',e.target.value)} required/></div>
                        <div><label style={LS}>Purchase Price ₹ *</label><input className="pi" style={IS} type="number" step="0.01" value={item.price_per_unit} onChange={e=>updateItem(index,'price_per_unit',e.target.value)} required/></div>
                      </div>
                      {rowGST&&(
                        <div style={{fontSize:12,color:'#64748B',background:rowGST.gst_rate>0?'#FFFBEB':'#F0FDF4',borderRadius:8,padding:'7px 12px',display:'flex',gap:14,marginTop:8}}>
                          <span>Taxable: <strong>₹{rowGST.taxable.toFixed(2)}</strong></span>
                          {rowGST.gst_rate>0&&<span>GST {rowGST.gst_rate}%: <strong>₹{rowGST.gst.toFixed(2)}</strong></span>}
                          <span>Total: <strong>₹{rowGST.total.toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={addItem} style={{width:'100%',padding:'10px',background:'#fff',border:'2px dashed #E2E8F0',borderRadius:10,color:'#94A3B8',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>+ Add Another Product</button>
              </div>

              {billTotals.total>0&&(
                <div style={{background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)',border:'1px solid #FDE68A',borderRadius:12,padding:'14px',marginBottom:16}}>
                  <div style={{fontWeight:700,color:'#92400E',marginBottom:8,fontSize:13}}>📋 Bill Summary</div>
                  {[{l:'Subtotal',v:`₹${billTotals.taxable.toFixed(2)}`},{l:'GST (ITC)',v:`₹${billTotals.gst.toFixed(2)}`}].map(x=>(
                    <div key={x.l} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#B45309',marginBottom:4}}><span>{x.l}</span><strong>{x.v}</strong></div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:16,color:'#92400E',borderTop:'1px solid rgba(0,0,0,0.1)',paddingTop:6,marginTop:4}}><span>Grand Total</span><span>₹{billTotals.total.toFixed(2)}</span></div>
                  {form.payment_type==='credit'&&amountPaidNum>0&&<div style={{display:'flex',justifyContent:'space-between',color:'#DC2626',fontWeight:700,marginTop:4,fontSize:13}}><span>Balance Due:</span><span>₹{balanceDue.toFixed(2)}</span></div>}
                </div>
              )}

              <div style={{marginBottom:16}}>
                <label style={LS}>Payment Type *</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[{val:'cash',label:'💵 Cash',color:'#059669'},{val:'credit',label:'📒 Credit',color:'#EF4444'},{val:'upi',label:'📱 UPI',color:'#8B5CF6'},{val:'bank',label:'🏦 Bank',color:'#3B82F6'}].map(opt=>(
                    <button key={opt.val} type="button" onClick={()=>setForm({...form,payment_type:opt.val})}
                      style={{flex:1,minWidth:80,padding:'10px 4px',borderRadius:9,border:'2px solid',borderColor:form.payment_type===opt.val?opt.color:'#E2E8F0',background:form.payment_type===opt.val?opt.color:'#F8FAFC',color:form.payment_type===opt.val?'#fff':'#475569',cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'DM Sans,sans-serif',transition:'all 0.15s'}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.payment_type==='credit'&&(
                  <div style={{marginTop:10}}>
                    <label style={LS}>Advance Payment (optional)</label>
                    <input className="pi" style={IS} type="number" step="0.01" min="0" placeholder={`Max ₹${billTotals.total.toFixed(2)}`} value={form.amount_paid} onChange={e=>setForm({...form,amount_paid:e.target.value})}/>
                    <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'8px 12px',marginTop:6,fontSize:12,color:'#991B1B'}}>⚠️ बाकी ₹{balanceDue.toFixed(2)} supplier ledger में जाएगा</div>
                  </div>
                )}
              </div>

              <div style={{borderTop:'1px solid #F1F5F9',paddingTop:16,marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:form.payment_type==='credit'?'#EF4444':'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>
                  🏭 Supplier Details {form.payment_type==='credit'?'(जरूरी *)':'(optional)'}
                </div>
                <div style={{marginBottom:12}}><label style={LS}>Supplier Name {form.payment_type==='credit'&&<span style={{color:'#EF4444'}}>*</span>}</label><input className="pi" style={IS} placeholder="Supplier ka naam" value={form.supplier_name} onChange={e=>setForm({...form,supplier_name:e.target.value})} required={form.payment_type==='credit'}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div><label style={LS}>Phone</label><input className="pi" style={IS} placeholder="Mobile" value={form.supplier_phone} onChange={e=>setForm({...form,supplier_phone:e.target.value})}/></div>
                  <div><label style={LS}>GSTIN</label><input className="pi" style={IS} placeholder="Supplier GSTIN" value={form.supplier_gstin} onChange={e=>setForm({...form,supplier_gstin:e.target.value})}/></div>
                </div>
                {form.payment_type==='credit'&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div><label style={LS}>State</label>
                      <select className="pi" style={selStyle} value={form.supplier_state} onChange={e=>setForm({...form,supplier_state:e.target.value})}>
                        <option value="">Select State/UT</option>
                        <optgroup label="── States ──">{STATES.map(s=><option key={s} value={s}>{s}</option>)}</optgroup>
                        <optgroup label="── Union Territories ──">{UTS.map(s=><option key={s} value={s}>{s}</option>)}</optgroup>
                      </select>
                    </div>
                    <div><label style={LS}>Address</label><input className="pi" style={IS} placeholder="Supplier address" value={form.supplier_address} onChange={e=>setForm({...form,supplier_address:e.target.value})}/></div>
                  </div>
                )}
                <div><label style={LS}>Notes</label><input className="pi" style={IS} placeholder="Any notes..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
              </div>

              <div style={{display:'flex',gap:10}}>
                <button type="submit" disabled={submitting} style={{flex:1,padding:'13px',background:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif',boxShadow:'0 3px 12px rgba(245,158,11,0.3)'}}>
                  {submitting?'⏳...':form.payment_type==='credit'?'📒 Credit Purchase':'💵 Purchase दर्ज'}
                </button>
                <button type="button" onClick={resetModal} style={{flex:1,padding:'13px',background:'#F1F5F9',color:'#475569',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}