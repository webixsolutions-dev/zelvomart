/**
 * Ad pixels and server-side conversion events (Meta, TikTok) run only on the real shop: APP_ENV=production AND the
 * page's host is exactly the host of NEXT_PUBLIC_SITE_URL (https, never /admin). Previews, *.vercel.app and staging
 * stay silent. Google Analytics (gtag) is not covered by this rule.
 */
type Env = { APP_ENV?: string; NEXT_PUBLIC_SITE_URL?: string };

export function adsEnvironment(env: Env = process.env) {
  return (
    String(env.APP_ENV || "")
      .trim()
      .toLowerCase() === "production"
  );
}

export function adsSiteHost(env: Env = process.env) {
  try {
    const url = new URL(String(env.NEXT_PUBLIC_SITE_URL || ""));
    return url.protocol === "https:" ? url.host.toLowerCase() : "";
  } catch {
    return "";
  }
}

export function adsAllowedForUrl(pageUrl: string | undefined | null, env: Env = process.env) {
  const host = adsSiteHost(env);
  if (!adsEnvironment(env) || !host || !pageUrl) return false;
  try {
    const url = new URL(pageUrl);
    return url.protocol === "https:" && url.host.toLowerCase() === host && !/^\/admin(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}
