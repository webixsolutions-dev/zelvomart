"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import SessionReplayPlayer from "@/components/admin/SessionReplayPlayer";
import { AdminError, useAdminData } from "@/components/admin/useAdminData";
import { money } from "@/lib/format";

type ReplayDetail={
  session:{id:string;visitorId:string;source:string;campaign?:string|null;landingUrl:string;lastUrl:string;device?:string|null;viewport?:string|null;startedAt:string;lastSeenAt:string;endedAt?:string|null;eventCount:number;pageViews:number;durationMs:number};
  events:unknown[];
  order?:{orderNumber:string;total:number;source?:string|null;createdAt:string}|null;
  markers:Array<{eventName:string;sourceUrl?:string|null;createdAt:string;payload:unknown}>;
};
const empty:ReplayDetail={session:{id:"",visitorId:"",source:"direct",landingUrl:"",lastUrl:"",startedAt:new Date().toISOString(),lastSeenAt:new Date().toISOString(),eventCount:0,pageViews:0,durationMs:0},events:[],order:null,markers:[]};
function duration(ms:number){const s=Math.max(0,Math.round((ms||0)/1000));return `${Math.floor(s/60)}m ${s%60}s`;}

export default function ReplayDetailPage(){
  const params=useParams<{id:string}>();
  const id=String(params.id||"");
  const {data,error}=useAdminData<ReplayDetail>(`/api/admin/session-replays/${encodeURIComponent(id)}`,empty);
  if(error) return <AdminError message={error}/>;
  const start=new Date(data.session.startedAt).getTime();
  return <>
    <div className="admin-title"><div><Link href="/admin/session-replays" className="replay-back">← Session Replays</Link><h1>Replay #{data.session.visitorId.slice(0,8)||"…"}</h1><p>{data.session.source}{data.session.campaign?` · ${data.session.campaign}`:""} · {duration(data.session.durationMs)} · {data.session.pageViews} pages</p></div>{data.order?<div className="replay-order-pill"><small>Converted</small><b>{data.order.orderNumber}</b><span>{money(data.order.total)}</span></div>:null}</div>

    <SessionReplayPlayer events={data.events}/>

    <div className="replay-detail-grid">
      <div className="admin-card"><h2>Session details</h2><dl className="replay-details"><div><dt>Started</dt><dd>{new Date(data.session.startedAt).toLocaleString()}</dd></div><div><dt>Source</dt><dd>{data.session.source}</dd></div><div><dt>Device</dt><dd>{data.session.device||"Unknown"} {data.session.viewport?`(${data.session.viewport})`:""}</dd></div><div><dt>Landing page</dt><dd>{data.session.landingUrl||"—"}</dd></div><div><dt>Last page</dt><dd>{data.session.lastUrl||"—"}</dd></div></dl></div>
      <div className="admin-card"><h2>Journey markers</h2><div className="replay-markers">{data.markers.map((marker,index)=>{const offset=Math.max(0,Math.round((new Date(marker.createdAt).getTime()-start)/1000));return <div key={`${marker.eventName}-${index}`}><span>{Math.floor(offset/60)}:{String(offset%60).padStart(2,'0')}</span><b>{marker.eventName}</b><small>{marker.sourceUrl?.replace(/^https?:\/\/[^/]+/,'')||""}</small></div>})}{!data.markers.length?<p>No tracked funnel markers yet.</p>:null}</div></div>
    </div>
  </>;
}
