import type { Product } from "@/types/product";

const LEGACY_PRODUCT_IMAGES: Record<string, string> = {
  "matte-liquid-lipgloss": "/images/products/legacy/emelie-matte-liquid-lipgloss.jpeg",
  "rhinestone-watch-and-bracelet-set-3-pieces": "/images/products/legacy/rhinestone-watch-and-bracelet-set-3-pieces.webp",
  "complete-jewellery-set-with-watch-4-pieces": "/images/products/legacy/complete-jewellery-set-with-watch-4-pieces.webp",
  "double-bracelet-set-with-watch-3-pieces": "/images/products/legacy/double-bracelet-set-with-watch-3-pieces.webp",
  "bangle-and-bracelet-set-with-watch-3-pieces": "/images/products/legacy/bangle-and-bracelet-set-with-watch-3-pieces.webp",
  "heart-pendant-jewellery-set-with-watch-4-pieces": "/images/products/legacy/heart-pendant-jewellery-set-with-watch-4-pieces.webp",
  "magnetic-building-blocks-set-42-pieces": "/images/products/legacy/magnetic-building-blocks-set-42-pieces.webp",
  "pink-marble-insulated-tumbler-1200ml": "/images/products/legacy/pink-marble-insulated-tumbler-1200ml.webp",
  "colour-changing-h2o-humidifier-with-mist": "/images/products/legacy/colour-changing-h2o-humidifier-with-mist.webp",
  "cordless-neck-shoulder-kneading-massager": "/images/products/legacy/cordless-neck-shoulder-kneading-massager.jpeg",
  "silicone-sink-splash-guard": "/images/products/legacy/silicone-sink-splash-guard.jpeg",
  "adjustable-hand-gripper": "/images/products/legacy/adjustable-hand-gripper.jpeg",
  "emelie-matte-liquid-lipgloss": "/images/products/legacy/emelie-matte-liquid-lipgloss.jpeg",
  "emelie-paris-matte-lip-eye-pencil": "/images/products/legacy/emelie-paris-matte-lip-eye-pencil.jpeg",
  "emelie-paris-waterproof-matte-eyeliner": "/images/products/legacy/emelie-paris-waterproof-matte-eyeliner.webp",
  "1200ml-insulated-tumbler-with-handle": "/images/products/legacy/1200ml-insulated-tumbler-with-handle.webp",
  "textured-handbag-with-shoulder-strap": "/images/products/legacy/textured-handbag-with-shoulder-strap.webp",
};

const CATEGORY_FALLBACKS: Record<string, string> = {
  "home-living": "/images/Zelvomart images/home and living zelvomart.png",
  "home-decor": "/images/Zelvomart images/Home Decor Zelvomart.png",
  "beauty-personal-care": "/images/Zelvomart images/Beauty & Personal Care Zelvomart.png",
  "tech-gadgets": "/images/Zelvomart images/Tech & Gadgets Zelvomart.png",
  "fashion-accessories": "/images/Zelvomart images/Fashion Accessories Zelvomart.png",
  "sports-fitness": "/images/Zelvomart images/Sports & Fitness Zelvomart.png",
  "kids-toys": "/images/Zelvomart images/Kids & Toys Zelvomart.png",
};

const DEFAULT_PRODUCT_IMAGE = "/images/Zelvomart images/Shop Zelvmart.png";

// Product may be missing (e.g. an empty catalog during a build), so fall back to the shop image
export function getProductFallbackImage(product?: Pick<Product, "slug" | "categorySlugs" | "categories"> | null): string {
  if (!product) return DEFAULT_PRODUCT_IMAGE;

  const legacy = LEGACY_PRODUCT_IMAGES[product.slug];
  if (legacy) return legacy;

  const categorySlug = product.categorySlugs?.[0] || product.categories?.[0]?.slug || "";
  if (categorySlug && CATEGORY_FALLBACKS[categorySlug]) return CATEGORY_FALLBACKS[categorySlug];

  return DEFAULT_PRODUCT_IMAGE;
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

  const safeFallback = localLegacy || getProductFallbackImage(product);
  const images = rawImages.length
    ? rawImages.map((row) => {
        if (isLegacyRemoteImage(row.src)) {
          return { ...row, src: safeFallback, alt: row.alt || product.name };
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
