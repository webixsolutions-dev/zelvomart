"use client";
import Link from 'next/link';
import { useMemo,useState } from 'react';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';
import { adminFetch,clientApi } from '@/lib/client-api';
import { money } from '@/lib/format';

async function download(){const r=await adminFetch('/api/admin/orders/export.csv');const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='zelvomart-orders.csv';a.click();URL.revokeObjectURL(u)}
const statuses=['NEW','CONFIRMED','ON_HOLD','BOOKED','IN_TRANSIT','DELIVERED','RETURNED','CANCELLED','SETTLED'];

export default function Orders(){
  const [q,setQ]=useState('');const [status,setStatus]=useState('');const [city,setCity]=useState('');const [source,setSource]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const [selected,setSelected]=useState<string[]>([]);const [bulkStatus,setBulkStatus]=useState('');
  const query=useMemo(()=>{const p=new URLSearchParams();if(q)p.set('q',q);if(status)p.set('status',status);if(city)p.set('city',city);if(source)p.set('source',source);if(from)p.set('from',from);if(to)p.set('to',to);return p.toString()},[q,status,city,source,from,to]);
  const {data,loading,error,reload}=useAdminData<any[]>(`/api/admin/orders${query?`?${query}`:''}`,[]);
  if(loading)return <AdminLoading/>;if(error)return <AdminError message={error}/>;
  const allSelected=data.length>0&&data.every(o=>selected.includes(o.id));
  async function applyBulk(){if(!selected.length||!bulkStatus)return;await clientApi('/api/admin/orders/bulk-status',{method:'PATCH',body:JSON.stringify({ids:selected,status:bulkStatus})},true);setSelected([]);setBulkStatus('');reload()}
  return <>
    <div className="admin-title"><div><h1>Orders</h1><p>Search, filter, bulk update and manage COD orders.</p></div><button className="admin-btn admin-btn-light" onClick={download}>Export CSV</button></div>
    <div className="admin-filter-bar admin-filter-bar-extended">
      <input placeholder="Search order, customer or phone" value={q} onChange={e=>setQ(e.target.value)}/>
      <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>
      <input placeholder="City" value={city} onChange={e=>setCity(e.target.value)}/>
      <input placeholder="Source" value={source} onChange={e=>setSource(e.target.value)}/>
      <label className="admin-date-filter"><span>From</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="admin-date-filter"><span>To</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    </div>
    {selected.length?<div className="admin-bulk-bar"><b>{selected.length} selected</b><select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}><option value="">Change status…</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><button className="admin-btn admin-btn-primary" onClick={applyBulk} disabled={!bulkStatus}>Apply</button><button className="admin-btn admin-btn-light" onClick={()=>setSelected([])}>Clear</button></div>:null}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={e=>setSelected(e.target.checked?data.map(o=>o.id):[])}/></th><th>Order</th><th>Date</th><th>Customer</th><th>Phone</th><th>City</th><th>Source</th><th>Status</th><th>Total</th><th>Flags</th></tr></thead><tbody>{data.map(o=><tr key={o.id}><td><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>setSelected(v=>e.target.checked?[...new Set([...v,o.id])]:v.filter(id=>id!==o.id))}/></td><td><Link className="admin-order-link" href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></td><td>{new Date(o.createdAt).toLocaleString('en-PK')}</td><td>{o.fullName}</td><td>{o.phone}</td><td>{o.city}</td><td>{o.source||'Direct'}</td><td>{String(o.status).replace(/_/g,' ')}</td><td>{money(o.total)}</td><td>{o.possibleDuplicate?'Duplicate ':''}{o.blocklistedAtOrder?'Blocked':''}</td></tr>)}</tbody></table></div>
  </>;
}
