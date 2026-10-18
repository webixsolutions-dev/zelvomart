export type ReplayRecord={type:number;timestamp:number;data?:any;[key:string]:unknown};
export function replayRecords(value:unknown):ReplayRecord[]{
 if(!Array.isArray(value))return [];
 return value.filter((e):e is ReplayRecord=>!!e&&typeof e==='object'&&Number.isInteger(e.type)&&e.type>=0&&e.type<=6&&Number.isFinite(e.timestamp)).sort((a,b)=>a.timestamp-b.timestamp);
}
/** Support both the old inline-events API and the incremental chunk index. */
export function replayPayload(value:any){
 if(!value||typeof value!=='object'||!value.session)throw new Error('The backend returned an invalid recording response.');
 const chunks=Array.isArray(value.chunks)?value.chunks.filter((c:any)=>c&&Number.isInteger(c.sequence)&&c.sequence>=0).sort((a:any,b:any)=>a.sequence-b.sequence):[];
 const legacy=Array.isArray(value.events)?replayRecords(value.events):null;
 if(!Array.isArray(value.chunks)&&legacy===null)throw new Error('This backend does not provide replay chunks. Deploy the updated backend and retry.');
 return {...value,markers:Array.isArray(value.markers)?value.markers:[],chunks,legacy};
}
