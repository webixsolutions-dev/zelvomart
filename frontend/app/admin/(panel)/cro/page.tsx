"use client";

import { useAdminData, AdminError } from "@/components/admin/useAdminData";
import { money } from "@/lib/format";

type CroData = {
  periodDays:number;
  views:number;
  addToCart:number;
  checkout:number;
  orders:number;
  revenue:number;
  viewToCart:number;
  cartToCheckout:number;
  checkoutToOrder:number;
  overallConversion:number;
  abandoned:number;
  recovered:number;
  recoveryRate:number;
  averageOrderValue:number;
  sources:Array<{source:string;orders:number;revenue:number;conversion?:number}>;
  opportunities:Array<{level:string;title:string;detail:string}>;
};

function pct(value:number){ return `${Number(value||0).toFixed(1)}%`; }

export default function CroPage(){
  const {data,error}=useAdminData<CroData>("/api/admin/cro",{
    periodDays:30,views:0,addToCart:0,checkout:0,orders:0,revenue:0,viewToCart:0,cartToCheckout:0,checkoutToOrder:0,overallConversion:0,abandoned:0,recovered:0,recoveryRate:0,averageOrderValue:0,sources:[],opportunities:[]
  });
  if(error) return <AdminError message={error||"Unable to load CRO dashboard"}/>;

  return <>
    <div className="admin-title"><div><h1>CRO</h1><p>Conversion rate optimization — see where customers drop off and what to improve.</p></div></div>

    <div className="admin-kpis">
      <div className="admin-card"><small>Store conversion</small><strong>{pct(data.overallConversion)}</strong><span>{data.orders} orders / {data.views} product views</span></div>
      <div className="admin-card"><small>Checkout conversion</small><strong>{pct(data.checkoutToOrder)}</strong><span>{data.checkout} checkouts → {data.orders} orders</span></div>
      <div className="admin-card"><small>Average order value</small><strong>{money(data.averageOrderValue)}</strong><span>{money(data.revenue)} revenue</span></div>
      <div className="admin-card"><small>Recovery rate</small><strong>{pct(data.recoveryRate)}</strong><span>{data.recovered} recovered / {data.abandoned} abandoned</span></div>
    </div>

    <div className="admin-card" style={{marginBottom:18}}>
      <h2>30-day conversion funnel</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:14}}>
        <div><small>Product views</small><strong style={{display:"block",fontSize:22}}>{data.views}</strong><span>100%</span></div>
        <div><small>Add to cart</small><strong style={{display:"block",fontSize:22}}>{data.addToCart}</strong><span>{pct(data.viewToCart)} of views</span></div>
        <div><small>Checkout</small><strong style={{display:"block",fontSize:22}}>{data.checkout}</strong><span>{pct(data.cartToCheckout)} of carts</span></div>
        <div><small>Orders</small><strong style={{display:"block",fontSize:22}}>{data.orders}</strong><span>{pct(data.checkoutToOrder)} of checkouts</span></div>
      </div>
    </div>

    <div className="admin-card" style={{marginBottom:18}}>
      <h2>CRO opportunities</h2>
      <div style={{display:"grid",gap:10,marginTop:12}}>
        {(data.opportunities||[]).map((item,index)=><div key={`${item.title}-${index}`} style={{border:"1px solid var(--border)",borderRadius:10,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{item.title}</strong><span style={{textTransform:"uppercase",fontSize:10,fontWeight:800}}>{item.level}</span></div>
          <p style={{margin:"6px 0 0",fontSize:12,color:"var(--slate)"}}>{item.detail}</p>
        </div>)}
        {!data.opportunities?.length ? <p style={{fontSize:12,color:"var(--slate)"}}>More traffic is needed before CRO recommendations can be generated.</p> : null}
      </div>
    </div>

    <div className="admin-table-wrap">
      <table className="admin-table"><thead><tr><th>Traffic source</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>
        {(data.sources||[]).map((row)=><tr key={row.source}><td style={{textTransform:"capitalize"}}>{row.source}</td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}
        {!data.sources?.length ? <tr><td colSpan={3}>No attributed orders yet.</td></tr> : null}
      </tbody></table>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <h2>How to use CRO</h2>
      <p style={{marginTop:8,fontSize:12,lineHeight:1.7}}>Use this page to spot the weakest step in the funnel. Create an A/B test in <b>Experiments</b>, change one thing at a time (CTA text, product page layout, trust badges, checkout fields or offer), then compare the conversion rate before rolling the winner out permanently.</p>
    </div>
  </>;
}
