import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
export default async function DbPage({slug,fallbackSlugs=[]}:{slug:string;fallbackSlugs?:string[]}){
  const q=fallbackSlugs.length?`?fallback=${encodeURIComponent(fallbackSlugs.join(','))}`:'';
  let page:any; try{page=await apiFetch<any>(`/api/pages/${encodeURIComponent(slug)}${q}`);}catch{return notFound();}
  return <div className="site-shell"><div className="page-head"><h1>{page.title}</h1></div><article className="content-card" dangerouslySetInnerHTML={{__html:page.bodyHtml||''}}/></div>;
}
