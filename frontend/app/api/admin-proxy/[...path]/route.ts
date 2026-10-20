import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import {revalidatePath,revalidateTag} from 'next/cache';

const SESSION_COOKIE = "zelvomart_admin_session";

function backendCandidates(request: NextRequest) {
  const values = [process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => String(value || "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") values.push("http://localhost:4000");

  const selfOrigin = request.nextUrl.origin.replace(/\/$/, "");
  return [...new Set(values)].filter((value) => /^https?:\/\//i.test(value) && value !== selfOrigin);
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { path } = await context.params;
  const backendPath = `/${(path || []).map(encodeURIComponent).join("/")}`;
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
      headers.set("authorization", `Bearer ${token}`);
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

      const upstream = await fetch(`${base}${backendPath}${request.nextUrl.search}`, {
        method,
        headers,
        body: rawBody,
        cache: "no-store",
      });
      lastResponse = upstream;
      if (upstream.status === 404 && candidates.length > 1) continue;
      if(upstream.ok&&['PUT','PATCH','POST'].includes(method)&&['/api/admin/settings','/api/admin/cities'].includes(backendPath)){
        for(const tag of ['settings','store','products','cities'])revalidateTag(tag,{expire:0});
        revalidatePath('/','layout');
      }

      const responseHeaders = new Headers();
      for (const key of ["content-type", "content-disposition", "cache-control"]) {
        const value = upstream.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
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
