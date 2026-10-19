import type { MetadataRoute } from 'next';
import { apiFetch } from '@/lib/api';
export const revalidate=3600;
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=(process.env.NEXT_PUBLIC_SITE_URL||'https://zelvomart.vercel.app').replace(/\/$/,'');
 let data:{products:any[];categories:any[];pages:any[]}={products:[],categories:[],pages:[]};
 try{data=await apiFetch('/api/seo/sitemap',{next:{revalidate:60,tags:['seo','products','categories','pages']}});}catch{}
 const paths=['','shop-all-products','new-arrivals','bestsellers','deals-and-offers','about-us','contact-us','faqs','shipping-policy','refund-and-return-policy','privacy-policy','terms-and-conditions','track-your-order'];
 const rows:MetadataRoute.Sitemap=paths.map(path=>({url:`${base}/${path}`}));
 for(const row of data.products||[])rows.push({url:`${base}/product/${row.slug}`,lastModified:new Date(row.updatedAt)});
 for(const row of data.categories||[])rows.push({url:`${base}/category/${row.slug}`,lastModified:new Date(row.updatedAt)});
 for(const row of data.pages||[])if(!paths.includes(row.slug)&&!['shop','faq','terms','contact','refund_returns','track-order'].includes(row.slug))rows.push({url:`${base}/${row.slug}`,lastModified:new Date(row.updatedAt)});
 return [...new Map(rows.map(row=>[row.url,row])).values()];
}
