"use client";
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { useAdminData, AdminLoading, AdminError } from './useAdminData';
import { toast } from 'react-toastify';

export default function RecoveryOfferSettings() {
  const { data, loading, error, reload } = useAdminData<any>('/api/admin/recovery/templates', null);
  const [saving, setSaving] = useState(false);
  if (loading) return <AdminLoading/>;
  if (error) return <AdminError message={error}/>;
  return <form className="admin-reference-form" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await clientApi('/api/admin/recovery/templates', { method: 'PUT', body: JSON.stringify({ ...data, discountPercent: form.get('discountPercent'), enabled: form.get('enabled') === 'on' ? 'true' : 'false' }) }, true);
      toast.success('Recovery offer settings saved.');
      await reload();
    } catch { /* API client displays the error toast. */ }
    finally { setSaving(false); }
  }}>
    <label className="field"><span>Default recovery discount (%)</span><input required name="discountPercent" type="number" min="1" max="100" step="0.01" defaultValue={data?.discountPercent ?? 5}/></label>
    <label className="field"><span><input type="checkbox" name="enabled" defaultChecked={data?.enabled !== 'false'}/> Enable recovery offers</span></label>
    <p className="full">Each cart gets a single-use code valid for 24 hours from its first draft. Changes apply to new codes; existing codes keep their original discount and expiry. Sending requires a configured email provider. Offers are sent from the abandoned carts page.</p>
    {data?.coupon && <p className="full">A custom coupon ({data.coupon}) currently overrides this percentage. Clear it under Customers → Abandoned carts → Templates to use this default.</p>}
    <button className="admin-reference-submit" disabled={saving}>{saving ? 'Saving…' : 'Save recovery settings'}</button>
  </form>;
}
