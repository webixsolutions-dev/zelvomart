"use client";
import AdminTable from '@/components/admin/AdminTable';

import AdminModal from '@/components/admin/AdminModal';
import { clientApi } from '@/lib/client-api';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';

function UserForm({onSaved}:{onSaved:()=>void}){
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    await clientApi('/api/admin/users',{method:'POST',body:JSON.stringify({name:f.get('name'),email:f.get('email'),password:f.get('password'),role:f.get('role'),active:true})},true);
    onSaved();
  }
  return <form className="admin-reference-form" onSubmit={submit}>
    <label className="field"><span>Name</span><input name="name" required/></label>
    <label className="field"><span>Email</span><input name="email" type="email" required/></label>
    <label className="field"><span>Password</span><input name="password" type="password" minLength={8} required/></label>
    <label className="field"><span>Role</span><select name="role"><option value="OWNER">Owner</option><option value="MANAGER">Manager</option><option value="ORDER_AGENT">Order agent</option><option value="MARKETER">Marketer</option></select></label>
    <button className="admin-reference-submit">Add User</button>
  </form>
}

export default function Users(){
  const {data,loading,error,reload}=useAdminData<any[]>('/api/admin/users',[]);
  if(loading)return <AdminLoading/>;
  if(error)return <AdminError message={error}/>;
  async function toggle(u:any){await clientApi(`/api/admin/users/${u.id}`,{method:'PATCH',body:JSON.stringify({active:!u.active})},true);reload()}
  return <>
    <div className="admin-title"><div><h1>Users & Roles</h1><p>Manage Owner, Manager, Order Agent and Marketer accounts. Sign-in uses email and password with a secure server session.</p></div><AdminModal trigger={<>＋ Add Staff User</>} title="Add Staff User"><UserForm onSaved={reload}/></AdminModal></div>
    <div className="admin-table-wrap"><AdminTable scrollLabel="Users" className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>{data.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{String(u.role).replace(/_/g,' ')}</td><td>{u.active?'Active':'Disabled'}</td><td><div className="admin-row-actions"><button className="admin-btn admin-btn-light" onClick={()=>toggle(u)}>{u.active?'Disable':'Enable'}</button></div></td></tr>)}</tbody></AdminTable></div>
  </>;
}
