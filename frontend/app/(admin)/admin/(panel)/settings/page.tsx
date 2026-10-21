"use client";
import './settings.css';
import SettingsForm from '@/components/admin/SettingsForm';
import {clearAdminDataCache} from '@/components/admin/useAdminData';
import RecoveryOfferSettings from '@/components/admin/RecoveryOfferSettings';
import {SITE_ORIGIN} from "@/lib/site-url";
import { useEffect, useState } from 'react';
import { resolveDeliveryPolicy } from '@/lib/shipping';
import AdminModal from '@/components/admin/AdminModal';
import { DashboardIcon } from '@/components/admin/DashboardMetrics';
import {setSessionReplayOptOut} from '@/lib/session-replay-client';
import { clientApi } from '@/lib/client-api';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';

function StoreForm({s,onSaved}:{s:any;onSaved:()=>Promise<unknown>}){const info=s['store.info']||{};return <SettingsForm label="Save store settings" onSave={async f=>{await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.info':{name:info.name||'Zelvomart',phone:String(f.get('phone')).trim(),email:String(f.get('email')).trim(),whatsapp:String(f.get('whatsapp')).trim(),country:'Pakistan',supportHours:String(f.get('supportHours')||'').trim()||'Open 24/7'},'store.bundleDefaultDiscountPercent':Number(f.get('bundle'))})},true);await onSaved();}}><p className="settings-section-note full">Contact details update across your storefront. The Buy 2 percentage applies to eligible bundles in the product page, cart and checkout.</p><label className="field"><span>Phone</span><input required type="tel" name="phone" defaultValue={info.phone||'0300-2026711'}/></label><label className="field"><span>Email</span><input required type="email" name="email" defaultValue={info.email||'support@zelvomart.com'}/></label><label className="field"><span>WhatsApp number</span><input required type="tel" name="whatsapp" defaultValue={info.whatsapp||'923002026711'}/></label><label className="field"><span>Support hours</span><input name="supportHours" maxLength={80} defaultValue={info.supportHours||'Open 24/7'}/></label><label className="field"><span>Buy 2 discount (%)</span><input required name="bundle" type="number" min="0" max="100" step="0.01" defaultValue={s['store.bundleDefaultDiscountPercent']??5}/></label></SettingsForm>}
function DeliveryForm({s,onSaved}:{s:any;onSaved:()=>Promise<unknown>}){const {flatRate,threshold}=resolveDeliveryPolicy(s['store.delivery']);return <SettingsForm label="Save delivery settings" onSave={async f=>{await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.delivery':{mode:'FREE_ABOVE',flatRate:Number(f.get('flatRate')),freeAbove:Number(f.get('freeAbove'))}})},true);await onSaved();}}><p className="settings-section-note full">One delivery policy for the announcement bar, FAQ, product page, cart and checkout. Orders at or above the threshold qualify before coupons; products marked Free shipping retain their own exemption.</p><label className="field"><span>Delivery charge (PKR)</span><input required name="flatRate" type="number" min="1" step="0.01" defaultValue={flatRate}/></label><label className="field"><span>Free delivery from (PKR)</span><input required name="freeAbove" type="number" min="1" step="0.01" defaultValue={threshold}/></label></SettingsForm>}
function TrackingForm({ s, onSaved }: { s: any; onSaved: () => void }) {
  const [excluded,setExcluded]=useState(false);
  useEffect(()=>setExcluded(localStorage.getItem('zm_session_replay_opt_out')==='1'),[]);
  const [message, setMessage] = useState('');


  async function submit(f: FormData) {
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

    await clientApi('/api/admin/settings', {method:'PUT',body:JSON.stringify(body)},true);
    await onSaved();
  }

  const metaPixelOn = s['tracking.metaPixelEnabled'] !== false && s['tracking.metaPixelEnabled'] !== 'false';
  const metaCapiOn = s['tracking.metaCapiEnabled'] !== false && s['tracking.metaCapiEnabled'] !== 'false';
  const tiktokPixelOn = s['tracking.tiktokPixelEnabled'] !== false && s['tracking.tiktokPixelEnabled'] !== 'false';
  const tiktokEventsApiOn = s['tracking.tiktokEventsApiEnabled'] !== false && s['tracking.tiktokEventsApiEnabled'] !== 'false';
  const replayOn = s['tracking.sessionReplayEnabled'] !== false && s['tracking.sessionReplayEnabled'] !== 'false';

  const hasMetaCapiToken = Boolean(s['tracking.metaCapiToken']);
  const hasTikTokToken = Boolean(s['tracking.tiktokEventsApiToken'] || s['tracking.tiktokAccessToken']);

  return (
    <SettingsForm label="Save tracking settings" onSave={submit}>
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
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Privacy-masked recordings. Scheduled cleanup requires the worker; the storage bucket lifecycle must also match this retention period.</p>

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
    </SettingsForm>
  );
}
function CitiesForm({cities,onSaved}:{cities:any[];onSaved:()=>Promise<unknown>}){return <SettingsForm label="Save cities and estimates" onSave={async f=>{const lines=String(f.get('cities')||'').split('\n').map(x=>x.trim()).filter(Boolean);if(!lines.length)throw new Error('Enter at least one city.');const rows=lines.map((line,index)=>{const parts=line.split('|').map(x=>x.trim());const [name,min,max]=parts;if(parts.length!==3||!name||!min||!max||!Number.isInteger(Number(min))||!Number.isInteger(Number(max))||Number(min)<1||Number(max)<Number(min)||Number(max)>90)throw new Error(`Line ${index+1}: use City | minimum days | maximum days (1-90).`);return{name,deliveryMinDays:Number(min),deliveryMaxDays:Number(max),active:true};});if(new Set(rows.map(row=>row.name.toLowerCase())).size!==rows.length)throw new Error('Each city must appear only once.');await clientApi('/api/admin/cities',{method:'PUT',body:JSON.stringify({cities:rows})},true);await onSaved();}}><p className="settings-section-note full">One city per line, for example Lahore | 2 | 4. Unlisted cities use 2-7 working days. Removing a city deactivates it from checkout; existing orders stay intact.</p><label className="field full"><span>City | Minimum days | Maximum days</span><textarea required name="cities" rows={12} defaultValue={cities.filter(c=>c.active).map(c=>`${c.name} | ${c.deliveryMinDays} | ${c.deliveryMaxDays}`).join('\n')}/></label></SettingsForm>}
export default function Settings(){const {data,loading,error,reload}=useAdminData<any>('/api/admin/settings',null);if(error)return <AdminError message={error}/>;if(loading||!data)return <AdminLoading/>;const s=data.settings||{};const saved=async()=>{clearAdminDataCache();await reload();};const cards=[['Recovery offers','Discount, message templates and 24-hour single-use recovery codes.',<RecoveryOfferSettings/>],['Store','Phone, email, WhatsApp, support hours and default bundle discount.',<StoreForm s={s} onSaved={saved}/>],['Delivery',`Every product pays Rs ${resolveDeliveryPolicy(s['store.delivery']).flatRate.toLocaleString('en-US')} delivery; orders from Rs ${resolveDeliveryPolicy(s['store.delivery']).threshold.toLocaleString('en-US')} ship free.`,<DeliveryForm s={s} onSaved={saved}/>],['Tracking & Feeds','Meta, TikTok, product feeds, and first-party Session Replay.',<TrackingForm s={s} onSaved={saved}/>],['Cities & estimates','Pakistan city list and delivery estimates.',<CitiesForm cities={data.cities||[]} onSaved={saved}/>]];return <><div className="dashboard-heading settings-page-heading"><div><span className="dashboard-eyebrow">STORE PREFERENCES</span><h1>Settings</h1><p>Saved settings stay in sync with your storefront, checkout and integrations.</p></div></div><div className="admin-settings-grid settings-dashboard-grid">{cards.map(([title,desc,form]:any, index:number)=><div className="admin-settings-card" key={title}><div className="settings-card-top"><span className={`dashboard-metric-icon ${["blue","purple","orange","teal","purple","green","blue"][index]}`}><DashboardIcon name={(["box","truck","eye","document"] as const)[index % 4]} /></span><span className="settings-card-category">{["MARKETING","GENERAL","FULFILMENT","INTEGRATIONS","LOCATIONS"][index]}</span></div><h2>{title}</h2><p>{desc}</p><AdminModal className="settings-modal" description={desc} trigger="Manage settings →" triggerClassName="settings-card-action" title={title} size="lg">{form}</AdminModal></div>)}</div></>}
