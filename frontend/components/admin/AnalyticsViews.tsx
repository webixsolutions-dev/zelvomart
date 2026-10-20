"use client";
import {useState} from 'react';
import {money} from '@/lib/format';
import './analytics-views.css';

type Metric={key:string;label:string;currency?:boolean};
type Row={id:string;label:string;[key:string]:string|number};
const tones=['#2563eb','#0891b2','#7c3aed','#059669','#d97706','#e11d48','#64748b','#4f46e5'];
const value=(n:unknown)=>Math.max(0,Number(n)||0);

export function RankingChart({title,rows,metrics,note,emptyLabel}:{title:string;rows:Row[];metrics:Metric[];note:string;emptyLabel?:string}){
 const [selected,setSelected]=useState(metrics[0].key);
 const metric=metrics.find(m=>m.key===selected)||metrics[0];
 const ranked=[...rows].sort((a,b)=>value(b[metric.key])-value(a[metric.key])).slice(0,8);
 const maximum=Math.max(0,...ranked.map(r=>value(r[metric.key])));
 return <section className="analytics-chart" aria-label={title}>
  <header><div><span className="analytics-eyebrow">Performance comparison</span><h3>{title}</h3></div><label><span className="analytics-sr">{title} metric</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{metrics.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select></label></header>
  {maximum>0?<ol className="analytics-ranking">{ranked.map((r,i)=><li key={r.id}><div><span title={r.label}>{r.label}</span><strong>{metric.currency?money(value(r[metric.key])):value(r[metric.key]).toLocaleString('en-PK')}</strong></div><div className="analytics-track" role="img" aria-label={`${r.label}: ${metric.currency?money(value(r[metric.key])):value(r[metric.key])} ${metric.label}`}><i style={{width:`${value(r[metric.key])/maximum*100}%`,background:tones[i%tones.length]}}/></div></li>)}</ol>:<div className="analytics-empty">{emptyLabel||`No ${metric.label.toLowerCase()} recorded for this period.`}</div>}
  <p className="analytics-note">{note}</p>
 </section>;
}

export function OrderMixChart({statuses}:{statuses:{status:string;_count:{_all:number}}[]}){
 const rows=statuses.filter(r=>value(r._count._all)>0).sort((a,b)=>b._count._all-a._count._all),total=rows.reduce((n,r)=>n+value(r._count._all),0);
 let cursor=0;
 const segments=rows.map((r,i)=>{const start=cursor;cursor+=r._count._all/total*100;return `${tones[i%tones.length]} ${start}% ${cursor}%`;});
 return <section className="analytics-chart"><header><div><span className="analytics-eyebrow">Fulfilment snapshot</span><h3>Order status distribution</h3></div></header>{total?<div className="analytics-mix"><div className="analytics-ring" style={{background:`conic-gradient(${segments.join(',')})`}} role="img" aria-label={`${total} orders. ${rows.map(r=>`${r.status.replaceAll('_',' ')}: ${r._count._all}`).join('; ')}`}><div><strong>{total.toLocaleString()}</strong><span>orders</span></div></div><ul>{rows.map((r,i)=><li key={r.status}><i style={{background:tones[i%tones.length]}}/><span>{r.status.replaceAll('_',' ').toLowerCase()}</span><strong>{r._count._all}</strong><small>{(r._count._all/total*100).toFixed(1)}%</small></li>)}</ul></div>:<div className="analytics-empty">No orders recorded for this period.</div>}<p className="analytics-note">Current status of orders created during the selected period, including cancellations and returns.</p></section>;
}

export function DailyValueChart({days}:{days:{day:string;orders:number;revenue:number}[]}){
 return <RankingChart title="Daily sales analysis" rows={days.map(d=>({id:d.day,label:new Date(d.day+'T12:00:00Z').toLocaleDateString('en-PK',{month:'short',day:'numeric'}),revenue:d.revenue,orders:d.orders,aov:d.orders?d.revenue/d.orders:0}))} metrics={[{key:'revenue',label:'Revenue',currency:true},{key:'orders',label:'Orders'},{key:'aov',label:'Average order value',currency:true}]} note="Top 8 days by the selected metric. Revenue excludes cancelled and returned orders; order counts include all statuses. Average value uses that same order count."/>;
}
