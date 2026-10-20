import type { Metadata } from "next";
import { site } from "./site";

type OgImage = { url: string; width: number; height: number; alt: string };

/** The brand share image: logo, "Everyday things, chosen better" and a product collage. */
export const OG_HOME: OgImage = { url: "/brand/og-home.jpg", width: 1200, height: 630, alt: "Zelvomart: everyday things, chosen better" };

/** A page's desktop banner, cropped to 1200 × 630 JPG (see /public/images/og). */
export function bannerOg(banner: string, alt: string): OgImage {
  const name = banner.split("/").pop()!.replace(/\.\w+$/, "");
  return { url: `/images/og/${name}.jpg`, width: 1200, height: 630, alt };
}

/** A product's first image as a 1200 px JPG copy. */
export function productOg(image: string, alt: string): OgImage {
  const name = image.split("/").pop()!.replace(/\.\w+$/, "");
  return { url: `/images/og/products/${name}.jpg`, width: 1200, height: 1200, alt };
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
  path: string;
  image?: OgImage;
  type?: "website" | null;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      ...(type ? { type } : {}),
      title,
      description,
      url: path,
      siteName: site.name,
      locale: site.locale,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
