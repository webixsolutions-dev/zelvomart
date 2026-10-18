import 'dotenv/config';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {tiktokProperties} from '../src/lib/tracking-payload';
import {tiktokUserData} from '../src/lib/tiktok';
import {metaUserData} from '../src/lib/meta';
import {jobResultStatus} from '../src/lib/jobs';
import {plainDescription} from '../src/lib/catalog-feed';
import {privateSafeUrl} from '../src/lib/url-privacy';
import {isStorefrontUrl} from '../src/lib/site-url';
import {replayPayload} from '../../frontend/lib/replay-data';
import {replayIdle,replayPhase,replayActivityOffsets,replaySkipTarget,REPLAY_PAUSE_MS,REPLAY_IDLE_MS,REPLAY_FLUSH_MS,REPLAY_SKIP_IDLE_MS} from '../../frontend/lib/replay-timing';
import {getReplaySessionId,claimReplaySequence,touchReplayActivity} from '../../frontend/lib/session-replay-client';
import {replayStartOffset,REPLAY_VISIBILITY_RULES} from '../../frontend/lib/replay-timing';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
test('playback starts at its first snapshot without a fixed startup delay',()=>{
 assert.equal(replayStartOffset([]),0);
 assert.equal(replayStartOffset([{type:4,timestamp:1000},{type:2,timestamp:19000}]),18001);
 assert.equal(replayStartOffset([{type:4,timestamp:1000},{type:2,timestamp:1001}]),2);
 assert.equal(replayStartOffset([{type:4,timestamp:1000}]),0);
 assert.ok(REPLAY_VISIBILITY_RULES.every(rule=>rule.includes('.public-site-main')));
});
test('only configured HTTPS storefront sends live ads',()=>{
 assert.equal(isStorefrontUrl('https://zelvomart.vercel.app/product/test'),true);
 assert.equal(isStorefrontUrl('https://zelvomart.com/product/test'),true);
 assert.equal(isStorefrontUrl('https://www.zelvomart.com/cart'),true);
 for(const url of ['http://localhost:3000','https://zelvomart-preview.vercel.app','https://zelvomart.vercel.app.evil.test','https://zelvomart.vercel.app/admin','http://zelvomart.vercel.app'])assert.equal(isStorefrontUrl(url),false);
});
test('recording closes at 30 minutes idle and keeps active sessions alive',()=>{
 const last=1000;assert.equal(replayIdle(last,last+REPLAY_IDLE_MS-1),false);assert.equal(replayIdle(last,last+REPLAY_IDLE_MS),true);assert.equal(replayIdle(last,last+REPLAY_IDLE_MS+3600000),true);assert.equal(replayIdle(last+REPLAY_IDLE_MS,last+REPLAY_IDLE_MS+1),false);assert.equal(REPLAY_FLUSH_MS,5000);assert.equal(REPLAY_SKIP_IDLE_MS,10000);
});
test('recording pauses at two minutes, hides immediately, and ends at thirty minutes',()=>{
 const last=1000;assert.equal(REPLAY_PAUSE_MS,120000);
 assert.equal(replayPhase(last,last+REPLAY_PAUSE_MS-1),'active');assert.equal(replayPhase(last,last+REPLAY_PAUSE_MS),'paused');assert.equal(replayPhase(last,last+REPLAY_IDLE_MS-1),'paused');assert.equal(replayPhase(last,last+REPLAY_IDLE_MS),'ended');
 assert.equal(replayPhase(last,last+1,false),'paused');assert.equal(replayPhase(last,last+REPLAY_IDLE_MS,false),'ended');assert.equal(replayPhase(last+REPLAY_PAUSE_MS,last+REPLAY_PAUSE_MS+1),'active');
});
test('idle skipping ignores heartbeat and animation events and jumps to the next snapshot',()=>{
 const start=100000,events=[{type:4,timestamp:start},{type:2,timestamp:start+1},{type:5,timestamp:start+5000},{type:3,timestamp:start+20000,data:{source:0}},{type:2,timestamp:start+120000},{type:3,timestamp:start+120500,data:{source:2}}];
 const offsets=replayActivityOffsets(events);assert.deepEqual(offsets,[0,1,120000,120500]);assert.equal(replaySkipTarget(offsets,500),119999);assert.equal(replaySkipTarget(offsets,119999),null);assert.equal(replaySkipTarget(offsets,120500),null);assert.equal(replaySkipTarget([],0),null);
});
test('idle session rotates on reload and active sessions preserve their chunk sequence',t=>{
 const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)};
 const priorWindow=(globalThis as any).window,priorStorage=(globalThis as any).sessionStorage;
 let now=10000;t.mock.method(Date,'now',()=>now);
 (globalThis as any).window={sessionStorage:storage,location:{href:'https://zelvomart.vercel.app/'}};(globalThis as any).sessionStorage=storage;
 try{const first=getReplaySessionId();assert.ok(first);assert.equal(claimReplaySequence(first),0);now+=REPLAY_IDLE_MS-1;assert.equal(getReplaySessionId(),first);touchReplayActivity();now+=2000;assert.equal(getReplaySessionId(),first);assert.equal(claimReplaySequence(first),1);now+=REPLAY_IDLE_MS;const second=getReplaySessionId();assert.ok(second);assert.notEqual(second,first);assert.equal(claimReplaySequence(second),0)}finally{(globalThis as any).window=priorWindow;(globalThis as any).sessionStorage=priorStorage}
});
test('replay loader accepts legacy inline data and does not assume chunks exist',()=>{
 const data=replayPayload({session:{id:'qa'},events:[{type:2,timestamp:1,data:{}}]});assert.equal(data.chunks.length,0);assert.equal(data.legacy.length,1);assert.deepEqual(data.markers,[]);
 assert.throws(()=>replayPayload({session:{id:'qa'}}),/updated backend/);
});
test('replay index filters malformed chunks and preserves an empty live session',()=>{
 const data=replayPayload({session:{id:'qa'},chunks:[null,{sequence:'1'},{sequence:-1},{sequence:2},{sequence:0}]});assert.deepEqual(data.chunks.map((c:any)=>c.sequence),[0,2]);assert.equal(replayPayload({session:{id:'qa'},chunks:[]}).chunks.length,0);
});
test('TikTok preserves variant SKU, quantity, PKR and item price',()=>{
 const data=tiktokProperties({content_ids:['TEE-RED'],contents:[{id:'TEE-RED',quantity:2,item_price:750}],currency:'PKR',value:1500});
 assert.deepEqual(data.contents,[{content_id:'TEE-RED',content_type:'product',quantity:2,price:750}]);
 assert.equal(data.currency,'PKR');assert.equal('content_ids' in data,false);
});
test('TikTok product views retain parent grouping',()=>assert.equal(tiktokProperties({content_ids:['TEE'],content_type:'product_group'}).contents?.[0].content_type,'product_group'));
test('TikTok normalizes email and E164 phone and retains click attribution',()=>{
 const user=tiktokUserData({eventName:'Purchase',eventId:'QA',email:' TEST@EXAMPLE.COM ',phone:'+92 300 1234567',externalId:'visitor',ttclid:'click',ttp:'cookie'});
 assert.equal(user.phone,hash('+923001234567'));assert.equal(user.email,hash('test@example.com'));
 assert.equal(user.external_id,hash('visitor'));assert.equal(user.ttclid,'click');assert.equal(user.ttp,'cookie');
});
test('Meta retains its platform-specific phone normalization',()=>assert.deepEqual(metaUserData({eventName:'Purchase',eventId:'QA',phone:'+92 300 1234567'}).ph,[hash('923001234567')]));
test('skipped jobs cannot be counted as successful',()=>{
 assert.equal(jobResultStatus({ok:false,skipped:'NOT_CONFIGURED'}),'SKIPPED');
 assert.equal(jobResultStatus({ok:true}),'SUCCEEDED');
});
test('catalog descriptions remove markup and cap length',()=>{
 assert.equal(plainDescription('<p>Soft &amp; comfortable</p><script>secret()</script>'),'Soft & comfortable');
 assert.equal(plainDescription('x'.repeat(6000)).length,5000);
});
test('recorded URLs retain campaign attribution but remove personal fields',()=>{
 const url=new URL(privateSafeUrl('https://zelvomart.com/checkout?email=x&phone=y&token=z&utm_source=qa#private'));
 assert.equal(url.search,'?utm_source=qa');assert.equal(url.hash,'');
});
