/**
 * Media URLs, used by the storefront and the backend. The database still stores full URLs on the old public R2
 * host; they are rewritten to the media domain when read (never in the database). Same keys on both hosts
 * (`/products/<hash>.webp`, `/videos/<name>.mp4`).
 *
 * Base, first set wins: NEXT_PUBLIC_MEDIA_BASE_URL, S3_PUBLIC_BASE_URL, then the old host (no change).
 */
const LEGACY_MEDIA_HOST = "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev";

function cleanBase(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  return /^https:\/\/[^/\s]+(\/[^\s]*)?$/i.test(text) ? text : "";
}

/** The base URL media is served from (no trailing slash). */
function mediaBase(env) {
  const source = env || {};
  return cleanBase(source.NEXT_PUBLIC_MEDIA_BASE_URL) || cleanBase(source.S3_PUBLIC_BASE_URL) || LEGACY_MEDIA_HOST;
}

/** One URL: the old R2 host becomes the media base; anything else is returned unchanged. */
function mediaUrl(url, base) {
  if (typeof url !== "string") return url;
  const target = cleanBase(base) || LEGACY_MEDIA_HOST;
  return url.startsWith(LEGACY_MEDIA_HOST + "/") ? target + url.slice(LEGACY_MEDIA_HOST.length) : url;
}

/** Every old-host URL inside HTML (src, srcset, href, poster). */
function mediaHtml(html, base) {
  if (typeof html !== "string" || !html.includes(LEGACY_MEDIA_HOST)) return html;
  const target = cleanBase(base) || LEGACY_MEDIA_HOST;
  return html.split(LEGACY_MEDIA_HOST + "/").join(target + "/");
}

exports.LEGACY_MEDIA_HOST = LEGACY_MEDIA_HOST;
exports.mediaBase = mediaBase;
exports.mediaUrl = mediaUrl;
exports.mediaHtml = mediaHtml;
