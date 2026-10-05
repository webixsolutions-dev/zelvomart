"use client";
import { useAdminData,AdminError } from '@/components/admin/useAdminData';
function health(value:number){return value>=99.5?'Healthy':value>=95?'Check':'Action needed'}
function statusTone(ok:boolean){return ok?'good':'warn'}
export default function Tracking(){
  const {data,error}=useAdminData<any>('/api/admin/tracking',{browser:{},server:{},orders:0,acceptedPurchases:0,purchaseCoverage:0,paired:0,pairEligible:0,dedupeCoverage:0,lastSuccess:null,errors:[],config:{}});
  if(error)return <AdminError message={error||'Unable to load tracking'}/>;
  const names=['PageView','ViewContent','Search','AddToCart','InitiateCheckout','Purchase','Contact'];
  const max=Math.max(1,...names.flatMap(name=>[Number(data.browser?.[name]||0),Number(data.server?.[name]||0)]));
  return <>
    <div className="admin-title"><div><h1>Tracking Health</h1><p>Meta Pixel + Conversions API event pairing, Purchase coverage and errors.</p></div></div>
    <div className="admin-tracking-kpis">
      <article className="admin-tracking-card"><div><small>Purchase coverage</small><span className={`admin-health-pill ${statusTone((data.purchaseCoverage||0)>=95)}`}>{health(data.purchaseCoverage||0)}</span></div><strong>{Number(data.purchaseCoverage||0).toFixed(1)}%</strong><p>{data.acceptedPurchases}/{data.orders} orders accepted by CAPI</p><i style={{width:`${Math.min(100,Number(data.purchaseCoverage||0))}%`}}/></article>
      <article className="admin-tracking-card"><div><small>Browser ↔ server pairing</small><span className={`admin-health-pill ${statusTone((data.dedupeCoverage||0)>=95)}`}>{health(data.dedupeCoverage||0)}</span></div><strong>{Number(data.dedupeCoverage||0).toFixed(1)}%</strong><p>{data.paired}/{data.pairEligible} event IDs paired</p><i style={{width:`${Math.min(100,Number(data.dedupeCoverage||0))}%`}}/></article>
      <article className="admin-tracking-card"><div><small>Conversions API</small><span className={`admin-health-pill ${statusTone(Boolean(data.config?.capiConfigured))}`}>{data.config?.capiConfigured?'Ready':'Setup needed'}</span></div><strong className="status-copy">{data.config?.capiConfigured?'Configured':'Missing token'}</strong><p>Pixel {data.config?.pixelId||'not set'}</p></article>
      <article className="admin-tracking-card"><div><small>Microsoft Clarity</small><span className={`admin-health-pill ${statusTone(Boolean(data.config?.clarityId))}`}>{data.config?.clarityId?'Ready':'Setup needed'}</span></div><strong className="status-copy">{data.config?.clarityId?'Configured':'Not set'}</strong><p>{data.config?.appEnv||'development'} environment</p></article>
    </div>

    <section className="admin-section-card admin-event-health-card">
      <div className="admin-section-head"><div><h2>Event delivery</h2><p>Browser Pixel and server CAPI counts by event type.</p></div><div className="admin-chart-legend"><span><i className="browser"/>Browser</span><span><i className="server"/>Server</span></div></div>
      <div className="admin-event-bars">{names.map(name=>{const browser=Number(data.browser?.[name]||0),server=Number(data.server?.[name]||0);return <div className="admin-event-row" key={name}><b>{name}</b><div className="admin-event-pair"><span><i className="browser" style={{width:`${Math.max(browser?3:0,browser/max*100)}%`}}/></span><span><i className="server" style={{width:`${Math.max(server?3:0,server/max*100)}%`}}/></span></div><div><strong>{browser}</strong><small>{server}</small></div></div>})}</div>
    </section>

    <div className="admin-tracking-bottom-grid">
      <section className="admin-section-card"><small>Last successful server event</small><strong className="admin-last-event">{data.lastSuccess?new Date(data.lastSuccess).toLocaleString('en-PK'):'No successful server event yet'}</strong><p>Staging test event code: {data.config?.testEventCodeConfigured?'configured':'not configured'}. Production should not use a test code.</p></section>
      <section className="admin-section-card"><div className="admin-section-head"><div><h2>Recent server errors</h2><p>Latest CAPI delivery failures from the backend.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Event</th><th>ID</th><th>Error</th></tr></thead><tbody>{(data.errors||[]).map((e:any)=><tr key={e.id}><td>{new Date(e.createdAt).toLocaleString('en-PK')}</td><td>{e.eventName}</td><td>{e.eventId}</td><td style={{maxWidth:420,whiteSpace:'normal'}}>{e.error||JSON.stringify(e.response)||'—'}</td></tr>)}{!data.errors?.length?<tr><td colSpan={4}>No server-side tracking errors in the last 7 days.</td></tr>:null}</tbody></table></div></section>
    </div>
  </>;
}
