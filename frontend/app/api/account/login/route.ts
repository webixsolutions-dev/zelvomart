import { NextRequest, NextResponse } from "next/server";
import { customerAuthFetch, STORE_SESSION_COOKIE, STORE_SESSION_MAX_AGE } from "@/lib/account-server";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const upstream = await customerAuthFetch("/api/customer-auth/login", { method: "POST", body: JSON.stringify(payload) });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return NextResponse.json(body, { status: upstream.status });
    const response = NextResponse.json({ user: body.user, expiresAt: body.expiresAt });
    response.cookies.set(STORE_SESSION_COOKIE, String(body.token), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + STORE_SESSION_MAX_AGE * 1000),
    });
    return response;
  } catch {
    return NextResponse.json({ error: "AUTH_BACKEND_UNAVAILABLE" }, { status: 503 });
  }
}
