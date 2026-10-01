import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { STATIC_PAGES } from '@/lib/dummy-content';

export default async function DbPage({slug,fallbackSlugs=[]}:{slug:string;fallbackSlugs?:string[]}){
  const q=fallbackSlugs.length?`?fallback=${encodeURIComponent(fallbackSlugs.join(','))}`:'';
  let page:any=null;
  try{page=await apiFetch<any>(`/api/pages/${encodeURIComponent(slug)}${q}`);}catch{}
  const fallback = STATIC_PAGES[slug];
  if (!page && !fallback) return notFound();
  const data = page || fallback;
  return <div className="site-shell"><div className="page-head"><h1>{data.title}</h1></div><article className="content-card" dangerouslySetInnerHTML={{__html:data.bodyHtml||''}}/></div>;
}
