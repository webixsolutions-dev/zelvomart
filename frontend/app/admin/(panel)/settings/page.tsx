"use client";
import { useState } from 'react';
import { DEFAULT_DELIVERY_CHARGE, FREE_SHIPPING_ABOVE, resolveDeliveryPolicy } from '@/lib/shipping';
import AdminModal from '@/components/admin/AdminModal';
import { clientApi } from '@/lib/client-api';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';

function StoreForm({s,onSaved}:{s:any;onSaved:()=>void}){const info=s['store.info']||{};async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.info':{name:'Zelvomart',phone:f.get('phone'),email:f.get('email'),whatsapp:f.get('whatsapp'),country:'Pakistan'},'store.minimumSellingPrice':Number(f.get('minimum')||1000),'store.bundleDefaultDiscountPercent':Number(f.get('bundle')||5)})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><label className="field"><span>Phone</span><input name="phone" defaultValue={info.phone||'0300-2026711'}/></label><label className="field"><span>Email</span><input name="email" defaultValue={info.email||'zelvomart@gmail.com'}/></label><label className="field"><span>WhatsApp number</span><input name="whatsapp" defaultValue={info.whatsapp||'923002026711'}/></label><label className="field"><span>Minimum selling price</span><input name="minimum" type="number" defaultValue={s['store.minimumSellingPrice']??1000}/></label><label className="field"><span>Default Buy 2 discount %</span><input name="bundle" type="number" defaultValue={s['store.bundleDefaultDiscountPercent']??5}/></label><button className="admin-reference-submit">Save Store Settings</button></form>}
function AnnouncementForm({s,onSaved}:{s:any;onSaved:()=>void}){const a=s['store.announcement']||{enabled:true,items:[]};async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.announcement':{enabled:f.get('enabled')==='on',items:String(f.get('items')||'').split('\n').map(x=>x.trim()).filter(Boolean)}})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><label className="admin-check full"><input type="checkbox" name="enabled" defaultChecked={a.enabled!==false}/> Enabled</label><label className="field full"><span>Messages — one per line</span><textarea name="items" rows={6} defaultValue={(a.items||[]).join('\n')}/></label><button className="admin-reference-submit">Save Announcement Bar</button></form>}
function DeliveryForm({s,onSaved}:{s:any;onSaved:()=>void}){const d=s['store.delivery']||{};const {flatRate:charge,threshold:freeAbove}=resolveDeliveryPolicy(d);async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);/* Never saved as free: an empty or zero charge is stored as DEFAULT_DELIVERY_CHARGE (lib/shipping.ts). */await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'store.delivery':{mode:'FREE_ABOVE',flatRate:Number(f.get('flatRate'))>0?Number(f.get('flatRate')):DEFAULT_DELIVERY_CHARGE,freeAbove:Number(f.get('freeAbove'))>0?Number(f.get('freeAbove')):FREE_SHIPPING_ABOVE,codFee:Math.max(0,Number(f.get('codFee')||0))}})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><p className="admin-inline-note full">Every product pays this delivery charge. Delivery is free only when the order total is above the free-above amount, or when every product in the order has Free shipping turned on (product → Shipping tab). These values are used on the product page, cart, checkout and the saved order.</p><label className="field"><span>Delivery charge (Rs)</span><input name="flatRate" type="number" min="1" defaultValue={charge}/></label><label className="field"><span>Free above (Rs)</span><input name="freeAbove" type="number" min="1" defaultValue={freeAbove}/></label><label className="field"><span>COD fee</span><input name="codFee" type="number" min="0" defaultValue={d.codFee||0}/></label><button className="admin-reference-submit">Save Delivery Settings</button></form>}
function CheckoutForm({s,onSaved}:{s:any;onSaved:()=>void}){const r=s['checkout.requiredFields']||{};const keys=['fullName','phone','email','city','address','postcode','orderNotes','terms'];async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'checkout.requiredFields':Object.fromEntries(keys.map(k=>[k,f.get(k)==='on']))})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><div className="admin-check-grid full">{keys.map(k=><label className="admin-check" key={k}><input type="checkbox" name={k} defaultChecked={Boolean(r[k])}/>{k.replace(/([A-Z])/g,' $1')}</label>)}</div><button className="admin-reference-submit">Save Checkout Fields</button></form>}
function TrackingForm({ s, onSaved }: { s: any; onSaved: () => void }) {
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

      'tracking.clarityEnabled': f.get('clarityEnabled') === 'on',
      'tracking.clarityId': String(f.get('clarityId') || '').trim(),

      'tracking.sessionReplayEnabled': f.get('sessionReplayEnabled') === 'on',
      'tracking.sessionReplayRetentionDays': Math.max(1, Math.min(90, Number(f.get('sessionReplayRetentionDays') || 14))),
    };

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
  const clarityOn = s['tracking.clarityEnabled'] !== false && s['tracking.clarityEnabled'] !== 'false';
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

      {/* Microsoft Clarity */}
      <div className="full" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>Microsoft Clarity</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Session heatmaps and behaviour recording.</p>

        <label className="admin-check full" style={{ marginBottom: 10 }}>
          <input type="checkbox" name="clarityEnabled" defaultChecked={clarityOn} />
          <strong>Enable Microsoft Clarity</strong>
        </label>
        <label className="field full">
          <span>Clarity Project ID</span>
          <input name="clarityId" defaultValue={s['tracking.clarityId'] || ''} placeholder="e.g. abcd1234ef" />
        </label>
      </div>

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
function NotificationForm({s,onSaved}:{s:any;onSaved:()=>void}){
 const defaultTeam=`<h2>New order {{orderNumber}}</h2>\n<p><strong>{{customerName}}</strong> • {{phone}}</p>\n<p>{{city}}<br/>{{address}}</p>\n<p>{{items}}</p>\n<p><strong>Total: {{total}}</strong></p>\n<p>Source: {{source}}</p>\n<p><a href="{{adminUrl}}">Open order in admin</a></p>`;
 const defaultCustomer=`<h2>Thanks for your order, {{customerName}}.</h2>\n<p>Your order number is <strong>{{orderNumber}}</strong>.</p>\n<ul>{{items}}</ul>\n<p><strong>Total: {{total}}</strong></p>\n<p>Cash on Delivery: pay cash when your parcel arrives.</p>`;
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await clientApi('/api/admin/settings',{method:'PUT',body:JSON.stringify({'notifications.orderRecipients':String(f.get('recipients')||'').split(/[\n,]/).map(x=>x.trim()).filter(Boolean),'notifications.teamOrderTemplate':String(f.get('teamTemplate')||''),'notifications.customerOrderTemplate':String(f.get('customerTemplate')||'')})},true);onSaved()}
 return <form className="admin-reference-form" onSubmit={submit}><label className="field full"><span>Order & failure alert recipients — one per line</span><textarea name="recipients" rows={5} defaultValue={(s['notifications.orderRecipients']||[]).join('\n')}/></label><label className="field full"><span>Team new-order email HTML</span><textarea name="teamTemplate" rows={10} defaultValue={s['notifications.teamOrderTemplate']||defaultTeam}/></label><label className="field full"><span>Customer confirmation email HTML</span><textarea name="customerTemplate" rows={10} defaultValue={s['notifications.customerOrderTemplate']||defaultCustomer}/></label><div className="admin-inline-note full">Supported placeholders: {"{{orderNumber}}"}, {"{{customerName}}"}, {"{{phone}}"}, {"{{city}}"}, {"{{address}}"}, {"{{items}}"}, {"{{total}}"}, {"{{source}}"}, {"{{adminUrl}}"}.</div><button className="admin-reference-submit">Save Notification Settings</button></form>
}
function CitiesForm({cities,onSaved}:{cities:any[];onSaved:()=>void}){async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const lines=String(f.get('cities')||'').split('\n').map(x=>x.trim()).filter(Boolean);const rows=lines.map(line=>{const [name,min,max]=line.split('|').map(x=>x.trim());return{name,deliveryMinDays:Number(min||2),deliveryMaxDays:Number(max||5),active:true}});await clientApi('/api/admin/cities',{method:'PUT',body:JSON.stringify({cities:rows})},true);onSaved()}return <form className="admin-reference-form" onSubmit={submit}><label className="field full"><span>Cities — Name | Min days | Max days</span><textarea name="cities" rows={14} defaultValue={cities.map(c=>`${c.name} | ${c.deliveryMinDays} | ${c.deliveryMaxDays}`).join('\n')}/></label><button className="admin-reference-submit">Save Cities</button></form>}
export default function Settings(){const {data,loading,error,reload}=useAdminData<any>('/api/admin/settings',{settings:{},cities:[]});if(loading)return <AdminLoading/>;if(error)return <AdminError message={error}/>;const s=data.settings||{};const cards=[['Store','Phone, email, WhatsApp, minimum price and bundle discount.',<StoreForm s={s} onSaved={reload}/>],['Announcement bar','Manage the moving top bar messages.',<AnnouncementForm s={s} onSaved={reload}/>],['Delivery',`Every product pays Rs ${resolveDeliveryPolicy(s['store.delivery']).flatRate.toLocaleString('en-US')} delivery; orders above Rs ${resolveDeliveryPolicy(s['store.delivery']).threshold.toLocaleString('en-US')} ship free.`,<DeliveryForm s={s} onSaved={reload}/>],['Checkout fields','Control which checkout fields are required.',<CheckoutForm s={s} onSaved={reload}/>],['Tracking, Pixels & Conversion APIs','Meta Pixel & CAPI, TikTok Pixel & Events API, Clarity, and Session Replay.',<TrackingForm s={s} onSaved={reload}/>],['Notifications','Order alert recipient emails.',<NotificationForm s={s} onSaved={reload}/>],['Cities & estimates','Pakistan city list and delivery estimates.',<CitiesForm cities={data.cities||[]} onSaved={reload}/>]];return <><div className="admin-title"><div><h1>Settings</h1><p>Store info, delivery, checkout, tracking, CRO and notifications.</p></div></div><div className="admin-settings-grid">{cards.map(([title,desc,form]:any)=><div className="admin-settings-card" key={title}><span className="admin-settings-icon">⚙</span><h2>{title}</h2><p>{desc}</p><AdminModal trigger="Open Settings" triggerClassName="admin-btn admin-btn-light" title={title} size="lg">{form}</AdminModal></div>)}</div></>}
