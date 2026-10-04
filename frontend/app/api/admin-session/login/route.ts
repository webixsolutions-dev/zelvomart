import { NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const SESSION_COOKIE = "zelvomart_admin_session";

export async function POST(request: Request) {
  const body = await request.text();
  let upstream: Response;

  try {
    upstream = await fetch(`${BACKEND_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "BACKEND_UNAVAILABLE" }, { status: 503 });
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data?.token) {
    return NextResponse.json(data || { error: "LOGIN_FAILED" }, { status: upstream.status || 401 });
  }

  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, String(data.token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
