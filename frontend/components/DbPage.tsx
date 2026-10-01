import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { STATIC_PAGES } from '@/lib/dummy-content';

function hasUsefulBody(value: unknown) {
  if (typeof value !== 'string') return false;
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length > 80;
}

export default async function DbPage({slug,fallbackSlugs=[]}:{slug:string;fallbackSlugs?:string[]}){
  const q=fallbackSlugs.length?`?fallback=${encodeURIComponent(fallbackSlugs.join(','))}`:'';
  let page:any=null;
  try{page=await apiFetch<any>(`/api/pages/${encodeURIComponent(slug)}${q}`);}catch{}
  const fallback = STATIC_PAGES[slug] || fallbackSlugs.map((candidate) => STATIC_PAGES[candidate]).find(Boolean);
  if (!page && !fallback) return notFound();

  const data = page && hasUsefulBody(page.bodyHtml)
    ? page
    : fallback || page;

  return (
    <div className="site-shell static-page-wrap">
      <div className="page-head static-page-head">
        <span className="static-page-kicker">ZELVOMART CUSTOMER CARE</span>
        <h1>{data.title}</h1>
        <p>Useful information to help you shop, order and get support with confidence.</p>
      </div>
      <article className="content-card static-content-card" dangerouslySetInnerHTML={{__html:data.bodyHtml||''}}/>
      <div className="static-page-cta">
        <div><strong>Still need help?</strong><span>Our team can help with products, orders and delivery questions.</span></div>
        <div className="static-page-cta-actions"><Link href="/shop" className="btn-outline">Continue Shopping</Link><a href="https://wa.me/923002026711" className="btn-green" target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>
      </div>
    </div>
  );
}
