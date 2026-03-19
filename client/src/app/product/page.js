'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';

const API = 'https://rakh-rakhaav.onrender.com';
const getToken = () => localStorage.getItem('token');

const IS = { width:'100%', padding:'12px 14px', border:'2px solid #E2E8F0', borderRadius:10, fontSize:14, color:'#0F172A', background:'#fff', outline:'none', fontFamily:'DM Sans,sans-serif', boxSizing:'border-box', transition:'border-color 0.2s,box-shadow 0.2s' };
const LS = { fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:7 };

export default function ProductsPage() {
  const router = useRouter();
  const [products,setProducts] = useState([]);
  const [filtered,setFiltered] = useState([]);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState('');
  const [search,setSearch]           = useState('');
  const [sortBy,setSortBy]           = useState('name');
  const [filterStock,setFilterStock] = useState('all');
  const [showModal,setShowModal]     = useState(false);
  const [editProduct,setEditProduct] = useState(null);
  const [form,setForm] = useState({name:'',description:'',price:'',cost_price:'',quantity:'',unit:'pcs',hsn_code:'',gst_rate:0,low_stock_threshold:5});
  const [showStockModal,setShowStockModal] = useState(false);
  const [stockProduct,setStockProduct]     = useState(null);
  const [stockForm,setStockForm] = useState({type:'manual_add',quantity:'',note:''});
  const [stockSubmitting,setStockSubmitting] = useState(false);
  const [showHistory,setShowHistory]         = useState(false);
  const [historyProduct,setHistoryProduct]   = useState(null);
  const [historyData,setHistoryData]         = useState([]);
  const [historyLoading,setHistoryLoading]   = useState(false);

  useEffect(()=>{ if(!localStorage.getItem('token')){router.push('/login');return;} fetchProducts(); },[]);

  useEffect(()=>{
    let r=[...products];
    if(search) r=r.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||(p.description&&p.description.toLowerCase().includes(search.toLowerCase())));
    if(filterStock==='low')     r=r.filter(p=>p.quantity>0&&p.is_low_stock);
    if(filterStock==='out')     r=r.filter(p=>p.quantity===0);
    if(filterStock==='instock') r=r.filter(p=>p.quantity>0&&!p.is_low_stock);
    if(sortBy==='name')         r.sort((a,b)=>a.name.localeCompare(b.name));
    if(sortBy==='price_asc')    r.sort((a,b)=>a.price-b.price);
    if(sortBy==='price_desc')   r.sort((a,b)=>b.price-a.price);
    if(sortBy==='quantity')     r.sort((a,b)=>a.quantity-b.quantity);
    if(sortBy==='margin')       r.sort((a,b)=>(b.margin||0)-(a.margin||0));
    setFiltered(r);
  },[search,sortBy,filterStock,products]);

  const fetchProducts=async()=>{
    try{
      const res=await fetch(`${API}/api/products`,{headers:{Authorization:`Bearer ${getToken()}`}});
      if(res.status===401){router.push('/login');return;}
      const data=await res.json();
      setProducts(Array.isArray(data)?data:data.products||[]);
    }catch{setError('उत्पाद लोड नहीं हो सके');}
    finally{setLoading(false);}
  };

  const openAdd=()=>{setEditProduct(null);setForm({name:'',description:'',price:'',cost_price:'',quantity:'',unit:'pcs',hsn_code:'',gst_rate:0,low_stock_threshold:5});setError('');setShowModal(true);};
  const openEdit=(p)=>{setEditProduct(p);setForm({name:p.name,description:p.description||'',price:p.price,cost_price:p.cost_price||'',quantity:p.quantity,unit:p.unit||'pcs',hsn_code:p.hsn_code||'',gst_rate:p.gst_rate||0,low_stock_threshold:p.low_stock_threshold||5});setError('');setShowModal(true);};

  const handleSubmit=async(e)=>{
    e.preventDefault();setError('');
    const url=editProduct?`${API}/api/products/${editProduct._id}`:`${API}/api/products`;
    try{
      const res=await fetch(url,{method:editProduct?'PUT':'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`},body:JSON.stringify(form)});
      const data=await res.json();
      if(res.ok){setShowModal(false);fetchProducts();}else setError(data.message||'सहेजने में विफल');
    }catch{setError('Server error');}
  };

  const handleDelete=async(id)=>{
    if(!confirm('इस उत्पाद को हटाएं?'))return;
    try{
      const res=await fetch(`${API}/api/products/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${getToken()}`}});
      if(res.ok)fetchProducts();else{const d=await res.json();setError(d.message||'हटाने में विफल');}
    }catch{setError('Server error');}
  };

  const openStockAdjust=(p)=>{setStockProduct(p);setStockForm({type:'manual_add',quantity:'',note:''});setError('');setShowStockModal(true);};

  const handleStockAdjust=async(e)=>{
    e.preventDefault();setError('');setStockSubmitting(true);
    try{
      const res=await fetch(`${API}/api/products/${stockProduct._id}/adjust-stock`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`},body:JSON.stringify(stockForm)});
      const data=await res.json();
      if(res.ok){setShowStockModal(false);fetchProducts();}else setError(data.message||'Stock update failed');
    }catch{setError('Server error');}
    setStockSubmitting(false);
  };

  const openHistory=async(p)=>{
    setHistoryProduct(p);setShowHistory(true);setHistoryLoading(true);
    try{
      const res=await fetch(`${API}/api/products/${p._id}/stock-history`,{headers:{Authorization:`Bearer ${getToken()}`}});
      const data=await res.json();setHistoryData(data.history||[]);
    }catch{}
    setHistoryLoading(false);
  };

  const lowStockCount=products.filter(p=>p.is_low_stock&&p.quantity>0).length;
  const outOfStockCount=products.filter(p=>p.quantity===0).length;
  const totalValue=products.reduce((s,p)=>s+(p.cost_price||0)*p.quantity,0);

  const SBadge=({p})=>{
    if(p.quantity===0) return <span style={{background:'#FEE2E2',color:'#991B1B',padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:700}}>खत्म</span>;
    if(p.is_low_stock) return <span style={{background:'#FEF9C3',color:'#854D0E',padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:700}}>कम ({p.quantity})</span>;
    return <span style={{background:'#DCFCE7',color:'#166534',padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:700}}>✓ Stock</span>;
  };
  const MBadge=({margin})=>{
    if(margin===null||margin===undefined) return <span style={{color:'#94A3B8',fontSize:12}}>—</span>;
    const c=margin>=30?'#166534':margin>=15?'#854D0E':'#991B1B';
    const b=margin>=30?'#DCFCE7':margin>=15?'#FEF9C3':'#FEE2E2';
    return <span style={{background:b,color:c,padding:'3px 9px',borderRadius:100,fontSize:11,fontWeight:700}}>{margin}%</span>;
  };
  const histLabel=(t)=>({purchase:'🛒 Purchase',sale:'💰 Sale',manual_add:'➕ Added',manual_remove:'➖ Removed',adjustment:'🔧 Adjusted'}[t]||t);

  const Overlay=({children})=>(
    <div style={{position:'fixed',inset:0,background:'rgba(6,13,26,0.75)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,animation:'fadeIn 0.2s ease'}}>
      <div style={{background:'#fff',borderRadius:18,padding:'24px',width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',animation:'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
        {children}
      </div>
    </div>
  );

  const selStyle={...IS,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%2394A3B8' d='M5 6L0 0h10z'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:32,appearance:'none'};

  return (
    <Layout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .pi:focus{border-color:#059669!important;box-shadow:0 0 0 3px rgba(5,150,105,0.08)!important;}
        .prow:hover{background:#F8FAFC!important;}
        .abtn{background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:700;font-size:11px;padding:5px 9px;border-radius:7px;transition:all 0.15s;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.9) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);}}
        @media(max-width:640px){.hidden-xs{display:none!important;}.show-xs{display:flex!important;}.pf{flex-direction:column!important;}}
        @media(min-width:641px){.show-xs{display:none!important;}}
      `}</style>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:26,fontWeight:800,color:'#0F172A',letterSpacing:'-0.5px',marginBottom:5}}>उत्पाद / Products 📦</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#94A3B8'}}>{products.length} products</span>
            {lowStockCount>0&&<span style={{fontSize:11,color:'#D97706',fontWeight:700,background:'#FEF9C3',padding:'2px 10px',borderRadius:20}}>⚠️ {lowStockCount} low</span>}
            {outOfStockCount>0&&<span style={{fontSize:11,color:'#DC2626',fontWeight:700,background:'#FEE2E2',padding:'2px 10px',borderRadius:20}}>🔴 {outOfStockCount} out</span>}
            <span style={{fontSize:12,color:'#64748B'}}>Value: <strong style={{color:'#0F172A'}}>₹{totalValue.toFixed(0)}</strong></span>
          </div>
        </div>
        <button onClick={openAdd} style={{padding:'10px 20px',background:'linear-gradient(135deg,#6366F1,#4F46E5)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif',boxShadow:'0 3px 12px rgba(99,102,241,0.3)',transition:'all 0.2s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>+ Add Product</button>
      </div>

      {/* Filters */}
      <div className="pf" style={{background:'#fff',borderRadius:14,padding:'14px 16px',border:'1px solid #F1F5F9',boxShadow:'0 2px 8px rgba(0,0,0,0.04)',marginBottom:16,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:180}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#94A3B8'}}>🔍</span>
          <input className="pi" style={{...IS,paddingLeft:36}} placeholder="उत्पाद खोजें..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="pi" style={{...selStyle,minWidth:130}} value={filterStock} onChange={e=>setFilterStock(e.target.value)}>
          <option value="all">सभी / All</option>
          <option value="instock">✅ In Stock</option>
          <option value="low">⚠️ Low Stock</option>
          <option value="out">🔴 Out of Stock</option>
        </select>
        <select className="pi" style={{...selStyle,minWidth:130}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="name">नाम से</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="quantity">Qty ↑</option>
          <option value="margin">Margin ↓</option>
        </select>
        {(search||filterStock!=='all')&&<button onClick={()=>{setSearch('');setFilterStock('all');}} style={{color:'#DC2626',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,padding:'6px 12px',fontFamily:'DM Sans,sans-serif'}}>Clear ✕</button>}
      </div>

      {error&&!showModal&&!showStockModal&&<div style={{background:'#FEF2F2',color:'#991B1B',border:'1px solid #FECACA',padding:'12px 16px',borderRadius:10,marginBottom:16,fontSize:13,display:'flex',gap:8}}>⚠️ {error}</div>}

      {loading?(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:80,gap:12}}>
          <div style={{width:36,height:36,border:'3px solid #E2E8F0',borderTopColor:'#6366F1',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
          <div style={{color:'#94A3B8',fontSize:14}}>लोड हो रहा है...</div>
        </div>
      ):filtered.length===0?(
        <div style={{background:'#fff',borderRadius:16,padding:'60px 20px',textAlign:'center',border:'1px solid #F1F5F9'}}>
          <div style={{fontSize:48,marginBottom:12}}>📦</div>
          <div style={{fontWeight:700,fontSize:16,color:'#475569',marginBottom:4}}>{search||filterStock!=='all'?'कोई उत्पाद नहीं मिला':'अभी कोई उत्पाद नहीं'}</div>
          <div style={{fontSize:13,color:'#94A3B8'}}>Add Product से शुरू करें</div>
        </div>
      ):(
        <>
          {/* Desktop Table */}
          <div className="hidden-xs" style={{background:'#fff',borderRadius:16,border:'1px solid #F1F5F9',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.05)',animation:'fadeUp 0.4s ease both'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'linear-gradient(135deg,#060D1A,#0B1D35)'}}>
                  {['Name','Cost','Price','Margin','GST','Qty','Status','Actions'].map(h=>(
                    <th key={h} style={{padding:'13px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.55)',textTransform:'uppercase',letterSpacing:0.8,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i)=>(
                  <tr key={p._id} className="prow" style={{background:p.quantity===0?'#FFFBEB':'#fff',borderBottom:'1px solid #F8FAFC',transition:'background 0.15s',animation:`fadeUp 0.3s ease ${i*0.03}s both`}}>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{fontWeight:700,color:'#0F172A',fontSize:13}}>{p.name}</div>
                      <div style={{color:'#94A3B8',fontSize:11,marginTop:1}}>{p.hsn_code?`HSN:${p.hsn_code}`:''}{p.unit?` · ${p.unit}`:''}</div>
                    </td>
                    <td style={{padding:'12px 14px',color:'#64748B',fontSize:13}}>{p.cost_price?`₹${p.cost_price}`:'—'}</td>
                    <td style={{padding:'12px 14px',fontWeight:700,color:'#0F172A',fontSize:14}}>₹{p.price}</td>
                    <td style={{padding:'12px 14px'}}><MBadge margin={p.margin}/></td>
                    <td style={{padding:'12px 14px'}}>{p.gst_rate?<span style={{background:'#EDE9FE',color:'#6D28D9',padding:'3px 9px',borderRadius:100,fontSize:11,fontWeight:700}}>{p.gst_rate}%</span>:<span style={{color:'#94A3B8',fontSize:12}}>—</span>}</td>
                    <td style={{padding:'12px 14px',fontWeight:700,fontSize:14,color:p.quantity===0?'#DC2626':p.is_low_stock?'#D97706':'#0F172A'}}>{p.quantity} {p.unit||''}</td>
                    <td style={{padding:'12px 14px'}}><SBadge p={p}/></td>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{display:'flex',gap:4}}>
                        <button className="abtn" onClick={()=>openStockAdjust(p)} style={{color:'#059669',background:'#F0FDF4'}}>📦</button>
                        <button className="abtn" onClick={()=>openHistory(p)} style={{color:'#6366F1',background:'#EEF2FF'}}>📋</button>
                        <button className="abtn" onClick={()=>openEdit(p)} style={{color:'#D97706',background:'#FFFBEB'}}>✏️</button>
                        <button className="abtn" onClick={()=>handleDelete(p._id)} style={{color:'#DC2626',background:'#FEF2F2'}}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="show-xs" style={{flexDirection:'column',gap:12}}>
            {filtered.map((p,i)=>(
              <div key={p._id} style={{background:'#fff',borderRadius:14,padding:'16px',border:'1px solid #F1F5F9',borderLeft:`4px solid ${p.quantity===0?'#EF4444':p.is_low_stock?'#F59E0B':'#10B981'}`,boxShadow:'0 2px 8px rgba(0,0,0,0.04)',animation:`fadeUp 0.3s ease ${i*0.04}s both`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15,color:'#0F172A'}}>{p.name}</div>
                    <div style={{color:'#94A3B8',fontSize:11,marginTop:2}}>{p.description||(p.unit?`Unit: ${p.unit}`:'')}</div>
                  </div>
                  <SBadge p={p}/>
                </div>
                <div style={{display:'flex',gap:14,marginBottom:12,flexWrap:'wrap'}}>
                  {[{l:'COST',v:p.cost_price?`₹${p.cost_price}`:'—',c:'#64748B'},{l:'PRICE',v:`₹${p.price}`,c:'#0F172A'},{l:'QTY',v:`${p.quantity}`,c:p.quantity===0?'#DC2626':p.is_low_stock?'#D97706':'#0F172A'},{l:'GST',v:p.gst_rate?`${p.gst_rate}%`:'—',c:'#6D28D9'}].map(x=>(
                    <div key={x.l}><div style={{fontSize:10,color:'#94A3B8',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>{x.l}</div><div style={{fontWeight:700,fontSize:13,color:x.c}}>{x.v}</div></div>
                  ))}
                  <div><div style={{fontSize:10,color:'#94A3B8',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>MARGIN</div><MBadge margin={p.margin}/></div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[{l:'📦 Stock',f:()=>openStockAdjust(p),bg:'#F0FDF4',c:'#059669'},{l:'📋',f:()=>openHistory(p),bg:'#EEF2FF',c:'#6366F1'},{l:'✏️ Edit',f:()=>openEdit(p),bg:'#FFFBEB',c:'#D97706'},{l:'🗑️',f:()=>handleDelete(p._id),bg:'#FEF2F2',c:'#DC2626'}].map(b=>(
                    <button key={b.l} onClick={b.f} style={{flex:1,padding:'8px 4px',background:b.bg,color:b.c,border:'none',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>{b.l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal&&(
        <Overlay>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
            <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#6366F1,#4F46E5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{editProduct?'✏️':'📦'}</div>
            <div><div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:800,color:'#0F172A'}}>{editProduct?'Edit Product':'Add Product'}</div><div style={{fontSize:12,color:'#94A3B8'}}>{editProduct?'Update details':'Add to inventory'}</div></div>
          </div>
          {error&&<div style={{background:'#FEF2F2',color:'#991B1B',border:'1px solid #FECACA',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:14}}>⚠️ {error}</div>}
          <form onSubmit={handleSubmit}>
            {[{label:'Name *',key:'name',req:true},{label:'Description',key:'description'}].map(f=>(
              <div key={f.key} style={{marginBottom:14}}><label style={LS}>{f.label}</label><input className="pi" style={IS} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} required={f.req}/></div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div><label style={LS}>Cost Price ₹</label><input className="pi" style={IS} type="number" step="0.01" value={form.cost_price} onChange={e=>setForm({...form,cost_price:e.target.value})}/></div>
              <div><label style={LS}>Selling Price ₹ *</label><input className="pi" style={IS} type="number" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/></div>
            </div>
            {form.cost_price&&form.price&&Number(form.cost_price)>0&&(
              <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13}}>
                Margin: <strong style={{color:'#059669',fontSize:15}}>{(((Number(form.price)-Number(form.cost_price))/Number(form.cost_price))*100).toFixed(1)}%</strong>
                <span style={{color:'#94A3B8',marginLeft:8}}>₹{(Number(form.price)-Number(form.cost_price)).toFixed(2)}/unit</span>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div><label style={LS}>{editProduct?'Quantity':'Opening Stock *'}</label><input className="pi" style={IS} type="number" min="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} required={!editProduct}/></div>
              <div><label style={LS}>Unit</label><input className="pi" style={IS} placeholder="kg,pcs,box..." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div><label style={LS}>HSN Code</label><input className="pi" style={IS} placeholder="8471" value={form.hsn_code} onChange={e=>setForm({...form,hsn_code:e.target.value})}/></div>
              <div><label style={LS}>GST Rate</label>
                <select className="pi" style={{...selStyle}} value={form.gst_rate} onChange={e=>setForm({...form,gst_rate:parseInt(e.target.value)})}>
                  {[0,5,12,18,28].map(r=><option key={r} value={r}>{r}% {r===0?'— No GST':''}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:16}}><label style={LS}>⚠️ Low Stock Alert (≤)</label><input className="pi" style={IS} type="number" min="0" value={form.low_stock_threshold} onChange={e=>setForm({...form,low_stock_threshold:e.target.value})}/></div>
            {form.price&&form.gst_rate>0&&(
              <div style={{background:'#EDE9FE',border:'1px solid #C4B5FD',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13}}>
                <strong style={{color:'#6D28D9'}}>GST Preview:</strong> ₹{parseFloat(form.price||0).toFixed(2)} + {form.gst_rate}% = <strong>₹{(parseFloat(form.price||0)*(1+form.gst_rate/100)).toFixed(2)}</strong>
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button type="submit" style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#6366F1,#4F46E5)',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>{editProduct?'✅ Update':'➕ Add Product'}</button>
              <button type="button" onClick={()=>setShowModal(false)} style={{flex:1,padding:'12px',background:'#F1F5F9',color:'#475569',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Cancel</button>
            </div>
          </form>
        </Overlay>
      )}

      {/* Stock Modal */}
      {showStockModal&&stockProduct&&(
        <Overlay>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#059669,#047857)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📦</div>
            <div><div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:800,color:'#0F172A'}}>Stock Adjust</div><div style={{fontSize:12,color:'#94A3B8'}}>{stockProduct.name} — Current: <strong>{stockProduct.quantity}</strong></div></div>
          </div>
          {error&&<div style={{background:'#FEF2F2',color:'#991B1B',border:'1px solid #FECACA',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:12}}>⚠️ {error}</div>}
          <form onSubmit={handleStockAdjust}>
            <div style={{marginBottom:14}}>
              <label style={LS}>Type</label>
              <div style={{display:'flex',gap:8}}>
                {[{v:'manual_add',l:'➕ Add',c:'#059669',bg:'#F0FDF4'},{v:'manual_remove',l:'➖ Remove',c:'#DC2626',bg:'#FEF2F2'},{v:'adjustment',l:'🔧 Fix',c:'#6366F1',bg:'#EEF2FF'}].map(o=>(
                  <button key={o.v} type="button" onClick={()=>setStockForm({...stockForm,type:o.v})}
                    style={{flex:1,padding:'10px 4px',borderRadius:8,border:`2px solid ${stockForm.type===o.v?o.c:'#E2E8F0'}`,background:stockForm.type===o.v?o.bg:'#F8FAFC',color:stockForm.type===o.v?o.c:'#64748B',cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'DM Sans,sans-serif',transition:'all 0.15s'}}>{o.l}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={LS}>Quantity *</label>
              <input className="pi" style={IS} type="number" min="1" placeholder="How many?" value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})} required/>
              {stockForm.quantity&&<div style={{fontSize:12,color:'#64748B',marginTop:6,background:'#F8FAFC',padding:'6px 10px',borderRadius:8}}>New stock: <strong style={{color:'#0F172A'}}>{stockForm.type==='manual_remove'?Math.max(0,stockProduct.quantity-Number(stockForm.quantity)):stockProduct.quantity+Number(stockForm.quantity)} {stockProduct.unit||'pcs'}</strong></div>}
            </div>
            <div style={{marginBottom:16}}><label style={LS}>Note</label><input className="pi" style={IS} placeholder="Reason..." value={stockForm.note} onChange={e=>setStockForm({...stockForm,note:e.target.value})}/></div>
            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={stockSubmitting} style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#059669,#047857)',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>{stockSubmitting?'⏳...':'✅ Update Stock'}</button>
              <button type="button" onClick={()=>{setShowStockModal(false);setError('');}} style={{flex:1,padding:'12px',background:'#F1F5F9',color:'#475569',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Cancel</button>
            </div>
          </form>
        </Overlay>
      )}

      {/* History Modal */}
      {showHistory&&historyProduct&&(
        <div style={{position:'fixed',inset:0,background:'rgba(6,13,26,0.75)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,animation:'fadeIn 0.2s ease'}}>
          <div style={{background:'#fff',borderRadius:18,padding:'24px',width:'100%',maxWidth:520,maxHeight:'85vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',animation:'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div><div style={{fontFamily:'Playfair Display,serif',fontSize:17,fontWeight:800,color:'#0F172A',marginBottom:2}}>📋 Stock History</div><div style={{fontSize:12,color:'#94A3B8'}}>{historyProduct.name} — {historyProduct.quantity} units</div></div>
              <button onClick={()=>setShowHistory(false)} style={{width:32,height:32,borderRadius:8,background:'#F1F5F9',border:'none',cursor:'pointer',fontSize:14}}>✕</button>
            </div>
            {historyLoading?<div style={{textAlign:'center',color:'#94A3B8',padding:30}}>⏳ Loading...</div>:historyData.length===0?<div style={{textAlign:'center',color:'#94A3B8',padding:30}}>कोई history नहीं</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {historyData.map((h,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',background:'#F8FAFC',borderRadius:10,borderLeft:`3px solid ${h.quantity_change>0?'#10B981':'#EF4444'}`}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:'#374151'}}>{histLabel(h.type)}</div>
                      <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{new Date(h.date).toLocaleDateString('en-IN')} · {h.note||'—'}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:800,fontSize:15,color:h.quantity_change>0?'#10B981':'#EF4444'}}>{h.quantity_change>0?'+':''}{h.quantity_change}</div>
                      <div style={{fontSize:11,color:'#94A3B8'}}>→ {h.quantity_after}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}