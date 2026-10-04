import { NextRequest, NextResponse } from "next/server";

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

export function proxy(request: NextRequest) {
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
