"use client";

import { useState } from "react";
import { useAdminData, AdminError, AdminLoading } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";
import { money } from "@/lib/format";

type MarketingData = {
  periodDays:number; totalOrders:number; totalRevenue:number; facebookOrders:number; instagramOrders:number; attributedOrders:number;
  sources:Array<{source:string;orders:number;revenue:number}>;
  recent:Array<{id:string;orderNumber:string;fullName:string;total:number;createdAt:string;source:string;medium:string;campaign:string;content:string;adId:string;adsetId:string;campaignId:string}>;
  meta:{configured:boolean;ads:any[];currency?:string;adAccountName?:string;error?:string|null;pixelId?:string;adAccountId?:string;pageId?:string;instagramAccountId?:string;accessTokenConfigured?:boolean};
};

export default function MarketingPage(){
  const {data,loading,error,reload}=useAdminData<MarketingData>('/api/admin/marketing',{periodDays:30,totalOrders:0,totalRevenue:0,facebookOrders:0,instagramOrders:0,attributedOrders:0,sources:[],recent:[],meta:{configured:false,ads:[]}});
  const [message,setMessage]=useState('');
  if(loading)return <AdminLoading/>;
  if(error)return <AdminError message={error}/>;
  async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setMessage('');const f=new FormData(e.currentTarget);await clientApi('/api/admin/marketing/meta',{method:'PUT',body:JSON.stringify({pixelId:f.get('pixelId'),adAccountId:f.get('adAccountId'),pageId:f.get('pageId'),instagramAccountId:f.get('instagramAccountId'),accessToken:f.get('accessToken')})},true);setMessage('Meta settings saved.');reload()}
  async function test(){setMessage('Testing…');try{await clientApi('/api/admin/marketing/meta/test',{method:'POST'},true);setMessage('Meta connection successful.')}catch(e){setMessage(e instanceof Error?e.message:'Meta test failed')}}
  const attributionPct=data.totalOrders?Math.round(data.attributedOrders/data.totalOrders*1000)/10:0;
  return <>
    <div className="admin-title"><div><h1>Meta & Attribution</h1><p>Pixel identity, Marketing API connection and order-source attribution.</p></div><button className="admin-btn admin-btn-light" onClick={test}>Test Meta Connection</button></div>
    <div className="admin-kpis">
      <div className="admin-card"><small>30-day orders</small><strong>{data.totalOrders}</strong><span>{money(data.totalRevenue)} revenue</span></div>
      <div className="admin-card"><small>Attributed orders</small><strong>{attributionPct}%</strong><span>{data.attributedOrders} with a non-direct source</span></div>
      <div className="admin-card"><small>Facebook orders</small><strong>{data.facebookOrders}</strong><span>First/last touch captured</span></div>
      <div className="admin-card"><small>Instagram orders</small><strong>{data.instagramOrders}</strong><span>UTM + fbclid supported</span></div>
    </div>
    <div className="admin-content-grid">
      <section className="admin-section-card"><div className="admin-section-head"><div><h2>Meta configuration</h2><p>CAPI token stays server-only in META_CAPI_TOKEN. This panel configures Pixel and optional Marketing API access.</p></div></div>
        <form className="admin-reference-form" onSubmit={save}>
          <label className="field"><span>Meta Pixel ID</span><input name="pixelId" defaultValue={data.meta?.pixelId||''}/></label>
          <label className="field"><span>Ad Account ID</span><input name="adAccountId" defaultValue={data.meta?.adAccountId||''} placeholder="act_123..."/></label>
          <label className="field"><span>Facebook Page ID</span><input name="pageId" defaultValue={data.meta?.pageId||''}/></label>
          <label className="field"><span>Instagram Account ID</span><input name="instagramAccountId" defaultValue={data.meta?.instagramAccountId||''}/></label>
          <label className="field"><span>Marketing API access token</span><input name="accessToken" type="password" placeholder={data.meta?.accessTokenConfigured?'Token already saved — leave blank to keep':'Paste token'}/></label>
          <button className="admin-reference-submit">Save Meta Settings</button>
          {message?<div className="admin-inline-note">{message}</div>:null}
        </form>
      </section>
      <section className="admin-section-card"><div className="admin-section-head"><div><h2>Source mix</h2><p>Orders grouped from first/last-touch UTM attribution.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Source</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>{data.sources.map(row=><tr key={row.source}><td style={{textTransform:'capitalize'}}>{row.source}</td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}{!data.sources.length?<tr><td colSpan={3}>No attributed orders yet.</td></tr>:null}</tbody></table></div></section>
    </div>
    <section className="admin-section-card" style={{marginTop:18}}><div className="admin-section-head"><div><h2>Recent attribution</h2><p>Campaign and ad parameters saved with orders.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Source</th><th>Campaign</th><th>Ad / content</th><th>Total</th></tr></thead><tbody>{data.recent.map(row=><tr key={row.id}><td>{row.orderNumber}</td><td>{row.source}{row.medium?` / ${row.medium}`:''}</td><td>{row.campaign||row.campaignId||'—'}</td><td>{row.content||row.adId||'—'}</td><td>{money(row.total)}</td></tr>)}</tbody></table></div></section>
    {data.meta?.error?<div className="admin-card" style={{marginTop:18}}><h2>Meta API notice</h2><p>{data.meta.error}</p></div>:null}
  </>;
}
