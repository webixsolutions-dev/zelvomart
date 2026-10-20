import { NextRequest } from "next/server";

const SAFE_PREFIXES = [
  "/api/events",
  "/api/session-replays/",
  "/api/contact",
  "/api/reviews",
  "/api/orders/",
  "/api/checkout/",
  "/api/recovery/",
  "/api/settings/delivery",
  "/api/settings/public",
  "/api/cities",
];

function backendCandidates(request: NextRequest): string[] {
  const values = [process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => String(value || "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    values.push("http://localhost:4000");
  }

  const selfOrigin = request.nextUrl.origin.replace(/\/$/, "");
  return [...new Set(values)].filter(
    (value) => /^https?:\/\//i.test(value) && value !== selfOrigin,
  );
}

function allowed(path: string): boolean {
  return SAFE_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix),
  );
}

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const backendPath = `/${(path || []).map(encodeURIComponent).join("/")}`;

  if (!allowed(backendPath)) {
    return Response.json({ error: "PROXY_PATH_NOT_ALLOWED" }, { status: 404 });
  }

  const isSessionReplay = backendPath.startsWith("/api/session-replays");
  const isExperiment = backendPath.startsWith("/api/experiments");
  const isTelemetry = isSessionReplay || isExperiment;

  const candidates = backendCandidates(request);

  // If no backend is reachable or configured
  if (!candidates.length) {
    if (isSessionReplay) {
      return Response.json({ error: 'REPLAY_BACKEND_UNAVAILABLE' }, { status: 503 });
    }
    if (isExperiment) {
      return Response.json({ active: [], experiments: [] }, { status: 200 });
    }
    return Response.json(
      {
        error: "BACKEND_URL_NOT_CONFIGURED",
        message: "Set BACKEND_URL to the deployed backend origin.",
      },
      { status: 503 },
    );
  }

  const method = request.method.toUpperCase();
  const rawBody = ["GET", "HEAD"].includes(method)
    ? undefined
    : await request.arrayBuffer();

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
      const referer = request.headers.get("referer");
      if (referer) headers.set("referer", referer);
      const origin = request.headers.get("origin");
      if (origin) headers.set("origin", origin);

      const upstream = await fetch(
        `${base}${backendPath}${request.nextUrl.search}`,
        {
          method,
          headers,
          body: rawBody,
          cache: "no-store",
        },
      );

      lastResponse = upstream;

      // If route is 404 and there are multiple fallback backends, try next candidate
      if (upstream.status === 404 && candidates.length > 1) {
        continue;
      }

      // Successful responses pass through directly
      if (upstream.ok) {
        const responseHeaders = new Headers();
        const upstreamType = upstream.headers.get("content-type");
        if (upstreamType) responseHeaders.set("content-type", upstreamType);
        responseHeaders.set("cache-control", "no-store");

        return new Response(await upstream.arrayBuffer(), {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      // Preserve client errors (401 Unauthorized, 403 Forbidden, 404 Not Found)
      // so authentication or route configuration issues remain visible in DevTools
      if (upstream.status >= 400 && upstream.status < 500) {
        const responseHeaders = new Headers();
        const upstreamType = upstream.headers.get("content-type");
        if (upstreamType) responseHeaders.set("content-type", upstreamType);
        responseHeaders.set("cache-control", "no-store");

        return new Response(await upstream.arrayBuffer(), {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      // For non-critical telemetry endpoints failing with 5xx server crashes:
      if (isTelemetry) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[store-proxy] Telemetry upstream failed (${upstream.status}) at ${backendPath} — acknowledging gracefully to prevent log flooding.`,
          );
        }

        if (isSessionReplay) {
          return Response.json({ error: 'REPLAY_BACKEND_UNAVAILABLE' }, { status: 503 });
        }
        if (isExperiment) {
          return Response.json({ active: [], experiments: [] }, { status: 200 });
        }
      }

      // Business-critical endpoints (checkout, orders, contact, reviews) return their actual 5xx status
      const responseHeaders = new Headers();
      const upstreamType = upstream.headers.get("content-type");
      if (upstreamType) responseHeaders.set("content-type", upstreamType);
      responseHeaders.set("cache-control", "no-store");

      return new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      // Network failure on this candidate; loop to the next configured origin
    }
  }

  // Graceful fallback if all backend candidates are completely down/unreachable
  if (isSessionReplay) {
    return Response.json({ error: 'REPLAY_BACKEND_UNAVAILABLE' }, { status: 503 });
  }
  if (isExperiment) {
    return Response.json({ active: [], experiments: [] }, { status: 200 });
  }

  if (lastResponse) {
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    const upstreamType = lastResponse.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);

    return new Response(await lastResponse.arrayBuffer(), {
      status: lastResponse.status,
      headers: responseHeaders,
    });
  }

  return Response.json({ error: "BACKEND_UNAVAILABLE" }, { status: 503 });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;