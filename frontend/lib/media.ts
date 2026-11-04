import { LEGACY_MEDIA_HOST, mediaBase, mediaHtml, mediaUrl as rewrite } from "@zelvomart/media";

/**
 * Where product images, videos and posters are served from: NEXT_PUBLIC_MEDIA_BASE_URL (for example
 * https://media.zelvomart.com), else the old public R2 host. Read the same way on the server and in the browser
 * (the value is built into the page), so server and browser always agree.
 */
export const MEDIA_BASE = mediaBase({ NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL });

/** One URL on the old R2 host, moved to the media base. Other URLs are returned as they are. */
export const mediaUrl = <T,>(url: T): T => rewrite(url, MEDIA_BASE);

/**
 * Every old-host URL anywhere in a value (strings, HTML, arrays, plain objects), moved to the media base.
 * The database keeps the stored URLs; this runs when the storefront reads them.
 */
export function withMediaUrls<T>(value: T): T {
  if (MEDIA_BASE === LEGACY_MEDIA_HOST) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.includes(LEGACY_MEDIA_HOST) ? mediaHtml(v, MEDIA_BASE) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(v)) out[key] = walk(item);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
