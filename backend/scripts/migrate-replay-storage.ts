import 'dotenv/config';
import {prisma} from '../src/lib/db';
import {replayStorageConfigured,storeReplayChunk} from '../src/lib/replay-storage';
// Copies old chunks to private R2. Original JSON is retained for rollback.
async function main(){
 const apply=process.argv.includes('--apply');
 if(!apply){const count=await prisma.sessionReplayChunk.count({where:{storageKey:null,eventCount:{gt:0}}});console.log(JSON.stringify({apply:false,eligibleChunks:count,copied:0,originalJsonRetained:true}));return;}
 if(apply&&!replayStorageConfigured())throw new Error('Configure a separate private REPLAY_S3_BUCKET before applying.');
 let cursor:string|undefined,total=0,copied=0;
 for(;;){
  const rows=await prisma.sessionReplayChunk.findMany({where:{storageKey:null},orderBy:{id:'asc'},take:100,...(cursor?{cursor:{id:cursor},skip:1}:{})});
  if(!rows.length)break;
  for(const row of rows){
   cursor=row.id;if(!Array.isArray(row.events)||!row.events.length)continue;total++;
   if(!apply)continue;
   const result=await storeReplayChunk(row.sessionId,row.sequence,row.events);
   if(!result)throw new Error('Private storage unavailable; original data retained.');
   const timestamps=row.events.map((e:any)=>Number(e.timestamp)).filter(Number.isFinite);
   await prisma.sessionReplayChunk.update({where:{id:row.id},data:{...result,hasSnapshot:row.events.some((e:any)=>e.type===2),...(timestamps.length?{firstTimestamp:Math.min(...timestamps),lastTimestamp:Math.max(...timestamps)}:{})}});copied++;
  }
 }
 console.log(JSON.stringify({apply,eligibleChunks:total,copied,originalJsonRetained:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
