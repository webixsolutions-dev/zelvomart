import type { Metadata } from "next";
import { jsonLd as serializeJsonLd } from "@/lib/json-ld";
import { notFound } from "next/navigation";
import { getCategory, relatedProducts, categoryPath, type Product } from "@store/lib/catalog";
import { loadProduct, loadStore } from "@store/lib/backend";
import { ProductBridge } from "@store/lib/bridge";
import { site } from "@store/lib/site";
import { productOg, productTitle, shareMeta } from "@store/lib/seo";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { ProductDetail } from "@store/components/product/ProductDetail";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { SectionHead } from "@store/components/ui/SectionHead";
import { approvedReviews, reviewSummary } from "@store/lib/reviews";

// Products come from the backend: rendered on demand and refreshed every 5 minutes.
export const revalidate = 300;

// No page is built ahead; each product page is cached on its first visit (ISR).
export async function generateStaticParams() {
  return [];
}


/** The product's own SEO title; "| Zelvomart" is added only while the whole title fits Google's ~60 characters. */
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
  const p = await loadProduct((await params).slug);
  if (!p) return {};
  const desc = productDescription(p);
  return {
    ...(p.noindex ? { robots: { index: false, follow: true } } : {}),
    title: { absolute: productTitle(p) },
    description: desc,
    // Variant or tracking query strings all canonicalise to the plain product URL.
    alternates: { canonical: `/product/${p.slug}/` },
    // og:type=product and the price tags are added in the page body (Next has no "product" type).
    ...shareMeta({ title: productTitle(p), description: desc, path: `/product/${p.slug}/`, image: productOg(p.image, p.name), type: null }),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  await loadStore();
  const p = await loadProduct(slug);
  if (!p) notFound();
  const cat = getCategory(p.category)!;
  const url = `${site.url}/product/${p.slug}/`;
  const [minDays, maxDays] = transitDays();
  // Only approved reviews count; at 0 the rating is left out of the schema entirely.
  const reviews = reviewSummary(approvedReviews(p.id));
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "PK",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: site.returns.windowDays,
    returnMethod: "https://schema.org/ReturnByMail",
  };
  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: p.price >= site.shipping.freeOver ? 0 : site.shipping.flatFee, currency: "PKR" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: minDays, maxValue: maxDays, unitCode: "DAY" },
    },
  };
  const variantProducts = (p.variants?.options || []).map((variant) => {
    const variantUrl = `${url}?variant=${encodeURIComponent(variant.sku || variant.name)}`;
    const image = variant.images?.[0] || variant.imageUrl || p.image;
    return {
      "@type": "Product",
      name: `${p.name} - ${variant.name}`,
      sku: variant.sku || undefined,
      url: variantUrl,
      image: [image.startsWith("http") ? image : site.url + image],
      offers: {
        "@type": "Offer",
        url: variantUrl,
        priceCurrency: "PKR",
        price: Number(variant.price ?? p.price),
        availability: variant.soldOut || p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      },
      ...(p.variants?.label.toLowerCase().match(/colou?r/) ? { color: variant.name } : {}),
      ...(p.variants?.label.toLowerCase().includes("size") ? { size: variant.name } : {}),
    };
  });
  const productFields = {
    "@context": "https://schema.org",
    name: p.name,
    url,
    sku: p.sku,
    image: [p.image.startsWith("http") ? p.image : site.url + p.image],
    description: p.description,
    brand: { "@type": "Brand", name: site.name },
    category: cat.name,
    ...(reviews.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average.toFixed(1), reviewCount: reviews.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };
  const jsonLd = variantProducts.length
    ? {
        ...productFields,
        "@type": "ProductGroup",
        "@id": `${url}#product-group`,
        productGroupID: p.sku,
        variesBy: p.variants?.label.toLowerCase().includes("size")
          ? ["https://schema.org/size"]
          : p.variants?.label.toLowerCase().match(/colou?r/)
            ? ["https://schema.org/color"]
            : undefined,
        hasVariant: variantProducts.map((variant) => ({ ...variant, isVariantOf: { "@id": `${url}#product-group` } })),
      }
    : {
        ...productFields,
        "@type": "Product",
        offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PKR",
      price: p.price,
      availability: p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: site.name, "@id": `${site.url}/#organization` },
      shippingDetails,
      hasMerchantReturnPolicy: returnPolicy,
        },
      };

  return (
    <div className="product-page">
      <Breadcrumbs items={[{ label: cat.name, href: categoryPath(cat.id) }, { label: p.name }]} />
      <ProductBridge product={p}>
        <ProductDetail slug={p.slug} />
      </ProductBridge>
      <section className="section pd-related">
        <div className="container">
          <SectionHead eyebrow="Keep exploring" title="You may also like" sub={`More from ${cat.name}, plus customer favourites.`} href={categoryPath(cat.id)} linkLabel={`Shop ${cat.short}`} />
          <ProductGrid items={relatedProducts(p)} />
        </div>
      </section>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={String(p.price)} />
      <meta property="product:price:currency" content="PKR" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </div>
  );
}
