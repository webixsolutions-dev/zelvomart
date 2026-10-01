import { redirect, notFound } from 'next/navigation';
import DbPage from '@/components/DbPage';
import { apiFetch } from '@/lib/api';
export const dynamic='force-dynamic';
export default async function CatchAll({params}:{params:Promise<{slug:string[]}>}){const {slug}=await params;const path=`/${slug.join('/')}/`;try{const r=await apiFetch<any>(`/api/redirects/resolve?path=${encodeURIComponent(path)}`);if(r?.destination)redirect(r.destination);}catch{}if(slug.length===1)return <DbPage slug={slug[0]}/>;return notFound();}
