import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, getProduct, products, relatedProducts, categoryPath, type Product } from "@/lib/catalog";
import { site } from "@/lib/site";
import { productOg, shareMeta } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SectionHead } from "@/components/ui/SectionHead";
import { approvedReviews, reviewSummary } from "@/lib/reviews";

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

const BRAND_SUFFIX = " | Zelvomart";

/** The product's own SEO title; "| Zelvomart" is added only while the whole title fits Google's ~60 characters. */
function productTitle(p: Product) {
  const base = p.seoTitle?.trim() || `${p.name} Price in Pakistan`;
  return base.length + BRAND_SUFFIX.length <= 60 ? base + BRAND_SUFFIX : base;
}

/** The product's own meta description; the pattern below is only a fallback for products without one. */
function productDescription(p: Product) {
  if (p.seoDescription?.trim()) return p.seoDescription.trim();
  const text = `${p.tagline} ${p.highlights.slice(0, 2).join(". ")}. Order online in Pakistan.`;
  if (text.length <= 155) return text;
  const cut = text.slice(0, 152);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:—-]+$/, "") + "…";
}

/** Delivery days from the store settings (2–7 working days fallback). */
function transitDays(): [number, number] {
  return [site.shipping.minDays, site.shipping.maxDays];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getProduct((await params).slug);
  if (!p) return {};
  const desc = productDescription(p);
  return {
    title: { absolute: productTitle(p) },
    description: desc,
    // Variant or tracking query strings all canonicalise to the plain product URL.
    alternates: { canonical: `/product/${p.slug}/` },
    // og:type=product and the price tags are added in the page body (Next has no "product" type).
    ...shareMeta({ title: productTitle(p), description: desc, path: `/product/${p.slug}/`, image: productOg(p.image, p.name), type: null }),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = getProduct((await params).slug);
  if (!p) notFound();
  const cat = getCategory(p.category)!;
  const url = `${site.url}/product/${p.slug}/`;
  const [minDays, maxDays] = transitDays();
  // Only approved reviews count; at 0 the rating is left out of the schema entirely.
  const reviews = reviewSummary(approvedReviews(p.id));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url,
    sku: p.sku,
    image: [site.url + p.image],
    description: p.description,
    brand: { "@type": "Brand", name: site.name },
    category: cat.name,
    ...(reviews.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average.toFixed(1), reviewCount: reviews.count, bestRating: 5, worstRating: 1 } }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PKR",
      price: p.price,
      availability: p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: site.name, "@id": `${site.url}/#organization` },
      // Delivery and returns come from the store settings, never hard-coded per product.
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: p.price >= site.shipping.freeOver ? 0 : site.shipping.flatFee,
          currency: "PKR",
        },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: minDays, maxValue: maxDays, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "PK",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: site.returns.windowDays,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
  };

  return (
    <div className="product-page">
      <Breadcrumbs items={[{ label: cat.name, href: categoryPath(cat.id) }, { label: p.name }]} />
      <ProductDetail slug={p.slug} />
      <section className="section pd-related">
        <div className="container">
          <SectionHead eyebrow="Keep exploring" title="You may also like" sub={`More from ${cat.name}, plus customer favourites.`} href={categoryPath(cat.id)} linkLabel={`Shop ${cat.short}`} />
          <ProductGrid items={relatedProducts(p)} />
        </div>
      </section>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={String(p.price)} />
      <meta property="product:price:currency" content="PKR" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
