"use client";
import { clientApi } from '@/lib/client-api';
import { useAdminData, AdminLoading, AdminError } from './useAdminData';
import SettingsForm from './SettingsForm';

export default function RecoveryOfferSettings() {
  const { data, loading, error, reload } = useAdminData<any>('/api/admin/recovery/templates', null);
  if (loading) return <AdminLoading/>;
  if (error) return <AdminError message={error}/>;
  return <SettingsForm label="Save recovery settings" onSave={async form=>{
    await clientApi('/api/admin/recovery/templates',{method:'PUT',body:JSON.stringify({...data,discountPercent:form.get('discountPercent'),enabled:form.get('enabled')==='on'?'true':'false',coupon:String(form.get('coupon')||'').trim(),subject:String(form.get('subject')||''),email:String(form.get('email')||''),whatsapp:String(form.get('whatsapp')||'')})},true);
    await reload();
  }}>
    <label className="field"><span>Default recovery discount (%)</span><input required name="discountPercent" type="number" min="1" max="100" step="0.01" defaultValue={data?.discountPercent ?? 5}/></label>
    <label className="field"><span><input type="checkbox" name="enabled" defaultChecked={data?.enabled !== 'false'}/> Enable recovery offers</span></label>
    <p className="full">Each cart gets a single-use code valid for 24 hours from its first draft. Changes apply to new codes; existing codes keep their original discount and expiry. Sending requires a configured email provider. Offers are sent from the abandoned carts page.</p>
    {data?.coupon && <p className="full">A custom coupon ({data.coupon}) currently overrides this percentage. Clear the override below to use this percentage.</p>}
<label className="field full"><span>Coupon override (optional)</span><input name="coupon" defaultValue={data?.coupon||''} placeholder="Leave blank to use the percentage above"/></label>
    <label className="field full"><span>Offer email subject</span><input required name="subject" defaultValue={data?.subject||''}/></label>
    <label className="field full"><span>Offer email template</span><textarea required name="email" rows={7} defaultValue={data?.email||''}/></label>
    <label className="field full"><span>WhatsApp message template</span><textarea required name="whatsapp" rows={5} defaultValue={data?.whatsapp||''}/></label>
    <p className="settings-section-note full">Template placeholders: {'{name}, {product}, {coupon}, {discount}, {expiry}, {cart_link}'}. WhatsApp opens a draft for your team to send.</p>
  </SettingsForm>;
}
