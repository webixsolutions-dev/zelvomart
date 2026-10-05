"use client";
import { useParams,useSearchParams } from 'next/navigation';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';
import { money } from '@/lib/format';

export default function OrderPrint(){
  const {id}=useParams<{id:string}>();const search=useSearchParams();const type=search.get('type')==='packing'?'packing':'invoice';
  const {data:o,loading,error}=useAdminData<any>(`/api/admin/orders/${id}`,null);
  if(loading)return <AdminLoading/>;if(error||!o)return <AdminError message={error||'Order not found'}/>;
  return <div className="admin-print-sheet">
    <div className="admin-print-actions"><button className="admin-btn admin-btn-primary" onClick={()=>window.print()}>Print</button></div>
    <header><div className="admin-print-brand"><img src="/images/zelvomart-logo.png" alt="Zelvomart" /><span>{type==='packing'?'PACKING SLIP':'CUSTOMER INVOICE'}</span></div><div><strong>{o.orderNumber}</strong><small>{new Date(o.createdAt).toLocaleString('en-PK')}</small></div></header>
    <section className="admin-print-meta"><div><span>Customer</span><b>{o.fullName}</b><p>{o.phone}<br/>{o.email||''}</p></div><div><span>Delivery</span><b>{o.city}</b><p>{o.address}<br/>{o.postcode||''}</p></div><div><span>Status</span><b>{String(o.status).replace(/_/g,' ')}</b><p>{o.postexTracking?`PostEx: ${o.postexTracking}`:'Tracking pending'}</p></div></section>
    <table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th>{type==='invoice'?<><th>Unit</th><th>Total</th></>:null}</tr></thead><tbody>{o.items.map((i:any)=><tr key={i.id}><td>{i.title}{i.variantLabel?` — ${i.variantLabel}`:''}</td><td>{i.sku}</td><td>{i.quantity}</td>{type==='invoice'?<><td>{money(i.unitPrice)}</td><td>{money(i.lineTotal)}</td></>:null}</tr>)}</tbody></table>
    {type==='invoice'?<div className="admin-print-totals"><p><span>Subtotal</span><b>{money(o.subtotal)}</b></p>{Number(o.bundleSaving)>0?<p><span>Bundle saving</span><b>-{money(o.bundleSaving)}</b></p>:null}<p><span>Delivery</span><b>{Number(o.deliveryFee)?money(o.deliveryFee):'Free'}</b></p>{Number(o.codFee)>0?<p><span>COD fee</span><b>{money(o.codFee)}</b></p>:null}<p className="total"><span>Total</span><b>{money(o.total)}</b></p><small>Payment method: Cash on Delivery</small></div>:<div className="admin-print-note">Packing check: correct item • correct quantity • product inspected • parcel sealed.</div>}
  </div>;
}
