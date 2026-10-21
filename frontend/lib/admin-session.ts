import { NextResponse } from "next/server";

/** The admin session cookie (httpOnly). It holds the backend's 2-hour admin token. */
export const ADMIN_SESSION_COOKIE = "zelvomart_admin_session";
export const ADMIN_SESSION_SECONDS = 2 * 60 * 60;

/** Same resolution as the admin proxy: localhost is only a development fallback. */
export function adminBackendBase() {
  const configured = [process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => String(value || "").trim().replace(/\/$/, ""))
    .find((value) => /^https?:\/\//i.test(value));
  if (configured) return configured;
  return process.env.NODE_ENV !== "production" ? "http://localhost:4000" : "";
}

export function adminCookieOptions(maxAge = ADMIN_SESSION_SECONDS) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}

/** Seconds until a JWT expires, read without verifying it (the backend verifies every request). */
export function tokenSecondsLeft(token: string) {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof json.exp === "number" ? json.exp - Math.floor(Date.now() / 1000) : 0;
  } catch {
    return 0;
  }
}

export function adminFail(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POSTs a sign-in step to the backend. A token in the answer becomes the session cookie; anything
 * else (a 2FA challenge, an error) goes back to the login form as it is, with no cookie.
 */
export async function adminSignInStep(backendPath: string, body: string) {
  const base = adminBackendBase();
  if (!base) return adminFail({ error: "BACKEND_URL_NOT_CONFIGURED", message: "Set BACKEND_URL to the deployed Express backend origin." }, 503);
  let upstream: Response;
  try {
    upstream = await fetch(`${base}${backendPath}`, { method: "POST", headers: { "content-type": "application/json" }, body, cache: "no-store" });
  } catch {
    return adminFail({ error: "BACKEND_UNAVAILABLE" }, 503);
  }
  // A crashed backend answers with an HTML/plain-text error page, not JSON. Report that with the upstream status.
  const raw = await upstream.text().catch(() => "");
  let data: Record<string, unknown> | null = null;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    data = null;
  }
  if (!data) return adminFail({ error: "BACKEND_BAD_RESPONSE", upstreamStatus: upstream.status }, 502);
  if (!upstream.ok) return adminFail(data, upstream.status);
  if (!data.token) {
    // Password accepted, code still needed: pass the challenge (and the QR when setting up) to the form.
    if (data.twoFactor === "verify" || data.twoFactor === "enroll") return adminFail(data, 200);
    return adminFail({ error: "BACKEND_BAD_RESPONSE", upstreamStatus: upstream.status }, 502);
  }
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(ADMIN_SESSION_COOKIE, String(data.token), adminCookieOptions(Number(data.expiresIn) || ADMIN_SESSION_SECONDS));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
