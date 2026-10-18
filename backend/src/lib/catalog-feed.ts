import {prisma} from './db';
import {canSell} from './stock';
import {catalogImageCopies,feedImage} from './catalog-images';
import sanitizeHtml from 'sanitize-html';
const xml=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
export function plainDescription(value:string){return sanitizeHtml(value,{allowedTags:[],allowedAttributes:{}}).replace(/&(nbsp|amp|lt|gt|quot|apos);/g,(_:string,key:string)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]||'')).replace(/\s+/g,' ').trim().slice(0,5000)}
export async function catalogFeed(platform:'meta'|'tiktok'|'google'){
 const [products,copies]=await Promise.all([prisma.product.findMany({where:{status:'PUBLISHED'},include:{category:true,variants:{where:{active:true}}},orderBy:{updatedAt:'desc'}}),catalogImageCopies()]);
 const base=(process.env.NEXT_PUBLIC_SITE_URL||'https://zelvomart.vercel.app').replace(/\/$/,'');
 const items:string[]=[];const missingImages:string[]=[];
 for(const p of products){
  const images=Array.isArray(p.images)?p.images.filter((v):v is string=>typeof v==='string'):[];
  for(const variant of p.variants.length?p.variants:[null]){
   const sku=variant?.sku||p.sku,source=variant?.imageUrl||images[0],image=feedImage(source,platform,copies);
   if(!image){missingImages.push(sku);continue;}
   const tag=(name:string,value:unknown)=>`<g:${name}>${xml(value)}</g:${name}>`;
   const price=Number(variant?.priceOverride??p.price),sale=variant?.priceOverride==null&&p.salePrice!=null&&Number(p.salePrice)<price?Number(p.salePrice):null;
   const attributes=variant?.attributes&&typeof variant.attributes==='object'&&!Array.isArray(variant.attributes)?variant.attributes as Record<string,unknown>:{};
   const link=`${base}/product/${p.slug}/${variant?`?variant=${encodeURIComponent(variant.sku)}`:''}`;
   items.push(`<item>${tag('id',sku)}${platform==='tiktok'?tag('sku_id',sku):''}${tag('item_group_id',p.sku)}${tag('title',variant?`${p.title} - ${variant.name}`:p.title)}${tag('description',plainDescription(p.descriptionHtml||p.shortDescription||p.title))}${tag('availability',canSell(variant||p)?'in stock':'out of stock')}${tag('condition','new')}${tag('price',`${price.toFixed(2)} PKR`)}${sale!==null?tag('sale_price',`${sale.toFixed(2)} PKR`):''}${tag('link',link)}${tag('image_link',image)}${images.filter(i=>i!==source).map(i=>feedImage(i,platform,copies)).filter(Boolean).slice(0,10).map(i=>tag('additional_image_link',i)).join('')}${tag('brand','Zelvomart')}${tag('product_type',p.category?.name||'')}${['color','size','material'].map(key=>{const entry=Object.entries(attributes).find(([name])=>name.toLowerCase().replace(/^pa_/,'')===key);return entry?tag(key,entry[1]):''}).join('')}</item>`);
  }
 }
 return {xml:`<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Zelvomart</title><link>${xml(base)}</link><description>Zelvomart ${platform} catalog</description>${items.join('')}</channel></rss>`,missingImages,count:items.length};
}
