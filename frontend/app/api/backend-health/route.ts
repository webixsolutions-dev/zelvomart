import { NextRequest, NextResponse } from "next/server";

function backendCandidates(request: NextRequest) {
  const self = request.nextUrl.origin.replace(/\/$/, "");
  return [...new Set([process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => String(value || "").trim().replace(/\/$/, ""))
    .filter((value) => /^https?:\/\//i.test(value) && value !== self))];
}

export async function GET(request: NextRequest) {
  const candidates = backendCandidates(request);
  if (!candidates.length) return NextResponse.json({ ok:false, error:"BACKEND_URL_NOT_CONFIGURED" }, { status:503 });
  for (const base of candidates) {
    try {
      const upstream = await fetch(`${base}/api/health`, { cache:"no-store" });
      // A crashed backend returns a non-JSON error page; say so instead of answering with {}.
      const data = await upstream.json().catch(() => null);
      if (!data || typeof data !== "object") {
        return NextResponse.json({ ok:false, error:"BACKEND_BAD_RESPONSE", upstreamStatus: upstream.status }, { status:502, headers: { "cache-control":"no-store" } });
      }
      return NextResponse.json(data, { status: upstream.status, headers: { "cache-control":"no-store" } });
    } catch {}
  }
  return NextResponse.json({ ok:false, error:"BACKEND_UNAVAILABLE" }, { status:503 });
}
