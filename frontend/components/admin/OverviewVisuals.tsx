import {useId} from 'react';
import Link from 'next/link';
import {money} from '@/lib/format';

export function OverviewIcon({name,className=''}:{name:string;className?:string}){
 const paths:Record<string,React.ReactNode>={
  orders:<><rect x="5" y="5" width="14" height="16" rx="3"/><path d="M9 5V3h6v2M9 10h6M9 14h4"/></>,
  revenue:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></>,
  aov:<><path d="m3 10 8-7h9v9l-8 8Z"/><circle cx="16" cy="7" r="1"/></>,
  conversion:<><path d="M4 20V11M10 20V7M16 20V3M3 5l5-2M21 20H3"/></>,
  deliveredRate:<><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7Z"/><path d="m8 12 3 3 5-6"/></>,
  waiting:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  sales:<><path d="M3 3v17h18M7 14l4-4 4 2 5-7"/></>,
  funnel:<><path d="M3 4h18l-7 8v7l-4 2v-9Z"/></>,
  sources:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18"/></>,
  products:<><path d="m12 3 9 5-9 5-9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7 5l9 5"/></>,
  recovery:<><path d="M3 4v6h6M3 10a9 9 0 1 1 2 8"/></>,
  health:<><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  tips:<><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9Z"/></>,
  ads:<><path d="m3 10 16-6v16L3 14ZM7 15l2 6h3M21 9v6"/></>,
  arrow:<><path d="M5 12h14m-5-5 5 5-5 5"/></>,
 };
 return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.orders}</svg>;
}

export const overviewSections:Record<string,{description:string;tag:string}>={
 kpis:{description:'A clear view of your store’s performance.',tag:'Overview'},
 sales:{description:'Track daily sales and keep orders moving.',tag:'Sales analytics'},
 funnel:{description:'See where shoppers leave. Select a step to explore recordings.',tag:'Customer journey'},
 sources:{description:'Understand which channels bring customers to your store.',tag:'Acquisition'},
 ads:{description:'Advertising spend and purchase performance.',tag:'Marketing'},
 products:{description:'Your catalog’s views, cart activity and sales.',tag:'Catalog performance'},
 recovery:{description:'Turn missed checkouts into new orders.',tag:'Cart recovery'},
 health:{description:'Keep your integrations and background jobs in check.',tag:'System status'},
 tips:{description:'Practical opportunities based on your store’s activity.',tag:'Recommended actions'},
};

export function OverviewMetrics({data}:{data:any}){
 const metrics=[['Orders','orders','All orders in this period'],['Revenue','revenue','Sales after cancellations and returns'],['Average order value','aov','Revenue per order'],['Conversion rate','conversion','Orders per unique visitor'],['Delivery performance','deliveredRate','Delivered and returned orders'],['Awaiting confirmation','waiting','New orders ready for your team']];
 return <div className="overview-kpis overview-primary-metrics">{metrics.map(([label,key,caption])=>{
  const current=Number(data.current[key]||0),previous=Number(data.previous[key]||0),change=previous?(current-previous)/previous*100:null;
  const direction=current>previous?'up':current<previous?'down':'flat';
  return <article className={`overview-metric metric-${key}`} key={key}>
   <div className="overview-metric-top"><span>{label}</span><span className="overview-metric-icon"><OverviewIcon name={key}/></span></div>
   {key==='deliveredRate'?<div className="overview-delivery-values"><div><strong>{current.toFixed(1)}<small>%</small></strong><span><i/>Delivered</span></div><div><strong>{Number(data.current.returnedRate||0).toFixed(1)}<small>%</small></strong><span><i/>Returned</span></div></div>:<strong className="overview-metric-value">{key==='revenue'||key==='aov'?money(current):key==='conversion'?current.toFixed(1)+'%':current.toLocaleString('en-PK')}</strong>}
   <p className="overview-metric-caption">{caption}</p>
   <div className="overview-metric-footer"><span className={`overview-delta delta-${direction}`}>{direction==='up'?'↗':direction==='down'?'↘':'—'} {change===null?current?'New activity':'No change':`${Math.abs(change).toFixed(1)}%`}</span><span>vs. previous period</span></div>
  </article>;
 })}</div>;
}

export function OverviewSalesChart({days}:{days:{day:string;orders:number;revenue:number}[]}){
 const id=useId().replace(/:/g,'');
 const total=days.reduce((n,d)=>n+d.revenue,0),orders=days.reduce((n,d)=>n+d.orders,0);
 const orderMax=Math.max(1,...days.map(d=>d.orders)),revenueMax=Math.max(1,...days.map(d=>d.revenue));
 const x=(i:number)=>62+(i+.5)*660/Math.max(1,days.length),y=(n:number,max:number)=>222-n/max*174;
 const points=days.map((d,i)=>`${x(i)},${y(d.revenue,revenueMax)}`).join(' ');
 return <div className="overview-chart-block">
  <div className="overview-chart-summary"><div><span>Total revenue</span><strong>{money(total)}</strong><small>{orders.toLocaleString()} orders in this period</small></div><div className="overview-chart-legend"><span><i/>Orders</span><span><i/>Revenue</span></div></div>
  <div className={`overview-chart-canvas${!days.length?' is-empty':''}`}>
   <svg viewBox="0 0 800 270" role="img" aria-label="Daily orders and revenue. Orders use the left axis; revenue in PKR uses the right axis.">
    <defs><linearGradient id={'revenue-'+id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b89a" stopOpacity=".15"/><stop offset="100%" stopColor="#14b89a" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(t=><g key={t}><line x1="55" x2="735" y1={y(t,1)} y2={y(t,1)} stroke="#e9eef5" strokeDasharray="4 5"/>{days.length>0&&<><text x="42" y={y(t,1)+4} textAnchor="end">{Math.ceil(orderMax*t)}</text><text x="745" y={y(t,1)+4}>{Math.round(revenueMax*t).toLocaleString()}</text></>}</g>)}
    {days.length>1&&<polygon points={`${x(0)},222 ${points} ${x(days.length-1)},222`} fill={`url(#revenue-${id})`}/>}
    {days.map((d,i)=><rect key={d.day} x={x(i)-Math.min(12,220/days.length)} y={y(d.orders,orderMax)} height={222-y(d.orders,orderMax)} width={Math.min(24,440/days.length)} rx="4" fill="#3c83f6"><title>{d.day}: {d.orders} orders · {money(d.revenue)}</title></rect>)}
    <polyline points={points} fill="none" stroke="#12ad8e" strokeWidth="2.5" strokeLinejoin="round"/>
    {days.map((d,i)=><g key={d.day}><circle cx={x(i)} cy={y(d.revenue,revenueMax)} r={days.length>35?2:3.5} fill="#fff" stroke="#12ad8e" strokeWidth="2"><title>{d.day}: {money(d.revenue)}</title></circle>{(days.length<7||i%Math.ceil(days.length/6)===0||i===days.length-1)&&<text x={x(i)} y="250" textAnchor="middle">{new Date(d.day+'T12:00:00Z').toLocaleDateString('en-PK',{month:'short',day:'numeric'})}</text>}</g>)}
   </svg>
   {!days.length&&<div className="overview-chart-empty"><span><OverviewIcon name="sales"/></span><strong>Your sales story starts here</strong><p>Sales will appear here when orders arrive.</p><Link href="/admin/orders">View orders <OverviewIcon name="arrow"/></Link></div>}
  </div>
  <div className="overview-chart-foot"><span>Orders · left axis</span><span>Revenue (PKR) · right axis</span></div>
 </div>;
}
