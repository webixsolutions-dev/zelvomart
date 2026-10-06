import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:4000" : "")).replace(/\/$/, "");
const COOKIE = "zelvomart_order_confirmation";

export async function POST(request: NextRequest) {
  if (!BACKEND_BASE) return NextResponse.json({ error: "BACKEND_URL_NOT_CONFIGURED" }, { status: 503 });

  const body = await request.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_BASE}/api/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": request.headers.get("user-agent") || "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
        "x-real-ip": request.headers.get("x-real-ip") || "",
      },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "BACKEND_UNAVAILABLE" }, { status: 503 });
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data?.orderNumber || !data?.id) {
    return NextResponse.json(data || { error: "ORDER_FAILED" }, { status: upstream.status || 400 });
  }

  const response = NextResponse.json({ orderNumber: data.orderNumber, total: data.total }, { status: 201 });
  response.cookies.set(COOKIE, `${String(data.orderNumber)}:${String(data.id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/checkout/success",
    maxAge: 60 * 60,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
