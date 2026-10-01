import type { Metadata } from 'next';
import { apiFetch } from './api';
export async function metadataForPage(slug:string,fallbackSlugs:string[]=[]):Promise<Metadata>{
 try{const q=fallbackSlugs.length?`?fallback=${encodeURIComponent(fallbackSlugs.join(','))}`:'';const page=await apiFetch<any>(`/api/pages/${encodeURIComponent(slug)}${q}`, { next: { revalidate: 600, tags: ['pages', `page:${slug}`] } });return{title:page.seoTitle||page.title,description:page.seoDescription||undefined,alternates:{canonical:`/${page.slug}/`},openGraph:{title:page.seoTitle||page.title,description:page.seoDescription||undefined,url:`/${page.slug}/`}};}catch{return{};}
}
