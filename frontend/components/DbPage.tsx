import { notFound } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { STATIC_PAGES } from "@/lib/dummy-content";

const pageIntro: Record<string, { kicker: string; description: string }> = {
  blog: {
    kicker: "ZELVOMART JOURNAL",
    description: "Shopping guides, product ideas and practical updates from Zelvomart.",
  },
  "about-us": {
    kicker: "ABOUT ZELVOMART",
    description: "A simpler way to discover useful products, order with confidence and get real support.",
  },
  "contact-us": {
    kicker: "CONTACT ZELVOMART",
    description: "Questions about a product, order or delivery? Our support team is ready to help.",
  },
};

export default async function DbPage({ slug, fallbackSlugs = [] }: { slug: string; fallbackSlugs?: string[] }) {
  const q = fallbackSlugs.length ? `?fallback=${encodeURIComponent(fallbackSlugs.join(","))}` : "";
  let page: any = null;
  try {
    page = await apiFetch<any>(`/api/pages/${encodeURIComponent(slug)}${q}`, {
      next: { revalidate: 600, tags: ["pages", `page:${slug}`] },
    });
  } catch {}

  const fallback = STATIC_PAGES[slug] || fallbackSlugs.map((candidate) => STATIC_PAGES[candidate]).find(Boolean);
  if (!page && !fallback) return notFound();

  const data = page || fallback;
  const intro = pageIntro[slug] || {
    kicker: "ZELVOMART",
    description: "Useful information to help you shop, order and get support with confidence.",
  };

  return (
    <div className="premium-content-page">
      <section className="premium-content-hero">
        <div className="site-shell premium-content-hero-inner">
          <span className="premium-overline">{intro.kicker}</span>
          <h1>{data.title}</h1>
          <p>{intro.description}</p>
        </div>
      </section>

      <div className="site-shell premium-content-body">
        <article className="content-card static-content-card premium-dynamic-content" dangerouslySetInnerHTML={{ __html: data.bodyHtml || "" }} />
        <div className="static-page-cta premium-content-cta">
          <div><strong>Need a hand?</strong><span>Browse the store or message our team for product, order and delivery help.</span></div>
          <div className="static-page-cta-actions">
            <Link href="/shop" className="btn-outline">Shop</Link>
            <Link href="/contact-us" className="btn-dark">Contact</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
