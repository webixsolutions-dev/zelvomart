import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {prisma} from './db';
import {uploadObject} from './storage';
import {setSetting} from './settings';
export const imageCopyKey=(url:string)=>`feed.image.${createHash('sha256').update(url).digest('hex')}`;
export async function saveCatalogImage(sourceUrl:string,bytes:Uint8Array){
 const hash=createHash('sha256').update(sourceUrl).digest('hex');
 const jpg=await sharp(bytes,{limitInputPixels:40000000}).rotate().flatten({background:'#ffffff'}).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
 const url=await uploadObject(`catalog-images/${hash}.jpg`,jpg,'image/jpeg');
 await setSetting(imageCopyKey(sourceUrl),url);return url;
}
export async function catalogImageCopies(){return Object.fromEntries((await prisma.setting.findMany({where:{key:{startsWith:'feed.image.'}}})).map(row=>[row.key,String(row.value)]))}
export function feedImage(source:string|undefined,platform:string,copies:Record<string,string>){
 if(!source)return undefined;
 if(platform==='google'||/\.(jpe?g|png)(\?|$)/i.test(source))return source;
 return copies[imageCopyKey(source)];
}
