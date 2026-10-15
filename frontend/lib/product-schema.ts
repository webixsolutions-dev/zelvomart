// Builds the product JSON-LD. The live product page and the admin "Schema" preview both call
// this, so the preview always matches what Google sees.
import type { Product } from "@/types/product";
import type { DeliveryPolicy } from "@/lib/shipping";
import { parseVideoUrl } from "@/lib/product-video";

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";
const NEW_CONDITION = "https://schema.org/NewCondition";

function plain(html?: string | null) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/** What delivery costs for this product alone: free when its free-shipping switch is on. */
export function productDeliveryFee(product: Pick<Product, "freeShipping">, delivery: DeliveryPolicy) {
  return product.freeShipping ? 0 : delivery.flatRate;
}

export function buildProductSchema(product: Product, options: { baseUrl: string; delivery: DeliveryPolicy }) {
  const base = options.baseUrl.replace(/\/$/, "");
  const url = `${base}/product/${product.slug}/`;
  const availability = product.stockStatus === "instock" ? IN_STOCK : OUT_OF_STOCK;
  const images = (product.images || []).map((image) => image.src).filter(Boolean);
  const description = plain(product.shortDescription) || plain(product.description) || product.name;
  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: productDeliveryFee(product, options.delivery), currency: "PKR" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
  };

  const variants = (product.variants || []).filter((variant) => variant.active !== false && variant.enabled !== false);
  let offers: Record<string, unknown>;
  if (variants.length) {
    const prices = variants
      .map((variant) => Number(variant.pricing?.price ?? variant.priceOverride ?? product.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    const low = prices.length ? Math.min(...prices) : Number(product.price);
    const high = prices.length ? Math.max(...prices) : Number(product.price);
    offers = {
      "@type": "AggregateOffer",
      priceCurrency: "PKR",
      lowPrice: low,
      highPrice: high,
      offerCount: variants.length,
      availability,
      itemCondition: NEW_CONDITION,
      url,
      shippingDetails,
    };
  } else {
    offers = {
      "@type": "Offer",
      priceCurrency: "PKR",
      // product.price is already the sale price when the product is on sale.
      price: Number(product.price),
      availability,
      itemCondition: NEW_CONDITION,
      url,
      shippingDetails,
    };
  }

  // VideoObject for the product video: uploadDate is the date the link was added.
  const parsedVideo = parseVideoUrl(product.videoUrl);
  const videoThumbnail = parsedVideo?.thumbnailUrl || product.videoThumbnail || images[0];
  const video = parsedVideo
    ? {
        "@type": "VideoObject",
        name: product.name,
        description,
        ...(videoThumbnail ? { thumbnailUrl: [videoThumbnail] } : {}),
        embedUrl: parsedVideo.provider === "youtube" ? `https://www.youtube.com/embed/${parsedVideo.id}` : `https://player.vimeo.com/video/${parsedVideo.id}`,
        uploadDate: product.videoAddedAt || product.updatedAt || product.createdAt || undefined,
      }
    : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: { "@type": "Brand", name: "Zelvomart" },
    image: images,
    description,
    offers,
    // Only real, approved reviews.
    ...(product.reviewCount && product.averageRating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(product.averageRating.toFixed(1)), reviewCount: product.reviewCount } }
      : {}),
    ...(video ? { subjectOf: video } : {}),
  };
}

export function buildBreadcrumbSchema(product: Product, baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  const category = product.categories?.[0];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: `${base}/product-category/${category.slug}/` }] : []),
      { "@type": "ListItem", position: category ? 3 : 2, name: product.name, item: `${base}/product/${product.slug}/` },
    ],
  };
}
