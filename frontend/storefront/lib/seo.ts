import type { Metadata } from "next";
import { site } from "./site";

type OgImage = { url: string; width: number; height: number; alt: string };

/** The brand share image: logo, "Everyday things, chosen better" and a product collage. */
export const OG_HOME: OgImage = { url: "/brand/og-home.jpg", width: 1200, height: 630, alt: "Zelvomart: everyday things, chosen better" };

/** A page's desktop banner, cropped to 1200 × 630 JPG (see /public/images/og). */
export function bannerOg(banner: string, alt: string): OgImage {
  // The listing banners are named "<page>-desktop.webp" (and "all-products" for /shop/); their share images
  // are /images/og/<page>.jpg ("shop.jpg"). Category banners already match ("category-home-living").
  const file = banner.split("/").pop()!.replace(/\.\w+$/, "").replace(/-desktop$/, "");
  const name = file === "all-products" ? "shop" : file;
  return { url: `/images/og/${name}.jpg`, width: 1200, height: 630, alt };
}

/**
 * A product's share image: its first photo from the backend.
 * TODO(api): the backend keeps JPG catalog copies only for the feeds; when the product API returns
 * that `feedImageUrl`, use it here (WhatsApp and Facebook prefer JPG over WebP).
 */
export function productOg(image: string, alt: string): OgImage {
  return { url: image, width: 1200, height: 1200, alt };
}

/**
 * Sharing tags for a page (WhatsApp, Facebook, Instagram, X): og:title/description/image/url/type,
 * site name, en_PK locale and a large Twitter card. Images are JPG, never WebP.
 * Products pass `type: null` and add og:type=product plus price tags themselves (Next has no "product" type).
 */
export function shareMeta({
  title,
  description,
  path,
  image = OG_HOME,
  type = "website",
}: {
  title: string;
  description: string;
  /** Page path for og:url; "" when the page writes og:url itself (the home page). */
  path: string;
  image?: OgImage;
  type?: "website" | null;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      ...(type ? { type } : {}),
      title,
      description,
      ...(path ? { url: path } : {}),
      siteName: site.name,
      locale: site.locale,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

const BRAND_SUFFIX = " | Zelvomart";

/** "… | Zelvomart", "… - Zelvomart" and the like at the end of a saved SEO title. */
const TRAILING_BRAND = /\s*[|\-–—:]\s*zelvomart\s*$/i;

/**
 * The product page <title>: the saved SEO title (or "<name> Price in Pakistan"), with " | Zelvomart" added once
 * when it fits in 60 characters. A saved title that already ends with the brand is not given a second one.
 */
export function productTitle(p: { seoTitle?: string | null; name: string }) {
  const saved = p.seoTitle?.trim() || "";
  const base = saved.replace(TRAILING_BRAND, "").trim() || `${p.name} Price in Pakistan`;
  if (base.length + BRAND_SUFFIX.length <= 60) return base + BRAND_SUFFIX;
  return saved || base; // too long for the suffix: keep exactly what was saved
}
