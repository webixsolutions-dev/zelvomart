import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {prisma} from './db';
import {uploadObject} from './storage';
import {setSetting} from './settings';
/** Site images: WebP, at most 1600 px wide, quality 82, metadata removed. */
export const SITE_IMAGE_MAX_WIDTH=1600;
export const SITE_IMAGE_QUALITY=82;
const CONVERTIBLE=new Set(['image/jpeg','image/png','image/avif','image/webp']);

/**
 * Turns an uploaded JPG, PNG, AVIF or WebP into the WebP the site serves. GIFs (may be animated) and anything
 * that is not an image pass through unchanged. A WebP that already fits (≤1600 px wide, no EXIF/ICC/XMP) is
 * kept as it is, so a file the admin already converted in the browser is not compressed a second time.
 */
export async function toSiteWebp(bytes:Buffer,contentType:string):Promise<{bytes:Buffer;contentType:string;ext:string;converted:boolean}>{
 const type=contentType.toLowerCase();
 if(!CONVERTIBLE.has(type))return {bytes,contentType,ext:type==='image/gif'?'gif':(type.split('/')[1]||'bin'),converted:false};
 const image=sharp(bytes,{limitInputPixels:40000000});
 const meta=await image.metadata();
 if(meta.format==='webp'&&(meta.width||0)<=SITE_IMAGE_MAX_WIDTH&&!meta.exif&&!meta.icc&&!meta.xmp&&(meta.pages||1)===1)return {bytes,contentType:'image/webp',ext:'webp',converted:false};
 const out=await image.rotate().resize({width:SITE_IMAGE_MAX_WIDTH,withoutEnlargement:true}).webp({quality:SITE_IMAGE_QUALITY}).toBuffer();
 return {bytes:out,contentType:'image/webp',ext:'webp',converted:true};
}

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
 // Feeds get JPG/PNG only: the site's WebP is swapped for its JPG copy (made at upload or by the backfill).
 if(/\.(jpe?g|png)(\?|$)/i.test(source))return source;
 // Google also reads WebP, so a Google item without a copy yet keeps the original rather than dropping its image.
 return copies[imageCopyKey(source)]||(platform==='google'?source:undefined);
}
