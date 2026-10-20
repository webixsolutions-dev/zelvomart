import type { Product as ApiProduct, Category as ApiCategory } from '@/types/product';
import { categories as artwork, type Product, type Category } from './catalog';

export function categoryArtwork(slug: string) {
  return artwork.find(c => c.slug === slug || c.id === slug) || artwork.find(c => slug.includes(c.id) || c.id==='beauty'&&slug.includes('beauty') || c.id==='tech'&&slug.includes('tech') || c.id==='fitness'&&slug.includes('sport') || c.id==='kids'&&slug.includes('kids')) || artwork[0];
}
export function designCategory(c: ApiCategory): Category {
  const art = categoryArtwork(c.slug);
  return {...art, id:c.slug as Category['id'],slug:c.slug,name:c.name,short:c.name,image:c.image||art.image,seoTitle:c.seoTitle||art.seoTitle,seoDescription:c.seoDescription||art.seoDescription};
}
export function designProduct(p: ApiProduct): Product {
  const c=p.categories?.[0], art=categoryArtwork(c?.slug||p.categorySlugs?.[0]||'');
  return {isNew:!!p.createdAt&&Date.now()-Date.parse(p.createdAt)<30*86400000,isBestseller:Number(p.orderCount||0)>0,raw:p,id:p.id,slug:p.slug,sku:p.sku,name:p.name,category:(c?.slug||art.id) as Product['category'],categoryName:c?.name||'Products',categorySlug:c?.slug||'',price:Number(p.price),compare:p.onSale?Number(p.regularPrice):undefined,image:p.image||p.images?.[0]?.src||'/images/zelvomart-logo.png',tagline:p.shortDescription?.replace(/<[^>]*>/g,'')||'',description:p.description||'',highlights:[],idealFor:[],specs:[],inBox:[],keywords:p.tags||[],inStock:p.stockStatus==='instock',rating:Number(p.averageRating||0),reviewCount:Number(p.reviewCount||0),seoTitle:p.seoTitle||undefined,seoDescription:p.seoDescription||undefined};
}
