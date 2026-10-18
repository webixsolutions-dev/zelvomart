import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
import {storeReplayChunk,replayChunkUrl,deleteReplayChunks} from '../src/lib/replay-storage';
import {SITE_ORIGIN} from '../src/lib/site-url';
async function main(){
 const bucket=process.env.REPLAY_S3_BUCKET;
 assert.ok(bucket&&bucket!==process.env.S3_BUCKET,'A separate REPLAY_S3_BUCKET is required.');
 const client=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'auto',requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}});
 const id=randomUUID(),events=[{type:4,timestamp:Date.now(),data:{href:'https://zelvomart.com/qa-replay',width:390,height:844}}];
 let key:string|undefined;
 try{
  const stored=await storeReplayChunk(id,0,events);assert.ok(stored);key=stored.storageKey;
  const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  assert.equal(object.ContentEncoding,'gzip');assert.deepEqual(JSON.parse(gunzipSync(await object.Body!.transformToByteArray()).toString()),events);
  const signed=await fetch(await replayChunkUrl(key),{headers:{Origin:SITE_ORIGIN}});assert.equal(signed.status,200);assert.equal(signed.headers.get('access-control-allow-origin'),SITE_ORIGIN);assert.deepEqual(await signed.json(),events);
  console.log('PASS gzip upload, private authenticated read and signed playback');
  const unsigned=await fetch(`${process.env.S3_ENDPOINT}/${bucket}/${key}`);assert.ok(unsigned.status===400||unsigned.status===401||unsigned.status===403);
  console.log('PASS unsigned recording access denied');
 }finally{if(key){await deleteReplayChunks([key]);console.log('PASS temporary storage fixture removed')}}
}
main().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1});
