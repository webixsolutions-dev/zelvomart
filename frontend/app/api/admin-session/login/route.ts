import { NextResponse } from "next/server";

const SESSION_COOKIE = "zelvomart_admin_session";

// Same resolution as the admin proxy: localhost is only a development fallback.
function backendBase() {
  const configured = [process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => String(value || "").trim().replace(/\/$/, ""))
    .find((value) => /^https?:\/\//i.test(value));
  if (configured) return configured;
  return process.env.NODE_ENV !== "production" ? "http://localhost:4000" : "";
}

function fail(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const base = backendBase();
  if (!base) {
    return fail({ error: "BACKEND_URL_NOT_CONFIGURED", message: "Set BACKEND_URL to the deployed Express backend origin." }, 503);
  }

  const body = await request.text();
  let upstream: Response;

  try {
    upstream = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return fail({ error: "BACKEND_UNAVAILABLE" }, 503);
  }

  // A crashed backend answers with an HTML/plain-text error page, not JSON. Report that
  // with the upstream status instead of passing an empty object back to the login form.
  const raw = await upstream.text().catch(() => "");
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return fail({ error: "BACKEND_BAD_RESPONSE", upstreamStatus: upstream.status }, 502);
  }

  if (!upstream.ok) return fail(data, upstream.status);
  if (!data.token) return fail({ error: "BACKEND_BAD_RESPONSE", upstreamStatus: upstream.status }, 502);

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
