import { NextRequest, NextResponse } from "next/server";
import { customerAuthFetch, STORE_SESSION_COOKIE } from "@/lib/account-server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(STORE_SESSION_COOKIE)?.value || "";
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const upstream = await customerAuthFetch("/api/customer-auth/me", { method: "GET" }, token);
    const body = await upstream.json().catch(() => ({}));
    const response = NextResponse.json(body, { status: upstream.status });
    if (upstream.status === 401) response.cookies.delete(STORE_SESSION_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ error: "AUTH_BACKEND_UNAVAILABLE" }, { status: 503 });
  }
}
