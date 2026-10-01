import type { Product } from "@/types/product";

const LEGACY_PRODUCT_IMAGES: Record<string, string> = {
  "matte-liquid-lipgloss": "/images/products/matte-liquid-lipgloss.jpeg",
  "emelie-matte-liquid-lipgloss": "/images/products/matte-liquid-lipgloss.jpeg",
};

const CATEGORY_FALLBACKS: Record<string, string> = {
  "home-living": "/images/categories/home-living.svg",
  "home-decor": "/images/categories/home-decor.svg",
  "beauty-personal-care": "/images/categories/beauty-personal-care.svg",
  "tech-gadgets": "/images/categories/tech-gadgets.svg",
  "fashion-accessories": "/images/categories/fashion-accessories.svg",
  "sports-fitness": "/images/categories/sports-fitness.svg",
};

export function getProductFallbackImage(product: Pick<Product, "slug" | "categorySlugs" | "categories">): string {
  const legacy = LEGACY_PRODUCT_IMAGES[product.slug];
  if (legacy) return legacy;

  const categorySlug = product.categorySlugs?.[0] || product.categories?.[0]?.slug || "";
  if (categorySlug && CATEGORY_FALLBACKS[categorySlug]) return CATEGORY_FALLBACKS[categorySlug];

  return "/images/hero/zelvomart-shopping.svg";
}

function isLegacyRemoteImage(src: string): boolean {
  return /^https?:\/\/(?:www\.)?zelvomart\.com\/wp-content\/uploads\//i.test(src);
}

export function withProductMedia(product: Product): Product {
  const localLegacy = LEGACY_PRODUCT_IMAGES[product.slug];
  const rawImages = Array.isArray(product.images) ? product.images.filter((row) => row?.src) : [];
  const currentImage = product.image || rawImages[0]?.src || "";

  // When a product came from the old WooCommerce site and we have recovered
  // its original asset from the supplied backup, prefer the local copy. This
  // avoids a broken/slow dependency on the old WordPress host.
  const preferredImage = localLegacy && (!currentImage || isLegacyRemoteImage(currentImage))
    ? localLegacy
    : currentImage || getProductFallbackImage(product);

  const images = rawImages.length
    ? rawImages.map((row, index) => {
        if (index === 0 && localLegacy && isLegacyRemoteImage(row.src)) {
          return { ...row, src: localLegacy };
        }
        return row;
      })
    : [{ src: preferredImage, alt: product.name }];

  if (preferredImage && !images.some((row) => row.src === preferredImage)) {
    images.unshift({ src: preferredImage, alt: product.name });
  }

  return {
    ...product,
    image: preferredImage,
    images,
  };
}
