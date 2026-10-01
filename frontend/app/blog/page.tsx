import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { STATIC_BLOG_POSTS } from '@/lib/dummy-content';

export const revalidate=300;

export default async function BlogPage(){
  let page:any=null;
  try{page=await apiFetch('/api/pages/blog', { next: { revalidate: 300, tags: ['pages', 'page:blog'] } })}catch{}

  return (
    <div className="site-shell blog-page pb-20">
      <div className="page-head blog-head">
        <span className="static-page-kicker">ZELVOMART JOURNAL</span>
        <h1>Blog</h1>
        <p>Shopping guides, useful product ideas and updates from Zelvomart.</p>
      </div>

      {page?.bodyHtml ? <article className="content-card mb-8" dangerouslySetInnerHTML={{__html:page.bodyHtml}}/> : null}

      <div className="blog-grid">
        {STATIC_BLOG_POSTS.map((post, index) => (
          <article className="blog-card" key={post.title}>
            <div className={`blog-card-media blog-card-media-${(index % 6) + 1}`}>
              <span>{post.tag}</span>
            </div>
            <div className="blog-card-body">
              <div className="blog-meta">{post.date} • 4 min read</div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <Link href="/shop">Explore Products →</Link>
            </div>
          </article>
        ))}
      </div>

      <div className="static-page-cta blog-cta">
        <div><strong>Looking for something specific?</strong><span>Browse all six Zelvomart categories or ask us on WhatsApp.</span></div>
        <div className="static-page-cta-actions"><Link href="/shop" className="btn-primary">Shop Now</Link><a href="https://wa.me/923002026711" className="btn-outline" target="_blank" rel="noreferrer">WhatsApp Us</a></div>
      </div>
    </div>
  );
}
