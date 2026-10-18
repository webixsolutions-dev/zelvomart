import './replay-stats.css';

export function ReplaySkeleton({className=''}:{className?:string}){
 return <span aria-hidden="true" className={`replay-skeleton ${className}`}/>;
}
export default function ReplayStatCards({items,loading=false}:{items:{label:string;value:string|number;description:string}[];loading?:boolean}){
 return <div className="replay-stat-grid" aria-label="Session overview" aria-busy={loading}>{items.map((item,index)=><article className="replay-stat-card" key={item.label}>
  <div className="replay-stat-label"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{index===0?<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 9 5 3-5 3Z"/></>:index===1?<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>:<><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7Z"/><path d="m8 12 3 3 5-6"/></>}</svg>{item.label}</div>
  <div className="replay-stat-body">{loading?<ReplaySkeleton className="replay-stat-value-skeleton"/>:<strong className={typeof item.value==='string'&&!/^[\d:]+$/.test(item.value)?'replay-stat-text':undefined}>{item.value}</strong>}<small><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M4 15 15 4M5 4h10v10"/></svg>{item.description}</small></div>
 </article>)}</div>;
}
