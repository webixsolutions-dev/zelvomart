import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/db';
import {signAdminToken} from '../src/lib/auth';
import {deleteReplayChunks,replayStorageConfigured} from '../src/lib/replay-storage';
async function main(){
 const owner=await prisma.user.findFirstOrThrow({where:{role:'OWNER'},select:{id:true,name:true,email:true,role:true}}),token=signAdminToken(owner);
 const id=randomUUID(),visitorId=randomUUID(),marker=`replay-qa-${id}`,base='http://localhost:4000';
 async function api(path:string,body?:unknown){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','user-agent':'Zelvomart QA Browser',authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const data=await response.json();assert.equal(response.status,200,`${path}: ${JSON.stringify(data)}`);return data}
 try{
  const now=Date.now()-25000,url=`http://localhost:3000/product/${marker}?email=private&utm_source=qa`;
  await api('/api/session-replays/start',{sessionId:id,visitorId,startedAt:new Date(now).toISOString(),landingUrl:url,currentUrl:url,device:'desktop'});
  const events=[{type:4,timestamp:now,data:{href:'http://localhost:3000',width:1280,height:720}},{type:2,timestamp:now+1,data:{node:{type:0,id:1,childNodes:[]},initialOffset:{top:0,left:0}}},{type:3,timestamp:now+20000,data:{source:4,width:1280,height:720}}];
  for(let n=0;n<2;n++)await api('/api/session-replays/chunk',{sessionId:id,sequence:0,currentUrl:url,events});
  await api('/api/events',{eventName:'AddToCart',eventId:marker,replaySessionId:id,visitorId,sourceUrl:url,params:{}});
  const stored=await prisma.sessionReplay.findUniqueOrThrow({where:{id}});assert.equal(stored.eventCount,3);assert.equal(stored.chunkCount,1);assert.equal(stored.hasSnapshot,true);assert.equal(stored.reachedCart,true);assert.ok(stored.durationMs>=20000);assert.ok(!stored.landingUrl.includes('email='));
  const list=await api(`/api/admin/session-replays?q=${marker}&outcome=cart-no-order`);assert.equal(list.total,1);assert.equal(list.items[0].id,id);
  assert.equal((await api(`/api/admin/session-replays?q=${marker}&outcome=ordered`)).total,0);
  const detail=await api(`/api/admin/session-replays/${id}`);assert.equal(detail.chunks.length,1);assert.equal(detail.events,undefined);assert.equal(detail.chunks[0].events,undefined);
  const chunk=await api(`/api/admin/session-replays/${id}/chunks/0`);assert.ok(Array.isArray(chunk.events)||chunk.url);
  if(replayStorageConfigured()){assert.ok(chunk.url,'Restart the backend to activate the configured private bucket.');const persisted=await prisma.sessionReplayChunk.findUniqueOrThrow({where:{sessionId_sequence:{sessionId:id,sequence:0}}});assert.deepEqual(persisted.events,[]);assert.ok(persisted.storageKey);console.log('PASS API uses private R2 and keeps event bodies out of PostgreSQL');}
  const protectedDownload=await api(`/api/admin/session-replays/${id}/chunks/0?download=1`);assert.equal(protectedDownload.events.length,events.length);console.log('PASS authenticated playback fallback for future domains and CORS failures');
  await Promise.all([api('/api/session-replays/chunk',{sessionId:id,sequence:1,currentUrl:url,events}),api('/api/session-replays/chunk',{sessionId:id,sequence:1,currentUrl:url,events})]);
  const counted=await prisma.sessionReplay.findUniqueOrThrow({where:{id}});assert.equal(counted.chunkCount,2);assert.equal(counted.eventCount,6);
  const liveIndex=await api(`/api/admin/session-replays/${id}?live=1`);assert.deepEqual(liveIndex.chunks.map((c:any)=>c.sequence),[1]);assert.equal(liveIndex.bootstrap.type,4);console.log('PASS concurrent retry counts and latest-snapshot live startup');
  for(const platform of ['meta','tiktok','google']){const r=await fetch(`${base}/api/feed/${platform}.xml`);assert.equal(r.status,200);const xml=await r.text();assert.ok(xml.includes('<g:id>'));assert.ok(!xml.includes('<g:description><p>'));console.log(`PASS ${platform} feed (${r.headers.get('x-catalog-items')} items)`)}
  const health=await api('/api/admin/tracking/health');assert.ok(health);
  console.log('PASS replay ingestion, duplicate safety, URL privacy, database funnel filters, index-first chunks and authenticated health');
 }finally{const chunks=await prisma.sessionReplayChunk.findMany({where:{sessionId:id,storageKey:{not:null}},select:{storageKey:true}});await deleteReplayChunks(chunks.map(c=>c.storageKey!));await prisma.eventLog.deleteMany({where:{sessionReplayId:id,eventId:marker}});await prisma.sessionReplay.deleteMany({where:{id,visitorId}});console.log('PASS QA fixture cleanup')}
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());

