import type { CSSProperties } from 'react';

export function Skeleton({width='100%',height=12,className=''}:{width?:string|number;height?:number;className?:string}) {
  return <span aria-hidden="true" className={`od-skeleton ${className}`} style={{width,height} as CSSProperties}/>;
}

export function StatSkeleton() {
  return <><Skeleton width={56} height={29} className="od-skeleton-value"/><Skeleton width={46} height={12}/><Skeleton width={92} height={9}/></>;
}

export function TableSkeleton({rows=10}:{rows?:number}) {
  return <>{Array.from({length:rows},(_,index)=><tr key={index} className="od-skeleton-row" aria-hidden="true"><td><Skeleton width={14} height={14}/></td><td><Skeleton width={78}/></td><td><div className="od-skeleton-customer"><Skeleton width={30} height={30} className="od-skeleton-circle"/><div><Skeleton width={104}/><Skeleton width={132} height={9}/></div></div></td><td><div className="od-skeleton-customer">{[0,1,2].map(n=><Skeleton key={n} width={28} height={28}/>)}</div></td><td><Skeleton width={76}/><Skeleton width={49} height={9}/></td><td><Skeleton width={98} height={24}/></td><td><Skeleton width={76} height={24}/></td><td><Skeleton width={67}/><Skeleton width={85} height={9}/></td><td><Skeleton width={63}/></td><td><Skeleton width={14}/></td></tr>)}</>;
}

export function InsightSkeleton({kind}:{kind:'breakdown'|'progress'|'activity'|'products'}) {
  if(kind==='breakdown')return <div className="od-breakdown" aria-hidden="true"><div className="od-skeleton-donut"/><div className="od-legend">{Array.from({length:6},(_,index)=><Skeleton key={index} height={10}/>)}</div></div>;
  return <div aria-hidden="true" className="od-insight-skeleton">{Array.from({length:kind==='activity'?6:kind==='products'?5:4},(_,index)=><div className="od-skeleton-customer" key={index}><Skeleton width={30} height={30} className={kind==='products'?'':'od-skeleton-circle'}/><div><Skeleton width="80%" height={10}/><Skeleton width="100%" height={kind==='progress'||kind==='products'?6:9}/></div></div>)}</div>;
}
