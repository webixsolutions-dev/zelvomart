"use client";
import AdminTable from '@/components/admin/AdminTable';


import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminError, useAdminData } from "@/components/admin/useAdminData";
import { money } from "@/lib/format";

type ReplayRow = {
  id:string; visitorId:string; source:string; campaign?:string|null; landingUrl:string; lastUrl:string;
  device?:string|null; status:string; startedAt:string; lastSeenAt:string; endedAt?:string|null;
  eventCount:number; chunkCount:number; pageViews:number; durationMs:number;
  order?:{id:string;orderNumber:string;total:number;createdAt:string}|null;
};
type ReplayList = { total:number; items:ReplayRow[]; stats:{last30:number;ordered30:number;sources:Record<string,number>} };

function duration(ms:number){
  const seconds=Math.max(0,Math.round((ms||0)/1000));
  const minutes=Math.floor(seconds/60);
  return minutes?`${minutes}m ${seconds%60}s`:`${seconds}s`;
}
function sourceLabel(value:string){ return value==='direct'?'Direct':value.charAt(0).toUpperCase()+value.slice(1); }

export default function SessionReplaysPage(){
  const [source,setSource]=useState("all");
  const [outcome,setOutcome]=useState("all");
  const [q,setQ]=useState("");
  const query=useMemo(()=>{
    const params=new URLSearchParams();
    if(source!=="all") params.set("source",source);
    if(outcome!=="all") params.set("outcome",outcome);
    if(q.trim()) params.set("q",q.trim());
    return `/api/admin/session-replays${params.toString()?`?${params}`:""}`;
  },[source,outcome,q]);
  const {data,error}=useAdminData<ReplayList>(query,{total:0,items:[],stats:{last30:0,ordered30:0,sources:{}}});
  if(error) return <AdminError message={error}/>;
  const metaCount=(data.stats.sources.facebook||0)+(data.stats.sources.instagram||0);

  return <>
    <div className="admin-title"><div><h1>Session Replays</h1><p>Watch privacy-masked customer journeys and connect drop-offs with traffic source and orders.</p></div></div>
    <div className="admin-kpis">
      <div className="admin-card"><small>Recorded sessions</small><strong>{data.total}</strong><span>latest stored sessions</span></div>
      <div className="admin-card"><small>Orders with replay</small><strong>{data.stats.ordered30}</strong><span>last 30 days</span></div>
      <div className="admin-card"><small>Meta traffic</small><strong>{metaCount}</strong><span>Facebook + Instagram sessions</span></div>
      <div className="admin-card"><small>Privacy</small><strong>Masked</strong><span>all form inputs are hidden</span></div>
    </div>

    <div className="admin-card replay-filter-card">
      <div className="replay-filters">
        <input className="admin-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search landing page, campaign or visitor…" />
        <select className="admin-select" value={source} onChange={e=>setSource(e.target.value)}><option value="all">All sources</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="tiktok">TikTok</option><option value="direct">Direct</option></select>
        <select className="admin-select" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="all">All outcomes</option><option value="ordered">Placed order</option><option value="no-order">No order</option></select>
      </div>
      <p className="replay-privacy-note">Recorder never runs inside the admin panel. Passwords, checkout inputs, phone, email and address fields are masked before replay events are sent.</p>
    </div>

    <div className="admin-table-wrap"><AdminTable scrollLabel="Session replays" className="admin-table"><thead><tr><th>Visitor / source</th><th>Started</th><th>Journey</th><th>Landing page</th><th>Outcome</th><th></th></tr></thead><tbody>
      {data.items.map(row=><tr key={row.id}>
        <td><b>#{row.visitorId.slice(0,8)}</b><div className="replay-source"><span>{sourceLabel(row.source)}</span>{row.campaign?<small>{row.campaign}</small>:null}</div></td>
        <td>{new Date(row.startedAt).toLocaleString()}<small className="admin-cell-sub">{row.device||"device unknown"}</small></td>
        <td><b>{duration(row.durationMs)}</b><small className="admin-cell-sub">{row.pageViews} pages · {row.eventCount} events</small></td>
        <td><span className="replay-url" title={row.landingUrl}>{row.landingUrl.replace(/^https?:\/\/[^/]+/,'')||'/'}</span></td>
        <td>{row.order?<><b>{row.order.orderNumber}</b><small className="admin-cell-sub">{money(row.order.total)}</small></>:<span className="replay-no-order">No order</span>}</td>
        <td><Link href={`/admin/session-replays/${row.id}`} className="admin-btn admin-btn-primary">▶ Watch</Link></td>
      </tr>)}
      {!data.items.length?<tr><td colSpan={6}>No session replays match these filters yet.</td></tr>:null}
    </tbody></AdminTable></div>
  </>;
}
