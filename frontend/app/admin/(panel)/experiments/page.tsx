"use client";
import AdminTable from '@/components/admin/AdminTable';

import AdminModal from '@/components/admin/AdminModal';
import { clientApi } from '@/lib/client-api';
import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';

function Form({onSaved}:{onSaved:()=>void}){
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const a=Math.max(1,Math.min(99,Number(f.get('splitA')||50)));
    await clientApi('/api/admin/experiments',{method:'POST',body:JSON.stringify({name:f.get('name'),pagePattern:f.get('pagePattern'),variants:['A','B'],trafficSplit:{A:a,B:100-a},status:'DRAFT'})},true);
    onSaved();
  }
  return <form className="admin-reference-form" onSubmit={submit}>
    <label className="field"><span>Name</span><input name="name" required/></label>
    <label className="field"><span>Page pattern</span><input name="pagePattern" placeholder="/product/example/ or /product/*" required/></label>
    <label className="field"><span>Variant A traffic %</span><input name="splitA" type="number" min="1" max="99" defaultValue="50"/></label>
    <button className="admin-reference-submit">Create Experiment</button>
  </form>
}

export default function Experiments(){
  const {data,loading,error,reload}=useAdminData<any[]>('/api/admin/experiments',[]);
  if(loading)return <AdminLoading/>;
  if(error)return <AdminError message={error}/>;
  async function status(id:string,value:string){await clientApi(`/api/admin/experiments/${id}`,{method:'PATCH',body:JSON.stringify({status:value})},true);reload()}
  return <>
    <div className="admin-title"><div><h1>Experiments</h1><p>A/B testing assignments persist for 30 days, are tagged in Clarity and are saved on each order.</p></div><AdminModal trigger={<>＋ Create Experiment</>} title="Create Experiment"><Form onSaved={reload}/></AdminModal></div>
    <div className="admin-table-wrap"><AdminTable scrollLabel="Experiments" className="admin-table"><thead><tr><th>Name</th><th>Page</th><th>Status</th><th>Traffic split</th><th>Results by variant</th><th></th></tr></thead><tbody>{data.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.pagePattern}</td><td>{r.status}</td><td>{Object.entries(r.trafficSplit||{}).map(([k,v])=>`${k} ${v}%`).join(' / ')||'—'}</td><td>{Object.entries(r.report||{}).map(([k,v]:any)=>`${k}: ${v.visitors||0} visitors / ${v.orders||0} orders / ${Number(v.orderRate||0).toFixed(1)}%`).join(' • ')||'No exposure data yet'}</td><td><select value={r.status} onChange={e=>status(r.id,e.target.value)}><option>DRAFT</option><option>RUNNING</option><option>PAUSED</option><option>ENDED</option></select></td></tr>)}</tbody></AdminTable></div>
    <div className="admin-card" style={{marginTop:18}}><h2>Experiment rules</h2><p style={{fontSize:12,lineHeight:1.7}}>Only one RUNNING experiment is allowed for the same page pattern. Visitors keep the same variant through a first-party cookie. The assigned variant is attached to checkout orders and sent to Microsoft Clarity as a session tag.</p></div>
  </>;
}
