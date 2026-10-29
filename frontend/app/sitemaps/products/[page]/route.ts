import { serveSitemap } from "@store/lib/sitemap-route";

export const revalidate = 3600;

/** /product-sitemap2.xml, /product-sitemap3.xml … (rewritten here in next.config.ts); only used past 1,000 products. */
export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const n = /^\d+$/.test(page) ? Number(page) : 0;
  return serveSitemap(n >= 2 ? `product-sitemap${n}.xml` : "not-a-sitemap");
}
