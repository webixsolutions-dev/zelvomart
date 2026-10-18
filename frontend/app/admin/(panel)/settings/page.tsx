"use client";
import {SITE_ORIGIN} from "@/lib/site-url";
import { useEffect, useState } from 'react';
import { DEFAULT_DELIVERY_CHARGE, FREE_SHIPPING_ABOVE, resolveDeliveryPolicy } from '@/lib/shipping';
import AdminModal from '@/components/admin/AdminModal';
import { DashboardIcon } from '@/components/admin/DashboardMetrics';
import {setSessionReplayOptOut} from '@/lib/session-replay-client';
import { clientApi } from '@/lib/client-api';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';

function StoreForm({s,onSaved}:{s:any;onSaved:()=>void}){const info=s['store.info']||{};async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.info':{name:'Zelvomart',phone:f.get('phone'),email:f.get('email'),whatsapp:f.get('whatsapp'),country:'Pakistan'},'store.minimumSellingPrice':Number(f.get('minimum')||1000),'store.bundleDefaultDiscountPercent':Number(f.get('bundle')||5)})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><label className="field"><span>Phone</span><input name="phone" defaultValue={info.phone||'0300-2026711'}/></label><label className="field"><span>Email</span><input name="email" defaultValue={info.email||'zelvomart@gmail.com'}/></label><label className="field"><span>WhatsApp number</span><input name="whatsapp" defaultValue={info.whatsapp||'923002026711'}/></label><label className="field"><span>Minimum selling price</span><input name="minimum" type="number" defaultValue={s['store.minimumSellingPrice']??1000}/></label><label className="field"><span>Default Buy 2 discount %</span><input name="bundle" type="number" defaultValue={s['store.bundleDefaultDiscountPercent']??5}/></label><button className="admin-reference-submit">Save Store Settings</button></form>}
function DeliveryForm({s,onSaved}:{s:any;onSaved:()=>void}){const d=s['store.delivery']||{};const {flatRate:charge,threshold:freeAbove}=resolveDeliveryPolicy(d);async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);/* Never saved as free: an empty or zero charge is stored as DEFAULT_DELIVERY_CHARGE (lib/shipping.ts). */await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.delivery':{mode:'FREE_ABOVE',flatRate:Number(f.get('flatRate'))>0?Number(f.get('flatRate')):DEFAULT_DELIVERY_CHARGE,freeAbove:Number(f.get('freeAbove'))>0?Number(f.get('freeAbove')):FREE_SHIPPING_ABOVE}})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><p className="admin-inline-note full">Every product pays this delivery charge. Delivery is free only when the order total is above the free-above amount, or when every product in the order has Free shipping turned on (product → Shipping tab). These values are used on the product page, cart, checkout and the saved order.</p><label className="field"><span>Delivery charge (Rs)</span><input name="flatRate" type="number" min="1" defaultValue={charge}/></label><label className="field"><span>Free above (Rs)</span><input name="freeAbove" type="number" min="1" defaultValue={freeAbove}/></label><button className="admin-reference-submit">Save Delivery Settings</button></form>}
function TrackingForm({ s, onSaved }: { s: any; onSaved: () => void }) {
  const [excluded,setExcluded]=useState(false);
  useEffect(()=>setExcluded(localStorage.getItem('zm_session_replay_opt_out')==='1'),[]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const f = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      'tracking.metaPixelEnabled': f.get('metaPixelEnabled') === 'on',
      'tracking.metaPixelId': String(f.get('metaPixelId') || '').trim(),
      'tracking.metaCapiEnabled': f.get('metaCapiEnabled') === 'on',
      'tracking.metaTestEventCode': String(f.get('metaTestEventCode') || '').trim(),

      'tracking.tiktokPixelEnabled': f.get('tiktokPixelEnabled') === 'on',
      'tracking.tiktokPixelId': String(f.get('tiktokPixelId') || '').trim(),
      'tracking.tiktokEventsApiEnabled': f.get('tiktokEventsApiEnabled') === 'on',
      'tracking.tiktokTestEventCode': String(f.get('tiktokTestEventCode') || '').trim(),


      'marketing.meta.adAccountId':String(f.get('adAccountId')||'').trim(),
      'marketing.meta.pageId':String(f.get('pageId')||'').trim(),
      'marketing.meta.instagramAccountId':String(f.get('instagramAccountId')||'').trim(),
      'tracking.sessionReplayEnabled': f.get('sessionReplayEnabled') === 'on',
      'tracking.sessionReplayRetentionDays': Math.max(1, Math.min(90, Number(f.get('sessionReplayRetentionDays') || 14))),
    };

    const marketingToken=String(f.get('marketingAccessToken')||'').trim();if(marketingToken)body['marketing.meta.accessToken']=marketingToken;
    const metaCapiToken = String(f.get('metaCapiToken') || '').trim();
    if (metaCapiToken) body['tracking.metaCapiToken'] = metaCapiToken;

    const tiktokEventsApiToken = String(f.get('tiktokEventsApiToken') || '').trim();
    if (tiktokEventsApiToken) body['tracking.tiktokEventsApiToken'] = tiktokEventsApiToken;

    try {
      await clientApi('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) }, true);
      setMessage('Tracking settings saved successfully.');
      onSaved();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save tracking settings.');
    } finally {
      setSaving(false);
    }
  }

  const metaPixelOn = s['tracking.metaPixelEnabled'] !== false && s['tracking.metaPixelEnabled'] !== 'false';
  const metaCapiOn = s['tracking.metaCapiEnabled'] !== false && s['tracking.metaCapiEnabled'] !== 'false';
  const tiktokPixelOn = s['tracking.tiktokPixelEnabled'] !== false && s['tracking.tiktokPixelEnabled'] !== 'false';
  const tiktokEventsApiOn = s['tracking.tiktokEventsApiEnabled'] !== false && s['tracking.tiktokEventsApiEnabled'] !== 'false';
  const replayOn = s['tracking.sessionReplayEnabled'] !== false && s['tracking.sessionReplayEnabled'] !== 'false';

  const hasMetaCapiToken = Boolean(s['tracking.metaCapiToken']);
  const hasTikTokToken = Boolean(s['tracking.tiktokEventsApiToken'] || s['tracking.tiktokAccessToken']);

  return (
    <form className="admin-reference-form" onSubmit={submit}>
      {/* Meta Suite */}
      <div className="full" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>Meta (Facebook & Instagram)</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Configure client-side browser Pixel and server-side Conversions API (CAPI) with deduplication.</p>

        <label className="admin-check full" style={{ marginBottom: 10 }}>
          <input type="checkbox" name="metaPixelEnabled" defaultChecked={metaPixelOn} />
          <strong>Enable Meta Pixel (Browser)</strong>
        </label>
        <label className="field full">
          <span>Meta Pixel ID</span>
          <input name="metaPixelId" defaultValue={s['tracking.metaPixelId'] || ''} placeholder="e.g. 1645715973642563" />
        </label>

        <label className="admin-check full" style={{ marginTop: 12, marginBottom: 10 }}>
          <input type="checkbox" name="metaCapiEnabled" defaultChecked={metaCapiOn} />
          <strong>Enable Meta Conversions API (Server-Side CAPI)</strong>
        </label>
        <label className="field full">
          <span>Meta CAPI Access Token</span>
          <input
            name="metaCapiToken"
            type="password"
            autoComplete="new-password"
            placeholder={hasMetaCapiToken ? "•••••••• (Token configured — leave blank to keep)" : "Paste Meta CAPI access token"}
          />
        </label>
        <label className="field full">
          <span>Meta Test Event Code (Optional)</span>
          <input name="metaTestEventCode" defaultValue={s['tracking.metaTestEventCode'] || ''} placeholder="TEST12345 (Events Manager test code)" />
        </label>
      </div>

      <button type="button" className="admin-btn admin-btn-light" onClick={async()=>{try{const r=await clientApi('/api/admin/tracking/test/meta',{method:'POST'},true);setMessage(JSON.stringify(r))}catch(e){setMessage(e instanceof Error?e.message:'Test failed')}}}>Send Meta test event</button>
      <div className="full"><h3>Meta ad account</h3>{[['adAccountId','Ad Account ID','marketing.meta.adAccountId'],['pageId','Facebook Page ID','marketing.meta.pageId'],['instagramAccountId','Instagram Account ID','marketing.meta.instagramAccountId']].map(([name,label,key])=><label className="field" key={name}><span>{label}</span><input name={name} defaultValue={s[key]||''}/></label>)}<label className="field"><span>Marketing API access token (optional, separate from CAPI)</span><input name="marketingAccessToken" type="password" autoComplete="new-password" placeholder="Leave blank to keep the current token"/></label></div>
      {/* TikTok Suite */}
      <div className="full" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>TikTok</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Configure client-side TikTok Pixel and server-side TikTok Events API with event_id matching.</p>

        <label className="admin-check full" style={{ marginBottom: 10 }}>
          <input type="checkbox" name="tiktokPixelEnabled" defaultChecked={tiktokPixelOn} />
          <strong>Enable TikTok Pixel (Browser)</strong>
        </label>
        <label className="field full">
          <span>TikTok Pixel ID</span>
          <input name="tiktokPixelId" defaultValue={s['tracking.tiktokPixelId'] || ''} placeholder="e.g. CXXXXXX..." />
        </label>

        <label className="admin-check full" style={{ marginTop: 12, marginBottom: 10 }}>
          <input type="checkbox" name="tiktokEventsApiEnabled" defaultChecked={tiktokEventsApiOn} />
          <strong>Enable TikTok Events API (Server-Side)</strong>
        </label>
        <label className="field full">
          <span>TikTok Events API Access Token</span>
          <input
            name="tiktokEventsApiToken"
            type="password"
            autoComplete="new-password"
            placeholder={hasTikTokToken ? "•••••••• (Token configured — leave blank to keep)" : "Paste TikTok Events API token"}
          />
        </label>
        <label className="field full">
          <span>TikTok Test Event Code (Optional)</span>
          <input name="tiktokTestEventCode" defaultValue={s['tracking.tiktokTestEventCode'] || ''} placeholder="TESTXXXX (TikTok Events Manager code)" />
        </label>
      </div>

      <button type="button" className="admin-btn admin-btn-light" onClick={async()=>{try{const r=await clientApi('/api/admin/tracking/test/tiktok',{method:'POST'},true);setMessage(JSON.stringify(r))}catch(e){setMessage(e instanceof Error?e.message:'Test failed')}}}>Send TikTok test event</button>
      <div className="full"><label className="admin-check"><input type="checkbox" checked={excluded} onChange={e=>{setExcluded(e.target.checked);setSessionReplayOptOut(e.target.checked)}}/> Exclude this device from tracking and recordings</label><h3>Catalog feeds</h3><p>Save settings before sending test events. A test code is required.</p>{['meta','tiktok','google'].map(platform=><label className="field" key={platform}><span>{platform} feed URL</span><input readOnly value={`${SITE_ORIGIN}/feeds/${platform}.xml`} onClick={e=>e.currentTarget.select()}/></label>)}</div>
      {/* Session Replay */}
      <div className="full" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>CRO Session Replay & Retention</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Privacy-masked in-house rrweb session recordings and automated cleanup.</p>

        <label className="admin-check full" style={{ marginBottom: 10 }}>
          <input type="checkbox" name="sessionReplayEnabled" defaultChecked={replayOn} />
          <strong>Enable Visitor Session Recording (rrweb)</strong>
        </label>
        <label className="field">
          <span>Retention Window (Days)</span>
          <input name="sessionReplayRetentionDays" type="number" min="1" max="90" defaultValue={s['tracking.sessionReplayRetentionDays'] ?? 14} />
        </label>
      </div>

      {message && <div className="admin-inline-note full">{message}</div>}
      <button className="admin-reference-submit" disabled={saving}>
        {saving ? 'Saving Settings…' : 'Save Tracking & Conversion APIs'}
      </button>
    </form>
  );
}
function CitiesForm({cities,onSaved}:{cities:any[];onSaved:()=>void}){async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const lines=String(f.get('cities')||'').split('\n').map(x=>x.trim()).filter(Boolean);const rows=lines.map(line=>{const [name,min,max]=line.split('|').map(x=>x.trim());if(!name||!min||!max||!Number.isInteger(Number(min))||Number(min)<1||Number(max)<Number(min))throw new Error('Enter a city and valid minimum and maximum days on every line.');return{name,deliveryMinDays:Number(min),deliveryMaxDays:Number(max),active:true}});await clientApi('/api/admin/cities',{method:'PUT',body:JSON.stringify({cities:rows})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><label className="field full"><span>Cities — Name | Min days | Max days</span><textarea name="cities" rows={14} defaultValue={cities.map(c=>`${c.name} | ${c.deliveryMinDays} | ${c.deliveryMaxDays}`).join('\n')}/></label><button className="admin-reference-submit">Save Cities</button></form>}
export default function Settings(){const {data,loading,error,reload}=useAdminData<any>('/api/admin/settings',{settings:{},cities:[]});if(loading)return <AdminLoading/>;if(error)return <AdminError message={error}/>;const s=data.settings||{};const cards=[['Store','Phone, email, WhatsApp, minimum price and bundle discount.',<StoreForm s={s} onSaved={reload}/>],['Delivery',`Every product pays Rs ${resolveDeliveryPolicy(s['store.delivery']).flatRate.toLocaleString('en-US')} delivery; orders above Rs ${resolveDeliveryPolicy(s['store.delivery']).threshold.toLocaleString('en-US')} ship free.`,<DeliveryForm s={s} onSaved={reload}/>],['Tracking & Feeds','Meta, TikTok, product feeds, and first-party Session Replay.',<TrackingForm s={s} onSaved={reload}/>],['Cities & estimates','Pakistan city list and delivery estimates.',<CitiesForm cities={data.cities||[]} onSaved={reload}/>]];return <><div className="dashboard-heading settings-page-heading"><div><span className="dashboard-eyebrow">STORE PREFERENCES</span><h1>Settings</h1><p>Manage your store, checkout, delivery and integrations.</p></div></div><div className="admin-settings-grid settings-dashboard-grid">{cards.map(([title,desc,form]:any, index:number)=><div className="admin-settings-card" key={title}><div className="settings-card-top"><span className={`dashboard-metric-icon ${["blue","purple","orange","teal","purple","green","blue"][index]}`}><DashboardIcon name={(["box","truck","eye","document"] as const)[index]} /></span><span className="settings-card-category">{["GENERAL","FULFILMENT","INTEGRATIONS","LOCATIONS"][index]}</span></div><h2>{title}</h2><p>{desc}</p><AdminModal trigger="Manage settings →" triggerClassName="settings-card-action" title={title} size="lg">{form}</AdminModal></div>)}</div></>}
