"use client";
import {useState, type ReactNode} from 'react';
import {notifySettingsSaved} from '@/lib/settings-sync';
import {clearAdminDataCache} from './useAdminData';

export default function SettingsForm({children,onSave,label='Save changes'}:{children:ReactNode;onSave:(form:FormData)=>Promise<unknown>;label?:string}){
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  return <form className="admin-reference-form settings-edit-form" aria-busy={saving} onChange={()=>setSaved(false)} onSubmit={async event=>{
    event.preventDefault();if(saving)return;
    const form=new FormData(event.currentTarget);setSaving(true);setError('');setSaved(false);
    try{await onSave(form);clearAdminDataCache();notifySettingsSaved();setSaved(true);}catch(error){setError(error instanceof Error?error.message:'Unable to save. Please try again.');}finally{setSaving(false);}
  }}>
    <fieldset className="settings-fields" disabled={saving}>{children}</fieldset>
    <div className="settings-save-bar"><div role="status" aria-live="polite">{error?<span className="settings-save-error">{error}</span>:saved?<span className="settings-save-success">✓ Saved successfully</span>:<span>Changes apply after saving.</span>}</div><button type="submit" className="settings-save-button" disabled={saving}>{saving?'Saving…':saved?'✓ Saved':label}<span aria-hidden="true">{saving?'':'→'}</span></button></div>
  </form>;
}
