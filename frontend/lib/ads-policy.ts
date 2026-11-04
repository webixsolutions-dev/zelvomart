/**
 * Meta and TikTok pixels run only on the real shop: APP_ENV=production AND the page's host is exactly the host of
 * NEXT_PUBLIC_SITE_URL (https). Previews, *.vercel.app and staging stay silent. Google Analytics is not covered.
 * The backend applies the same rule to its server-side conversion events (backend/src/lib/ads-policy.ts).
 */
export function adsSiteHost(siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL) {
  try {
    const url = new URL(String(siteUrl || ""));
    return url.protocol === "https:" ? url.host.toLowerCase() : "";
  } catch {
    return "";
  }
}

/** The storefront's own APP_ENV when it is set, else the backend's (sent in the store bootstrap settings). */
export function adsEnvironment(storefrontAppEnv: string | undefined, backendAppEnv: unknown) {
  const value = String(storefrontAppEnv || backendAppEnv || "").trim().toLowerCase();
  return value === "production";
}

export function adsHostAllowed(host: string, siteUrl?: string) {
  const site = adsSiteHost(siteUrl);
  return !!site && String(host || "").toLowerCase() === site;
}
