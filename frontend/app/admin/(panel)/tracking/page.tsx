"use client";
import { useAdminData,AdminError } from '@/components/admin/useAdminData';

function health(value:number){return value>=99.5?'Healthy':value>=95?'Check':'Action needed'}
export default function Tracking(){
  const {data,error}=useAdminData<any>('/api/admin/tracking',{browser:{},server:{},orders:0,acceptedPurchases:0,purchaseCoverage:0,paired:0,pairEligible:0,dedupeCoverage:0,lastSuccess:null,errors:[],config:{}});
  if(error)return <AdminError message={error||'Unable to load tracking'}/>;
  const names=['PageView','ViewContent','Search','AddToCart','InitiateCheckout','Purchase','Contact'];
  return <>
    <div className="admin-title"><div><h1>Tracking Health</h1><p>Meta Pixel + Conversions API event pairing, Purchase coverage and errors.</p></div></div>
    <div className="admin-kpis">
      <div className="admin-card"><small>Purchase coverage</small><strong>{Number(data.purchaseCoverage||0).toFixed(1)}%</strong><span>{health(data.purchaseCoverage||0)} • {data.acceptedPurchases}/{data.orders} orders accepted by CAPI</span></div>
      <div className="admin-card"><small>Browser ↔ server pairing</small><strong>{Number(data.dedupeCoverage||0).toFixed(1)}%</strong><span>{data.paired}/{data.pairEligible} event IDs paired</span></div>
      <div className="admin-card"><small>CAPI</small><strong style={{fontSize:18}}>{data.config?.capiConfigured?'Configured':'Missing token'}</strong><span>Pixel {data.config?.pixelId||'not set'}</span></div>
      <div className="admin-card"><small>Clarity</small><strong style={{fontSize:18}}>{data.config?.clarityId?'Configured':'Not set'}</strong><span>{data.config?.appEnv||'development'} environment</span></div>
    </div>
    <div className="admin-card" style={{marginBottom:18}}><small>Last successful server event</small><strong style={{fontSize:16}}>{data.lastSuccess?new Date(data.lastSuccess).toLocaleString('en-PK'):'—'}</strong><p style={{fontSize:11,marginTop:8}}>Staging test event code: {data.config?.testEventCodeConfigured?'configured':'not configured'}. Production should not use a test code.</p></div>
    <div className="admin-table-wrap" style={{marginBottom:18}}><table className="admin-table"><thead><tr><th>Event</th><th>Browser Pixel logged</th><th>Server CAPI logged</th></tr></thead><tbody>{names.map(name=><tr key={name}><td>{name}</td><td>{data.browser?.[name]||0}</td><td>{data.server?.[name]||0}</td></tr>)}</tbody></table></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Event</th><th>ID</th><th>Error</th></tr></thead><tbody>{(data.errors||[]).map((e:any)=><tr key={e.id}><td>{new Date(e.createdAt).toLocaleString('en-PK')}</td><td>{e.eventName}</td><td>{e.eventId}</td><td style={{maxWidth:420,whiteSpace:'normal'}}>{e.error||JSON.stringify(e.response)||'—'}</td></tr>)}{!data.errors?.length?<tr><td colSpan={4}>No server-side tracking errors in the last 7 days.</td></tr>:null}</tbody></table></div>
  </>;
}
