"use client";
import AdminTable from '@/components/admin/AdminTable';


import { useAdminData, AdminError } from "@/components/admin/useAdminData";
import { money } from "@/lib/format";

type CroData = {
  periodDays:number;views:number;addToCart:number;checkout:number;orders:number;revenue:number;
  viewToCart:number;cartToCheckout:number;checkoutToOrder:number;overallConversion:number;
  abandoned:number;recovered:number;recoveryRate:number;averageOrderValue:number;
  sources:Array<{source:string;orders:number;revenue:number;conversion?:number}>;
  opportunities:Array<{level:string;title:string;detail:string}>;
};
function pct(value:number){return `${Number(value||0).toFixed(1)}%`}
function barWidth(value:number,max:number){return max?Math.max(value?7:0,Math.round(value/max*100)):0}

export default function CroPage(){
  const {data,error}=useAdminData<CroData>("/api/admin/cro",{periodDays:30,views:0,addToCart:0,checkout:0,orders:0,revenue:0,viewToCart:0,cartToCheckout:0,checkoutToOrder:0,overallConversion:0,abandoned:0,recovered:0,recoveryRate:0,averageOrderValue:0,sources:[],opportunities:[]});
  if(error)return <AdminError message={error||"Unable to load CRO dashboard"}/>;
  const steps=[
    {label:'Product views',value:data.views,rate:100,tone:'blue'},
    {label:'Add to cart',value:data.addToCart,rate:data.viewToCart,tone:'teal'},
    {label:'Checkout',value:data.checkout,rate:data.cartToCheckout,tone:'gold'},
    {label:'Orders',value:data.orders,rate:data.checkoutToOrder,tone:'green'},
  ];
  return <>
    <div className="admin-title"><div><h1>CRO</h1><p>Conversion rate optimization — see where customers drop off and what to improve.</p></div></div>
    <div className="admin-kpis">
      <div className="admin-card"><small>Store conversion</small><strong>{pct(data.overallConversion)}</strong><span>{data.orders} orders / {data.views} product views</span></div>
      <div className="admin-card"><small>Checkout conversion</small><strong>{pct(data.checkoutToOrder)}</strong><span>{data.checkout} checkouts → {data.orders} orders</span></div>
      <div className="admin-card"><small>Average order value</small><strong>{money(data.averageOrderValue)}</strong><span>{money(data.revenue)} revenue</span></div>
      <div className="admin-card"><small>Recovery rate</small><strong>{pct(data.recoveryRate)}</strong><span>{data.recovered} recovered / {data.abandoned} abandoned</span></div>
    </div>

    <section className="admin-section-card admin-funnel-card">
      <div className="admin-section-head"><div><h2>30-day conversion funnel</h2><p>Where visitors continue and where they leave the buying journey.</p></div><span className="admin-funnel-period">{pct(data.overallConversion)} overall</span></div>
      <div className="admin-funnel-steps">
        {steps.map((step,index)=><article className={`admin-funnel-step ${step.tone}`} key={step.label}><div><small>{String(index+1).padStart(2,'0')}</small><b>{step.label}</b></div><strong>{step.value}</strong><span>{index===0?'100% baseline':`${Number(step.rate||0).toFixed(1)}% conversion`}</span></article>)}
      </div>
      <div className="admin-funnel-bars">
        {steps.map((step,index)=><div className="admin-funnel-bar-row" key={step.label}><span>{step.label}</span><div><i className={step.tone} style={{width:`${barWidth(step.value,data.views)}%`}}/></div><b>{step.value}</b><small>{index===0?'100%':pct(step.rate)}</small></div>)}
      </div>
    </section>

    <div className="admin-cro-grid">
      <section className="admin-section-card"><div className="admin-section-head"><div><h2>CRO opportunities</h2><p>Prioritized actions generated from the funnel.</p></div></div><div className="admin-opportunity-list">{(data.opportunities||[]).map((item,index)=><article className={`admin-opportunity ${item.level||'low'}`} key={`${item.title}-${index}`}><span>{String(index+1).padStart(2,'0')}</span><div><b>{item.title}</b><p>{item.detail}</p></div><em>{item.level}</em></article>)}{!data.opportunities?.length?<p className="admin-empty-copy">More traffic is needed before CRO recommendations can be generated.</p>:null}</div></section>
      <section className="admin-section-card"><div className="admin-section-head"><div><h2>Traffic source mix</h2><p>Orders and revenue by attributed source.</p></div></div><div className="admin-table-wrap"><AdminTable scrollLabel="Cro" className="admin-table"><thead><tr><th>Source</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>{(data.sources||[]).map(row=><tr key={row.source}><td style={{textTransform:'capitalize'}}>{row.source}</td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}{!data.sources?.length?<tr><td colSpan={3}>No attributed orders yet.</td></tr>:null}</tbody></AdminTable></div></section>
    </div>
  </>;
}
