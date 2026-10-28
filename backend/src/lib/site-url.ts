const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.zelvomart.com";
function canonicalSiteOrigin(value: string) {
  try {
    const url = new URL(value);
    if (
      ["zelvomart.com", "www.zelvomart.com", "zelvomart.vercel.app", "zelvomart-frontend.vercel.app"].includes(
        url.hostname,
      )
    )
      return "https://www.zelvomart.com";
    return url.origin;
  } catch {
    return "https://www.zelvomart.com";
  }
}
export const SITE_ORIGIN = canonicalSiteOrigin(configuredSiteUrl);
export function isStorefrontUrl(value: string) {
  try {
    const url = new URL(value),
      site = new URL(SITE_ORIGIN);
    const hosts = ["zelvomart-frontend.vercel.app", "zelvomart.vercel.app", "zelvomart.com", "www.zelvomart.com"];
    if (site.protocol === "https:" && site.hostname !== "localhost") hosts.push(site.hostname);
    return url.protocol === "https:" && hosts.includes(url.hostname) && !/^\/admin(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}
