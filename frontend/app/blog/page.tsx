import { apiFetch } from '@/lib/api';
export const dynamic='force-dynamic';
export default async function BlogPage(){let page:any=null;try{page=await apiFetch('/api/pages/blog')}catch{}return <div className="site-shell"><div className="page-head"><h1>Blog</h1><p>Guides, product updates and Zelvomart news.</p></div>{page?.bodyHtml?<article className="content-card" dangerouslySetInnerHTML={{__html:page.bodyHtml}}/>:<div className="content-card"><p>Blog content can be managed from the admin panel.</p></div>}</div>}
