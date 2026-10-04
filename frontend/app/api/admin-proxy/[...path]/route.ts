import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const SESSION_COOKIE = "zelvomart_admin_session";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { path } = await context.params;
  const backendPath = `/${(path || []).map(encodeURIComponent).join("/")}`;
  const target = `${BACKEND_BASE}${backendPath}${request.nextUrl.search}`;
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const method = request.method.toUpperCase();
  const init: RequestInit = { method, headers, cache: "no-store" };
  if (!["GET", "HEAD"].includes(method)) init.body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return Response.json({ error: "BACKEND_UNAVAILABLE" }, { status: 503 });
  }

  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-disposition", "cache-control"]) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  responseHeaders.set("Cache-Control", "no-store");

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
