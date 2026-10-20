import { notFound, permanentRedirect, redirect } from 'next/navigation';
import DbPage from '@/components/DbPage';
import { apiFetch } from '@/lib/api';
export const revalidate=600;
export default async function CatchAll({params}:{params:Promise<{slug:string[]}>}){
  const {slug}=await params;
  const path=`/${slug.join('/')}/`;
  let row:{destination?:string;permanent?:boolean}|null=null;
  try{row=await apiFetch<any>(`/api/redirects/resolve?path=${encodeURIComponent(path)}`, { next: { revalidate: 600, tags: ['redirects'] } });}catch{row=null;}
  // Outside the try: redirect() works by throwing, and a catch would swallow it.
  if(row?.destination){if(row.permanent)permanentRedirect(row.destination);redirect(row.destination);}
  if(slug.length===1)return <DbPage slug={slug[0]}/>;
  return notFound();
}
