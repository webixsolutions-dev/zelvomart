import { NextRequest, NextResponse } from "next/server";
import { storefrontRedirect } from "./storefront/lib/redirects";

const SESSION_COOKIE = "zelvomart_admin_session";

function tokenLooksCurrent(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return typeof decoded.exp !== "number" || decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// Old URL -> destination (Admin redirects and product "Old URL" redirects). Kept in memory and
// refreshed every 2 minutes, so a page view costs a map lookup, not a request. Permanent ones
// answer with a real 301; the page-level redirect stays as the fallback when the map is unavailable.
const REDIRECT_TTL_MS = 120_000;
let redirectMap: Map<string, { destination: string; permanent: boolean }> | null = null;
let redirectLoadedAt = 0;
let redirectLoading: Promise<void> | null = null;

function backendUrl() {
  return (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
}

async function loadRedirects() {
  const base = backendUrl();
  if (!base) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${base}/api/redirects/map`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!response.ok) return;
    const rows = (await response.json()) as [string, string, number][];
    redirectMap = new Map(rows.map(([source, destination, permanent]) => [source, { destination, permanent: permanent === 1 }]));
    redirectLoadedAt = Date.now();
  } catch {
    // Keep the previous map; the page-level redirect still works.
  } finally {
    redirectLoading = null;
  }
}

async function findRedirect(pathname: string) {
  const stale = Date.now() - redirectLoadedAt > REDIRECT_TTL_MS;
  if (stale && !redirectLoading) redirectLoading = loadRedirects();
  // First request of a fresh instance waits for the map; later refreshes happen in the background.
  if (!redirectMap && redirectLoading) await redirectLoading;
  if (!redirectMap) return null;
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return redirectMap.get(withSlash) || redirectMap.get(pathname) || null;
}

const withSlash = (path: string) => (path.endsWith("/") || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`);

/** Keeps the visitor's query (utm tags, the order key) on top of any query the target already has. */
function withQuery(target: URL, request: NextRequest) {
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) target.searchParams.append(key, value);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login") return NextResponse.next();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value || "";
    if (!token || !tokenLooksCurrent(token)) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      const response = NextResponse.redirect(url);
      if (token) response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    return NextResponse.next();
  }

  if (request.method === "GET" || request.method === "HEAD") {
    const replacement = storefrontRedirect(pathname);
    if (replacement) return NextResponse.redirect(withQuery(new URL(replacement, request.url), request), 301);
    const hit = await findRedirect(pathname);
    if (hit) {
      const target = new URL(hit.destination, request.url);
      if (target.origin === request.nextUrl.origin) target.pathname = withSlash(target.pathname);
      if (target.pathname !== withSlash(pathname) || target.origin !== request.nextUrl.origin) {
        if (!/^https?:\/\//i.test(hit.destination)) withQuery(target, request);
        return NextResponse.redirect(target, hit.permanent ? 301 : 302);
      }
    }
    // Every storefront URL ends with "/"; the form without it answers one 301.
    // A plain URL: NextURL would drop the slash again, because next.config keeps trailingSlash off.
    const raw = new URL(request.url);
    if (!raw.pathname.endsWith("/")) {
      raw.pathname = `${raw.pathname}/`;
      return NextResponse.redirect(raw, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Pages only: no Next assets, API routes or files with an extension.
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
