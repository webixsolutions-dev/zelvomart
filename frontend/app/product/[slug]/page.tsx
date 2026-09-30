import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import ProductGrid from "@/components/ProductGrid";
import { cleanHtml } from "@/lib/sanitize";
import { getProductBySlug, getProducts } from "@/lib/store";
import { getSetting } from "@/lib/settings";

export const revalidate = 180;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription || `Buy ${product.name} from Zelvomart with Cash on Delivery across Pakistan.`,
    alternates: { canonical: product.canonicalUrl || `/product/${product.slug}/` },
    openGraph: { title: product.seoTitle || product.name, description: product.seoDescription || `${product.name} • ${product.price} PKR`, images: product.image ? [product.image] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  product.description = cleanHtml(product.description || "");
  const [defaultDiscount, info, related] = await Promise.all([
    getSetting<number>("store.bundleDefaultDiscountPercent", 5),
    getSetting<any>("store.info", { whatsapp: "923002026711" }),
    getProducts({ category: product.categorySlugs[0], limit: 4 }),
  ]);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: product.images.map((image) => image.src),
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
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: base },
    ...(product.categories[0] ? [{ "@type": "ListItem", position: 2, name: product.categories[0].name, item: `${base}/product-category/${product.categories[0].slug}/` }] : []),
    { "@type": "ListItem", position: product.categories[0] ? 3 : 2, name: product.name, item: `${base}/product/${product.slug}/` },
  ] };

  return <div className="product-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} /><div className="site-shell"><ProductDetailClient product={product} defaultBundleDiscount={defaultDiscount} whatsapp={String(info.whatsapp || "923002026711")} />{related.items.filter((row) => row.id !== product.id).length ? <section className="section pb-0"><div className="section-title"><div><h2>You may also like</h2><p>More products from this category.</p></div></div><ProductGrid products={related.items.filter((row) => row.id !== product.id).slice(0,4)} /></section> : null}</div></div>;
}
