export const REPLAY_FLUSH_MS=5_000;
export const REPLAY_IDLE_MS=30*60_000;
export const REPLAY_PAUSE_MS=2*60_000;
export const REPLAY_SKIP_IDLE_MS=10_000;
// Metadata can precede the first renderable snapshot by seconds in older sessions.
export function replayStartOffset(events:{type?:number;timestamp?:number}[]){
 const first=events.find(event=>event.type===2&&Number.isFinite(event.timestamp));
 const base=Number(events[0]?.timestamp);
 return first&&Number.isFinite(base)?Math.max(0,Number(first.timestamp)-base)+1:0;
}
// rrweb pauses CSS animations while rebuilding snapshots. Storefront entrance
// effects must not leave the recorded main content transparent in that frame.
export const REPLAY_VISIBILITY_RULES=[
 '.public-site-main.zm-route-enter { animation: none !important; opacity: 1 !important; transform: none !important; }',
 '.zm-motion-enabled .public-site-main .zm-reveal, .public-site-main .zm-scroll-reveal.zm-reveal-pending { opacity: 1 !important; transform: none !important; transition: none !important; }',
];
export function replayIdle(lastActivity:number,now=Date.now()){return now-lastActivity>=REPLAY_IDLE_MS}
export function replayPhase(lastActivity:number,now=Date.now(),visible=true):'active'|'paused'|'ended'{if(replayIdle(lastActivity,now))return 'ended';return !visible||now-lastActivity>=REPLAY_PAUSE_MS?'paused':'active'}
export function replayActivityOffsets(events:{type?:number;timestamp?:number;data?:any}[]){
 if(!events.length)return [];
 const start=Number(events[0].timestamp),end=Number(events[events.length-1].timestamp)-start;
 const offsets=events.filter(e=>e.type===2||e.type===4||e.type===3&&[1,2,3,5,6,12,14].includes(Number(e.data?.source))).map(e=>Number(e.timestamp)-start).filter(Number.isFinite);
 return [...new Set([...offsets,end])].sort((a,b)=>a-b);
}
export function replaySkipTarget(offsets:number[],current:number){
 let left=0,right=offsets.length;while(left<right){const mid=(left+right)>>>1;if(offsets[mid]<=current+1)left=mid+1;else right=mid;}
 const next=offsets[left];return next!==undefined&&next-current>REPLAY_SKIP_IDLE_MS?Math.max(current,next-1):null;
}
