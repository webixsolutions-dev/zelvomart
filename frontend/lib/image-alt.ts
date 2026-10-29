/**
 * Alt text for product images: one distinct, natural description per image.
 * Image 1 = the product title; a later image that belongs to a variant = "<title> in <variant>";
 * any other = "<title> – view N". A value saved in the admin (Product → images) overrides it.
 * No "image of", prices or delivery text: alt describes the photo, not the offer.
 */

export type AltVariant = { name: string; imageUrl?: string | null; images?: string[] };

export type ImageAltOptions = {
  /** Saved per-image alt text, keyed by image URL (catalog meta `imageMeta.alts`). */
  overrides?: Record<string, unknown> | null;
  /** Older single alt for the main image (catalog meta `imageMeta.alt`, also set by the CSV column `imageAlt`). */
  mainAlt?: unknown;
  variants?: AltVariant[];
};

const clean = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** The generated alt for each image (what the admin sees as the placeholder). */
export function generatedImageAlts(title: string, images: string[], variants: AltVariant[] = []): string[] {
  const name = clean(title) || "Product";
  const used = new Set<string>();
  return images.map((src, i) => {
    let alt = name;
    if (i > 0) {
      const variant = variants.find((v) => clean(v.name) && (v.imageUrl === src || v.images?.includes(src)));
      alt = variant ? `${name} in ${clean(variant.name).replace(/\s*\/\s*/g, ", ")}` : `${name} – view ${i + 1}`;
      if (used.has(alt)) alt = `${alt} – view ${i + 1}`;
    }
    used.add(alt);
    return alt;
  });
}

/** Final alt for each image: the saved text when there is one, else the generated text. */
export function imageAlts(title: string, images: string[], options: ImageAltOptions = {}): string[] {
  const generated = generatedImageAlts(title, images, options.variants);
  return images.map((src, i) => clean(options.overrides?.[src]) || (i === 0 ? clean(options.mainAlt) : "") || generated[i]);
}

/** Saved alt texts worth keeping: only for images still on the product, only non-empty. */
export function keptImageAlts(alts: Record<string, unknown> | null | undefined, images: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const src of images) {
    const value = clean(alts?.[src]);
    if (value) out[src] = value;
  }
  return out;
}
