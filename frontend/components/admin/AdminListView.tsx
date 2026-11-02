"use client";
import {useState,type ReactNode} from 'react';
import './admin-list-view.css';

export type ListMetric<T>={label:string;value:(rows:T[])=>string|number};
export default function AdminListView<T>({rows,label,search,searchHint,filters=[],sorts=[],metrics=[],onRefresh,paginationStyle="compact",children}:{
 rows:T[];label:string;search:(row:T)=>string;searchHint:string;
 filters?:{label:string;value:(row:T)=>string}[];
 sorts?:{label:string;value:(row:T)=>string|number}[];
 metrics?:ListMetric<T>[];onRefresh?:()=>unknown;paginationStyle?:"compact"|"products";children:(rows:T[])=>ReactNode;
}){
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<Record<string,string>>({}),[sort,setSort]=useState('original'),[page,setPage]=useState(1),[size,setSize]=useState(10),[refreshing,setRefreshing]=useState(false);
 const filtered=rows.filter(row=>search(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&filters.every(f=>!selected[f.label]||f.value(row)===selected[f.label]));
 const [index,direction]=sort.split(':');const sorter=sorts[Number(index)];
 const ordered=sorter?[...filtered].sort((a,b)=>{const av=sorter.value(a),bv=sorter.value(b);return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true}))*(direction==='desc'?-1:1)}):filtered;
 const pages=Math.max(1,Math.ceil(ordered.length/size)),current=Math.min(page,pages),visible=ordered.slice((current-1)*size,current*size),active=!!query||Object.values(selected).some(Boolean);
 const maxPageButtons=5;let firstPage=Math.max(1,current-Math.floor(maxPageButtons/2));let lastPage=Math.min(pages,firstPage+maxPageButtons-1);if(lastPage-firstPage+1<maxPageButtons)firstPage=Math.max(1,lastPage-maxPageButtons+1);const pageNumbers=Array.from({length:lastPage-firstPage+1},(_,index)=>firstPage+index);
 async function refresh(){setRefreshing(true);try{await onRefresh?.()}finally{setRefreshing(false)}}
 return <div className="admin-list-view">
  {!!metrics.length&&<div className="admin-list-metrics" aria-label={`${label} summary`}>{metrics.map((m,i)=><article key={m.label}><span className={`admin-list-metric-icon tone-${i%4}`} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 15v-3m4 3V8m4 7v-5"/></svg></span><div><span>{m.label}</span><strong>{m.value(rows)}</strong></div></article>)}</div>}
  <section className="admin-list-panel" aria-label={`${label} list`}>
   <header className="admin-list-header"><div><h2>{label}</h2><p>{rows.length.toLocaleString()} {rows.length===1?'record':'records'} in the loaded data</p></div>{onRefresh&&<button type="button" className="admin-btn admin-btn-light" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'Refreshing…':'↻ Refresh'}</button>}</header>
   <div className="admin-list-toolbar"><label className="admin-list-search"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" aria-label={`Search ${label}`} placeholder={searchHint} value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label>
    {filters.map(f=><label key={f.label}><span>{f.label}</span><select value={selected[f.label]||''} onChange={e=>{setSelected({...selected,[f.label]:e.target.value});setPage(1)}}><option value="">All {f.label.toLowerCase()==='status'?'statuses':f.label.toLowerCase()==='type'?'types':f.label.toLowerCase()==='role'?'roles':f.label.toLowerCase()==='job'?'jobs':f.label.toLowerCase()}</option>{[...new Set(rows.map(f.value).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>)}
    {!!sorts.length&&<label><span>Sort by</span><select value={sort} onChange={e=>{setSort(e.target.value);setPage(1)}}><option value="original">Default order</option>{sorts.flatMap((s,i)=>[<option key={`${i}:asc`} value={`${i}:asc`}>{s.label} ↑</option>,<option key={`${i}:desc`} value={`${i}:desc`}>{s.label} ↓</option>])}</select></label>}
    {active&&<button type="button" className="admin-btn admin-btn-light" onClick={()=>{setQuery('');setSelected({});setPage(1)}}>Clear filters</button>}
   </div>
   <div className="admin-list-results" aria-live="polite">{filtered.length.toLocaleString()} matching {filtered.length===1?'record':'records'}{active?' · filters applied':''}</div>
   {visible.length?children(visible):<div className="admin-list-empty"><strong>{rows.length?'No matching records':'No records yet'}</strong><p>{rows.length?'Try another search or clear the filters.':'Records will appear here when they are added.'}</p></div>}
   {paginationStyle==="products"?<footer className="admin-table-footer admin-list-products-pagination"><div className="admin-list-products-pagination-info"><label className="admin-list-products-page-size">Rows per page<select aria-label={`${label} rows per page`} value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1)}}>{[10,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label><span className="admin-table-count-text">Showing <b>{ordered.length?(current-1)*size+1:0}</b> to <b>{Math.min(current*size,ordered.length)}</b> of <b>{ordered.length}</b> {ordered.length===1?'record':'records'}</span></div><nav className="admin-pagination-controls" aria-label={`${label} pagination`}><button type="button" className="admin-page-btn" aria-label={`Previous ${label} page`} disabled={current<=1} onClick={()=>setPage(current-1)}>&lt;</button>{pageNumbers.map(number=><button key={number} type="button" className={`admin-page-btn${number===current?' active':''}`} aria-current={number===current?'page':undefined} aria-label={`${label} page ${number}`} onClick={()=>setPage(number)}>{number}</button>)}<button type="button" className="admin-page-btn" aria-label={`Next ${label} page`} disabled={current>=pages} onClick={()=>setPage(current+1)}>&gt;</button></nav></footer>:<footer className="admin-list-pagination"><span>{ordered.length?`${(current-1)*size+1}–${Math.min(current*size,ordered.length)} of ${ordered.length}`:'0 records'}</span><label>Rows per page<select aria-label={`${label} rows per page`} value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1)}}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select></label><nav aria-label={`${label} pagination`}><button type="button" aria-label={`Previous ${label} page`} disabled={current<=1} onClick={()=>setPage(current-1)}>←</button><span>Page {current} of {pages}</span><button type="button" aria-label={`Next ${label} page`} disabled={current>=pages} onClick={()=>setPage(current+1)}>→</button></nav></footer>}
  </section>
 </div>;
}

