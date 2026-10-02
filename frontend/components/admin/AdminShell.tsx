"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminNav from './AdminNav';
import { adminToken, adminUser, clearAdminSession, clientApi, setAdminUser } from '@/lib/client-api';
import { clearAdminDataCache, prefetchAdminData } from './useAdminData';

type User={id:string;name:string;email:string;role:string};
export default function AdminShell({children}:{children:React.ReactNode}){
 const router=useRouter();
 const [user,setUser]=useState<User|null>(null);

 useEffect(()=>{
   const token=adminToken();
   const cachedUser=adminUser<User>();
   if(cachedUser) setUser(cachedUser);
   if(!token){router.replace('/admin/login');return;}

   // Validate the saved session quietly. The admin shell stays visible instead of showing a blocking loader.
   clientApi<{user:User}>('/api/auth/me',{},true)
     .then(r=>{
       setUser(r.user);
       setAdminUser(r.user);
       prefetchAdminData('/api/admin/dashboard');
     })
     .catch(()=>{
       clearAdminSession();
       clearAdminDataCache();
       router.replace('/admin/login');
     });
 },[router]);

 const initials=useMemo(()=>((user?.name||user?.email||'A').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()),[user]);
 return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand-row"><Link href="/admin" className="admin-brand-mark">Z</Link><Link href="/admin" className="admin-brand-copy"><b>ZELVOMART</b><span>ADMIN PORTAL</span></Link></div><AdminNav/><div className="admin-sidebar-foot"><div className="admin-profile-mini"><span className="admin-avatar">{initials}</span><div><b>{user?.name||'Admin'}</b><small>{String(user?.role||'').replace(/_/g,' ')||'Store management'}</small></div></div><button className="admin-signout" onClick={()=>{clearAdminSession();clearAdminDataCache();router.replace('/admin/login')}}>↪ &nbsp; Sign out</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><span className="admin-topbar-kicker">Zelvomart</span><b>Store Management</b></div><div className="admin-topbar-actions"><Link href="/" className="admin-view-store">View Store ↗</Link><span className="admin-avatar">{initials}</span></div></header><main className="admin-main">{children}</main></div></div>;
}
