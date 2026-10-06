import { NextRequest } from "next/server";

const SAFE_PREFIXES = [
  "/api/events",
  "/api/session-replays/",
  "/api/contact",
  "/api/reviews",
  "/api/orders/",
  "/api/checkout/",
  "/api/experiments/",
];

function backendCandidates(request: NextRequest) {
  const values = [process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => String(value || "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") values.push("http://localhost:4000");

  const selfOrigin = request.nextUrl.origin.replace(/\/$/, "");
  return [...new Set(values)].filter((value) => /^https?:\/\//i.test(value) && value !== selfOrigin);
}

function allowed(path: string) {
  return SAFE_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const backendPath = `/${(path || []).map(encodeURIComponent).join("/")}`;
  if (!allowed(backendPath)) return Response.json({ error: "PROXY_PATH_NOT_ALLOWED" }, { status: 404 });

  const candidates = backendCandidates(request);
  if (!candidates.length) {
    return Response.json(
      { error: "BACKEND_URL_NOT_CONFIGURED", message: "Set BACKEND_URL to the deployed Express backend origin." },
      { status: 503 },
    );
  }

  const method = request.method.toUpperCase();
  const rawBody = ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();
  let lastResponse: Response | undefined;

  for (const base of candidates) {
    try {
      const headers = new Headers();
      const contentType = request.headers.get("content-type");
      if (contentType) headers.set("content-type", contentType);
      const accept = request.headers.get("accept");
      if (accept) headers.set("accept", accept);
      const userAgent = request.headers.get("user-agent");
      if (userAgent) headers.set("user-agent", userAgent);
      const forwardedFor = request.headers.get("x-forwarded-for");
      if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
      const realIp = request.headers.get("x-real-ip");
      if (realIp) headers.set("x-real-ip", realIp);

      const upstream = await fetch(`${base}${backendPath}${request.nextUrl.search}`, {
        method,
        headers,
        body: rawBody,
        cache: "no-store",
      });
      lastResponse = upstream;
      if (upstream.status === 404 && candidates.length > 1) continue;

      const responseHeaders = new Headers();
      const upstreamType = upstream.headers.get("content-type");
      if (upstreamType) responseHeaders.set("content-type", upstreamType);
      responseHeaders.set("cache-control", "no-store");
      return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
    } catch {
      // Try the next configured backend origin.
    }
  }

  if (lastResponse) {
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    const upstreamType = lastResponse.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    return new Response(await lastResponse.arrayBuffer(), { status: lastResponse.status, headers: responseHeaders });
  }

  return Response.json({ error: "BACKEND_UNAVAILABLE" }, { status: 503 });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