/* Shared pieces of the unified admin look (styles in admin-redesign.css, "UNIFIED ADMIN UI"). */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";
const STATUS_TONES: Record<StatusTone, string[]> = {
 success: ["active", "approved", "published", "posted", "delivered", "settled", "succeeded", "success", "converted", "enabled", "on", "live", "paid", "verified", "connected", "healthy", "recovered"],
 info: ["confirmed", "booked", "in transit", "running", "processing", "open", "scheduled", "sent", "contacted", "followed up"],
 warning: ["new", "pending", "on hold", "queued", "draft", "awaiting", "action needed", "missing token", "review", "low stock", "retrying"],
 danger: ["cancelled", "canceled", "returned", "failed", "rejected", "blocked", "blocklisted", "error", "lost", "refused", "out of stock"],
 neutral: ["off", "disabled", "skipped", "archived", "ended", "paused", "inactive", "expired", "not booked", "unknown", "none"],
};
/** One colour per status word, used by every page: success, warning, danger, info or neutral. */
export function statusTone(value: string): StatusTone {
 const word = value.replace(/_/g, " ").trim().toLowerCase();
 return (Object.keys(STATUS_TONES) as StatusTone[]).find((tone) => STATUS_TONES[tone].includes(word)) || "neutral";
}
export function StatusBadge({ value, label, tone }: { value: string; label?: ReactNode; tone?: StatusTone }) {
 const text = value.replace(/_/g, " ").toLowerCase();
 return <span className={`adm-badge tone-${tone || statusTone(value)}`}>{label ?? text.charAt(0).toUpperCase() + text.slice(1)}</span>;
}
/** Empty list or panel: icon, one line, optional action. */
export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
 return <div className="adm-empty" role="status"><span className="adm-empty-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></span><strong>{title}</strong>{message ? <p>{message}</p> : null}{action}</div>;
}
/** A load or save that failed, in plain words, with a retry button when it can be retried. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => unknown }) {
 return <div className="adm-error" role="alert"><span>{message.replace(/_/g, " ")}</span>{onRetry ? <button type="button" className="admin-btn admin-btn-sm" onClick={() => void onRetry()}>Try again</button> : null}</div>;
}
