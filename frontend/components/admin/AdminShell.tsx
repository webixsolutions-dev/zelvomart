"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminNav from './AdminNav';
import { clearAdminSession, clientApi } from '@/lib/client-api';

type User={id:string;name:string;email:string;role:string};
export default function AdminShell({children}:{children:React.ReactNode}){
 const router=useRouter(); const [user,setUser]=useState<User|null>(null); const [ready,setReady]=useState(false);
 useEffect(()=>{clientApi<{user:User}>('/api/auth/me',{},true).then(r=>{setUser(r.user);setReady(true)}).catch(()=>{clearAdminSession();router.replace('/admin/login')});},[router]);
 const initials=useMemo(()=>((user?.name||user?.email||'A').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()),[user]);
 if(!ready)return <div className="admin-login-page"><div className="admin-login-card"><div className="admin-login-copy"><span>Zelvomart</span><h1>Loading admin portal…</h1></div></div></div>;
 return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand-row"><Link href="/admin" className="admin-brand-mark">Z</Link><Link href="/admin" className="admin-brand-copy"><b>ZELVOMART</b><span>ADMIN PORTAL</span></Link></div><AdminNav/><div className="admin-sidebar-foot"><div className="admin-profile-mini"><span className="admin-avatar">{initials}</span><div><b>{user?.name||'Admin'}</b><small>{String(user?.role||'').replace(/_/g,' ')}</small></div></div><button className="admin-signout" onClick={()=>{clearAdminSession();router.replace('/admin/login')}}>Sign out</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><span className="admin-topbar-kicker">Zelvomart</span><b>Store Management</b></div><div className="admin-topbar-actions"><Link href="/" className="admin-view-store">View Store ↗</Link><span className="admin-avatar">{initials}</span></div></header><main className="admin-main">{children}</main></div></div>;
}
