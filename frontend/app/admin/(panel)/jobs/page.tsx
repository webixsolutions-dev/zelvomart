"use client";
import {notifyError} from '@/lib/app-errors';
import AdminTable from '@/components/admin/AdminTable';

import { useAdminData,AdminLoading,AdminError } from '@/components/admin/useAdminData';
import {clientApi} from "@/lib/client-api";
export default function Jobs(){const {data,loading,error,reload}=useAdminData<any[]>('/api/admin/jobs',[]);if(loading)return <AdminLoading/>;if(error)return <AdminError message={error}/>;return <><div className="admin-title"><div><h1>Background Jobs</h1><p>Email, tracking and integration job history from the backend.</p></div></div><div className="admin-table-wrap"><AdminTable scrollLabel="Jobs" className="admin-table"><thead><tr><th>Time</th><th>Job</th><th>Status</th><th>Attempts</th><th>Order</th><th>Error</th><th>Retry</th></tr></thead><tbody>{data.map(j=><tr key={j.id}><td>{new Date(j.createdAt).toLocaleString('en-PK')}</td><td>{j.name}</td><td>{j.status}</td><td>{j.attempts}</td><td>{j.orderId||'—'}</td><td style={{maxWidth:360,whiteSpace:'normal'}}>{j.error||'—'}</td><td>{['FAILED','SKIPPED','QUEUED'].includes(j.status)&&<button className="admin-btn admin-btn-light" onClick={async()=>{try{await clientApi(`/api/admin/jobs/${j.id}/retry`,{method:'POST'},true);await reload()}catch(error){notifyError(error)}}}>Retry</button>}</td></tr>)}</tbody></AdminTable></div></>}
