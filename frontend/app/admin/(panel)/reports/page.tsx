"use client";
import AdminTable from '@/components/admin/AdminTable';

import { useAdminData,AdminError } from '@/components/admin/useAdminData';
import { money } from '@/lib/format';

function pct(part:number,total:number){return total?Math.round(part/total*1000)/10:0}
function width(value:number,max:number){return max?Math.max(value?7:0,Math.round(value/max*100)):0}

export default function Reports(){
  const {data,error}=useAdminData<any>('/api/admin/reports',{orders:0,revenue:0,events:{},products:[]});
  if(error)return <AdminError message={error||'Unable to load reports'}/>;
  const e=data.events||{};
  const views=Number(e.ViewContent||0), carts=Number(e.AddToCart||0), checkout=Number(e.InitiateCheckout||0), orders=Number(data.orders||0);
  const steps=[
    {label:'Product views',value:views,rate:100,tone:'blue'},
    {label:'Add to cart',value:carts,rate:pct(carts,views),tone:'teal'},
    {label:'Checkout',value:checkout,rate:pct(checkout,carts),tone:'gold'},
    {label:'Orders',value:orders,rate:pct(orders,checkout),tone:'green'},
  ];
  return <>
    <div className="admin-title"><div><h1>Reports</h1><p>Sales, funnel and product conversion view for the last 30 days.</p></div></div>
    <div className="admin-kpis">
      <div className="admin-card"><small>Orders</small><strong>{orders}</strong><span>Last 30 days</span></div>
      <div className="admin-card"><small>Revenue</small><strong>{money(data.revenue)}</strong><span>Gross order value</span></div>
      <div className="admin-card"><small>Product views</small><strong>{views}</strong><span>Tracked ViewContent events</span></div>
      <div className="admin-card"><small>Add to cart</small><strong>{carts}</strong><span>{pct(carts,views).toFixed(1)}% of product views</span></div>
    </div>

    <section className="admin-section-card admin-funnel-card">
      <div className="admin-section-head"><div><h2>Conversion funnel</h2><p>Visual drop-off from product view to completed order.</p></div><span className="admin-funnel-period">Last 30 days</span></div>
      <div className="admin-funnel-steps">
        {steps.map((step,index)=><article className={`admin-funnel-step ${step.tone}`} key={step.label}>
          <div><small>{String(index+1).padStart(2,'0')}</small><b>{step.label}</b></div>
          <strong>{step.value}</strong>
          <span>{index===0?'Baseline':`${step.rate.toFixed(1)}% from previous step`}</span>
        </article>)}
      </div>
      <div className="admin-funnel-bars" aria-label="Conversion funnel graph">
        {steps.map((step,index)=><div className="admin-funnel-bar-row" key={step.label}>
          <span>{step.label}</span>
          <div><i className={step.tone} style={{width:`${width(step.value,views)}%`}}/></div>
          <b>{step.value}</b>
          <small>{index===0?'100%':`${step.rate.toFixed(1)}%`}</small>
        </div>)}
      </div>
    </section>

    <div className="admin-table-wrap" style={{marginTop:18}}>
      <AdminTable scrollLabel="Reports" className="admin-table"><thead><tr><th>Product</th><th>SKU</th><th>Views</th><th>Add to cart</th><th>View → cart</th><th>Orders</th><th>Order rate</th><th>Revenue</th></tr></thead><tbody>{(data.products||[]).map((p:any)=><tr key={p.sku}><td>{p.title}</td><td>{p.sku}</td><td>{p.views||0}</td><td>{p.carts||0}</td><td>{Number(p.viewToCart||0).toFixed(1)}%</td><td>{p.orders||0}</td><td>{Number(p.orderRate||0).toFixed(1)}%</td><td>{money(p.revenue)}</td></tr>)}</tbody></AdminTable>
    </div>
  </>;
}
