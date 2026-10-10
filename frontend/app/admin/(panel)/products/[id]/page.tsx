import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import ProductGrid from "@/components/ProductGrid";
import { getProductBySlug, getProducts } from "@/lib/store";
import { getSettings } from "@/lib/settings";
import type { Product } from "@/types/product";

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription || `Buy ${product.name} from Zelvomart with Cash on Delivery across Pakistan.`,
    alternates: { canonical: product.canonicalUrl || `/product/${product.slug}/` },
    openGraph: {
      title: product.seoTitle || product.name,
      description: product.seoDescription || `${product.name} ${product.price} PKR`,
      images: product.images?.[0]?.src ? [product.images[0].src] : [],
    },
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
  if (!product) notFound();

  const categorySlug = product.categorySlugs?.[0] || product.categories?.[0]?.slug;
  const [settings, categoryProducts, featuredProducts, newestProducts] = await Promise.all([
    getSettings(["store.bundleDefaultDiscountPercent", "store.info"]),
    categorySlug ? getProducts({ category: categorySlug, limit: 8 }) : Promise.resolve({ items: [], page: 1, limit: 8, total: 0, totalPages: 1 }),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ limit: 8, sort: "newest" }),
  ]);

  const related = uniqueRelated(product, [categoryProducts.items, featuredProducts.items, newestProducts.items]);
  const defaultDiscount = Number(settings["store.bundleDefaultDiscountPercent"] ?? 5);
  const info = (settings["store.info"] || { whatsapp: "923002026711" }) as { whatsapp?: string };
  const whatsapp = String(info.whatsapp || "923002026711").replace(/[^0-9]/g, "");
  const categoryHref = categorySlug ? `/product-category/${categorySlug}/` : "/shop";
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: product.images?.map((image) => image.src) || [],
    description: product.shortDescription || product.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: product.price,
      availability: product.stockStatus === "instock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${base}/product/${product.slug}/`,
    },
    ...(product.reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.averageRating, reviewCount: product.reviewCount } } : {}),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      ...(product.categories?.[0] ? [{ "@type": "ListItem", position: 2, name: product.categories[0].name, item: `${base}/product-category/${product.categories[0].slug}/` }] : []),
      { "@type": "ListItem", position: product.categories?.[0] ? 3 : 2, name: product.name, item: `${base}/product/${product.slug}/` },
    ],
  };

  return (
    <div className="product-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <div className="site-shell max-w-[1240px] mx-auto px-4 md:px-6">
        <nav className="pdp-reference-breadcrumb text-xs text-slate-500 py-4 flex items-center gap-1.5" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-slate-800">Home</Link>
          <span>›</span>
          <Link href="/shop" className="hover:text-slate-800">Shop</Link>
          <span>›</span>
          <span className="text-slate-900 font-semibold">{product.name}</span>
        </nav>
        <ProductDetailClient product={product} defaultBundleDiscount={defaultDiscount} whatsapp={whatsapp} />
      </div>

      {related.length > 0 && (
        <section className="w-full mt-16 pt-10 border-t border-slate-100 max-w-[1240px] mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between mb-6 md:mb-8">
            <div>
              <span className="text-[11px] md:text-xs font-bold text-sky-500 uppercase tracking-wider block mb-1">
                MORE TO EXPLORE
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Related Products
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                Four more picks you may like from Zelvomart.
              </p>
            </div>
            <Link
              href={categoryHref}
              className="px-4 py-2 rounded-full border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs whitespace-nowrap"
            >
              View All
            </Link>
          </div>

          {/* Renders 1 card per row on mobile, 2 on tablet, 4 on desktop */}
          <ProductGrid products={related.slice(0, 4)} />
        </section>
      )}
    </div>
  );
}