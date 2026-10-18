import {DeleteObjectsCommand,GetObjectCommand,PutObjectCommand,S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {gzipSync,gunzipSync} from 'node:zlib';
// Recordings use a private bucket; the public product-image bucket is rejected.
export function replayStorageConfigured(){return !!(process.env.REPLAY_S3_BUCKET&&process.env.REPLAY_S3_BUCKET!==process.env.S3_BUCKET&&process.env.S3_ENDPOINT&&process.env.S3_ACCESS_KEY_ID&&process.env.S3_SECRET_ACCESS_KEY)}
function client(){return new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'auto',requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}})}
export async function storeReplayChunk(sessionId:string,sequence:number,events:unknown[]){
 if(!replayStorageConfigured())return null;
 const storageKey=`replays/${sessionId}/${sequence}.json.gz`,body=gzipSync(Buffer.from(JSON.stringify(events)));
 await client().send(new PutObjectCommand({Bucket:process.env.REPLAY_S3_BUCKET,Key:storageKey,Body:body,ContentType:'application/json',ContentEncoding:'gzip',CacheControl:'private,max-age=300'}));
 return {storageKey,byteSize:body.length};
}
export async function replayChunkUrl(key:string){
 if(!replayStorageConfigured())throw new Error('Private replay bucket is not configured');
 if(!/^replays\/[0-9a-f-]{36}\/\d+\.json\.gz$/i.test(key))throw new Error('Invalid replay object key');
 return getSignedUrl(client(),new GetObjectCommand({Bucket:process.env.REPLAY_S3_BUCKET,Key:key}),{expiresIn:900});
}
/** Authenticated same-origin fallback when a browser cannot fetch R2 directly. */
export async function readReplayChunk(key:string){
 if(!replayStorageConfigured()||!/^replays\/[0-9a-f-]{36}\/\d+\.json\.gz$/i.test(key))throw new Error('Invalid replay object configuration');
 const object=await client().send(new GetObjectCommand({Bucket:process.env.REPLAY_S3_BUCKET,Key:key}));
 if(!object.Body)throw new Error('Recording file is empty');
 const bytes=await object.Body.transformToByteArray();
 const events=JSON.parse(gunzipSync(bytes,{maxOutputLength:8*1024*1024}).toString());
 if(!Array.isArray(events))throw new Error('Invalid recording file');return events;
}
export async function deleteReplayChunks(keys:string[]){
 if(!keys.length)return;
 if(!replayStorageConfigured())throw new Error('Private replay bucket is not configured');
 if(keys.some(key=>!/^replays\/[0-9a-f-]{36}\/\d+\.json\.gz$/i.test(key)))throw new Error('Invalid replay object key');
 for(let start=0;start<keys.length;start+=1000){
  const result=await client().send(new DeleteObjectsCommand({Bucket:process.env.REPLAY_S3_BUCKET,Delete:{Objects:keys.slice(start,start+1000).map(Key=>({Key}))}}));
  if(result.Errors?.length)throw new Error('Some private replay objects could not be deleted');
 }
}
