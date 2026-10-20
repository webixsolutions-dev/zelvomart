import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import ProductPreviewScreen from "@/components/ProductPreviewScreen";
import ProductGrid from "@/components/ProductGrid";
import { getProductBySlug, getProducts } from "@/lib/store";
import { apiFetch } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { resolveProductTabs } from "@/lib/product-tabs";
import type { Product } from "@/types/product";
import { resolveDeliveryPolicy, type DeliverySettings } from "@/lib/shipping";
import { buildBreadcrumbSchema, buildProductSchema } from "@/lib/product-schema";

export const revalidate = 120;

function ensureSlash(path: string) {
  const clean = path.replace(/[?#].*$/, "");
  return clean.endsWith("/") ? clean : `${clean}/`;
}

/**
 * The product's own redirect (SEO -> Advanced): only when its "Old URL" is this product's URL.
 * Any other old path is answered from the Redirect table by the catch-all route.
 */
function productRedirectUrl(product: Product | null) {
  const meta = product?.catalogMeta;
  const destination = meta && typeof meta.redirectUrl === "string" ? meta.redirectUrl.trim() : "";
  if (!product || !destination) return "";
  const from = typeof meta?.redirectFrom === "string" && meta.redirectFrom.trim() ? meta.redirectFrom.trim() : `/product/${product.slug}/`;
  let fromPath = from;
  try {
    fromPath = new URL(from, "https://zelvomart.vercel.app").pathname;
  } catch {
    // keep as typed
  }
  return ensureSlash(fromPath) === `/product/${product.slug}/` ? destination : "";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  const destination = productRedirectUrl(product);
  if (destination) permanentRedirect(destination);
  if (!product) return {};
  // SEO -> Advanced robots. Products stay indexable by default.
  const noindex = product.catalogMeta?.robotsIndex === "noindex";
  const nofollow = Boolean(product.catalogMeta?.robotsNoFollow);
  return {
    // Only what was turned off is written: noindex alone gives <meta name="robots" content="noindex">.
    robots: noindex || nofollow ? { ...(noindex ? { index: false } : {}), ...(nofollow ? { follow: false } : {}) } : undefined,
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription || `Buy ${product.name} from Zelvomart with Cash on Delivery across Pakistan.`,
    alternates: { canonical: product.canonicalUrl || `/product/${product.slug}/` },
    openGraph: { title: product.seoTitle || product.name, description: product.seoDescription || `${product.name} • ${product.price} PKR`, images: product.image ? [product.image] : [] },
  };
}

function uniqueRelated(product: Product, groups: Product[][]): Product[] {
  const seen = new Set<string>([product.id]);
  const result: Product[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.id) || item.slug === product.slug) continue;
      seen.add(item.id);
      result.push(item);
      if (result.length === 4) return result;
    }
  }

  return result;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  const destination = productRedirectUrl(product);
  if (destination) permanentRedirect(destination);
  if (!product) {
    let row: { destination?: string; permanent?: boolean } | null = null;
    try {
      row = await apiFetch<{ destination?: string; permanent?: boolean }>(`/api/redirects/resolve?path=${encodeURIComponent(`/product/${slug}/`)}`, {
        next: { revalidate: 120, tags: ["redirects"] },
      });
    } catch {
      row = null;
    }
    if (row?.destination && row.permanent) permanentRedirect(row.destination);
    return <ProductPreviewScreen slug={slug} missingRedirect={row?.destination || "/shop"} />;
  }

  const categorySlug = product.categorySlugs[0] || product.categories[0]?.slug;
  const [settings, categoryProducts, featuredProducts, newestProducts] = await Promise.all([
    getSettings(["store.bundleDefaultDiscountPercent", "store.info", "store.productTabs", "store.delivery"]),
    categorySlug ? getProducts({ category: categorySlug, limit: 8 }) : Promise.resolve({ items: [], page: 1, limit: 8, total: 0, totalPages: 1 }),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ limit: 8, sort: "newest" }),
  ]);

  const related = uniqueRelated(product, [categoryProducts.items, featuredProducts.items, newestProducts.items]);
  const defaultDiscount = Number(settings["store.bundleDefaultDiscountPercent"] ?? 5);
  const info = (settings["store.info"] || { whatsapp: "923002026711" }) as { whatsapp?: string };
  const whatsapp = String(info.whatsapp || "923002026711").replace(/[^0-9]/g, "");
  const categoryHref = categorySlug ? `/product-category/${categorySlug}/` : "/shop";
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.vercel.app";

  // Same builder as the admin SEO -> Schema preview.
  const delivery = resolveDeliveryPolicy((settings["store.delivery"] || null) as DeliverySettings | null);
  const schema = buildProductSchema(product, { baseUrl: base, delivery });
  const breadcrumb = buildBreadcrumbSchema(product, base);

  return (
    <div className="product-page zpd-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g,"\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g,"\\u003c") }} />

      <div className="site-shell">
        <nav className="zpd-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>›</span><Link href="/shop">Shop</Link><span>›</span><span>{product.name}</span>
        </nav>
        <ProductPreviewScreen
          slug={slug}
          fallback={
            <ProductDetailClient
              product={product}
              defaultBundleDiscount={defaultDiscount}
              whatsapp={whatsapp}
              sections={resolveProductTabs(settings["store.productTabs"], product.catalogMeta)}
            />
          }
        />
      </div>

      {related.length ? (
        <section className="section pdp-related-section">
          <div className="site-shell">
            <div className="section-title pdp-related-title">
              <div>
                <span className="pdp-related-kicker">KEEP EXPLORING</span>
                <h2>You may also like</h2>
                <p>More from this category, plus customer favourites.</p>
              </div>
              <Link href={categoryHref} className="btn-outline pdp-related-view">View All</Link>
            </div>
            <ProductGrid products={related.slice(0, 4)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
