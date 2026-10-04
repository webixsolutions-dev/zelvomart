"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminNav from './AdminNav';
import { clientApi, logoutAdminSession } from '@/lib/client-api';
import { clearAdminDataCache, prefetchAdminData } from './useAdminData';

type User={id:string;name:string;email:string;role:string};

export default function AdminShell({children}:{children:React.ReactNode}){
 const router=useRouter();
 const pathname=usePathname();
 const [user,setUser]=useState<User|null>(null);
 const [checking,setChecking]=useState(true);

 useEffect(()=>{
   let active=true;
   setChecking(true);
   clientApi<{user:User}>('/api/auth/me',{},true)
     .then(r=>{
       if(!active)return;
       setUser(r.user);
       setChecking(false);
       if(r.user.role!=='MARKETER') prefetchAdminData('/api/admin/dashboard');
     })
     .catch(async()=>{
       if(!active)return;
       clearAdminDataCache();
       await logoutAdminSession();
       router.replace('/admin/login');
     });
   return()=>{active=false};
 },[router]);

 useEffect(()=>{
   if(user?.role==='MARKETER' && pathname==='/admin') router.replace('/admin/reports');
 },[user,pathname,router]);

 const initials=useMemo(()=>((user?.name||user?.email||'A').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()),[user]);

 if(checking || !user){
   return <div className="admin-auth-check"><div className="admin-auth-check-card"><span className="admin-login-mark">Z</span><div><b>Checking admin session…</b><small>Please wait</small></div></div></div>;
 }

 async function signOut(){
   clearAdminDataCache();
   await logoutAdminSession();
   router.replace('/admin/login');
   router.refresh();
 }

 return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand-row"><Link href="/admin" className="admin-brand-mark">Z</Link><Link href="/admin" className="admin-brand-copy"><b>ZELVOMART</b><span>ADMIN PORTAL</span></Link></div><AdminNav role={user.role}/><div className="admin-sidebar-foot"><div className="admin-profile-mini"><span className="admin-avatar">{initials}</span><div><b>{user.name||'Admin'}</b><small>{String(user.role||'').replace(/_/g,' ')||'Store management'}</small></div></div><button className="admin-signout" onClick={signOut}>↪ &nbsp; Sign out</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><span className="admin-topbar-kicker">Zelvomart</span><b>Store Management</b></div><div className="admin-topbar-actions"><Link href="/" className="admin-view-store">View Store ↗</Link><span className="admin-avatar">{initials}</span></div></header><main className="admin-main">{children}</main></div></div>;
}
