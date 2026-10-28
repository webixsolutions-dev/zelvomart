"use client";
import "@/components/admin/catalog-pages.css";
import AdminListView from "@/components/admin/AdminListView";
import AdminTable from '@/components/admin/AdminTable';

import AdminModal from '@/components/admin/AdminModal';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { friendlyError } from '@/lib/app-errors';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';

function UserForm({onSaved}:{onSaved:()=>void}){
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=e.currentTarget,f=new FormData(form);
    setBusy(true);setError('');
    try{
      await clientApi('/api/admin/users',{method:'POST',body:JSON.stringify({name:f.get('name'),email:f.get('email'),password:f.get('password'),role:f.get('role'),active:true})},true);
      form.reset();onSaved();
    }catch(error){setError(friendlyError(error));}
    finally{setBusy(false);}
  }
  return <form className="admin-reference-form catalog-form" onSubmit={submit} aria-busy={busy}>
    <label className="field"><span>Name</span><input name="name" required/></label>
    <label className="field"><span>Email</span><input name="email" type="email" required/></label>
    <label className="field"><span>Password</span><input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required/></label>
    <label className="field"><span>Role</span><select name="role"><option value="OWNER">Owner</option><option value="MANAGER">Manager</option><option value="ORDER_AGENT">Order agent</option><option value="MARKETER">Marketer</option></select></label>
    <button className="admin-reference-submit" disabled={busy}>{busy?'Adding…':'Add User'}</button>
    {error?<p role="alert" style={{gridColumn:'1 / -1'}}>{error}</p>:null}
  </form>
}

const PASSWORD_MIN=10;

/** Sets a new password for a team member. Every session of theirs ends; tell them the new password in person. */
function ResetPasswordForm({user,onSaved}:{user:any;onSaved:()=>void}){
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=e.currentTarget,f=new FormData(form),password=String(f.get('password')||'');
    if(password.length<PASSWORD_MIN)return setMessage(`The password needs at least ${PASSWORD_MIN} characters.`);
    if(password!==String(f.get('confirm')||''))return setMessage('The two passwords don’t match.');
    setBusy(true);setMessage('');
    try{await clientApi(`/api/admin/users/${user.id}`,{method:'PATCH',body:JSON.stringify({password})},true);form.reset();setMessage(`Password reset. ${user.name} has been signed out everywhere and signs in with the new password.`);onSaved();}
    catch(err){setMessage(err instanceof Error?err.message:'Could not reset the password.');}
    finally{setBusy(false);}
  }
  return <form className="admin-reference-form catalog-form" onSubmit={submit} aria-busy={busy}>
    <p style={{gridColumn:'1 / -1'}}>New password for <strong>{user.name}</strong> ({user.email}). Share it with them directly, never by email or chat.</p>
    <label className="field"><span>New password</span><input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={200} required/></label>
    <label className="field"><span>Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={200} required/></label>
    <button className="admin-reference-submit" disabled={busy}>{busy?'Saving…':'Reset password'}</button>
    {message?<p role="status" style={{gridColumn:'1 / -1'}}>{message}</p>:null}
  </form>
}

export default function Users(){
  const {data,loading,error,reload}=useAdminData<any[]>('/api/admin/users',[]);
  if(loading)return <AdminLoading/>;
  if(error)return <AdminError message={error}/>;
  async function toggle(u:any){await clientApi(`/api/admin/users/${u.id}`,{method:'PATCH',body:JSON.stringify({active:!u.active})},true);reload()}
  async function resetTwoFactor(u:any){if(!window.confirm(`Reset two-factor sign-in for ${u.name}? They can sign in with their password only, and turn it on again in Security.`))return;await clientApi(`/api/admin/users/${u.id}`,{method:'PATCH',body:JSON.stringify({resetTwoFactor:true})},true);reload()}
  return <div className="admin-catalog-page">
    <div className="admin-title"><div><h1>Users & Roles</h1><p>Manage Owner, Manager, Order Agent and Marketer accounts. Sign-in uses email and password, plus a code from an authenticator app for anyone who turned on two-factor sign-in.</p></div><AdminModal className="catalog-modal" trigger={<>＋ Add Staff User</>} title="Add Staff User"><UserForm onSaved={reload}/></AdminModal></div>
    <div className="admin-list-container"><AdminListView rows={data} label="Team members" paginationStyle="products" search={r=>`${r.name||''} ${r.email||''} ${r.role||''}`} searchHint="Search name, email or role" sorts={[{label:'Name',value:r=>r.name||''},{label:'Email',value:r=>r.email||''}]} filters={[{label:'Role',value:r=>r.role},{label:'Status',value:r=>r.active?'Active':'Disabled'},{label:'2FA',value:r=>r.twoFactorReady?'On':'Off'}]} metrics={[{label:'Team members',value:r=>r.length},{label:'Active',value:r=>r.filter(c=>c.active).length},{label:'Disabled',value:r=>r.filter(c=>!c.active).length},{label:'Roles in use',value:r=>new Set(r.map(c=>c.role)).size}]} onRefresh={reload}>{visibleRows=>(<AdminTable scrollLabel="Users" className="admin-modern-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>2FA</th><th>Actions</th></tr></thead><tbody>{visibleRows.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{String(u.role).replace(/_/g,' ')}</td><td>{u.active?'Active':'Disabled'}</td><td>{u.twoFactorReady?'On':'Off'}</td><td><div className="admin-row-actions"><button className="admin-btn admin-btn-light" onClick={()=>toggle(u)}>{u.active?'Disable':'Enable'}</button><AdminModal size="md" triggerClassName="admin-btn admin-btn-light" trigger="Reset password" title="Reset password"><ResetPasswordForm user={u} onSaved={reload}/></AdminModal>{u.twoFactorReady?<button className="admin-btn admin-btn-light" onClick={()=>resetTwoFactor(u)}>Reset 2FA</button>:null}</div></td></tr>)}</tbody></AdminTable>)}</AdminListView></div>
  </div>;
}
