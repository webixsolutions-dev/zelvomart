import { NextRequest, NextResponse } from "next/server";
import { customerAuthFetch, STORE_SESSION_COOKIE } from "@/lib/account-server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(STORE_SESSION_COOKIE)?.value || "";
  if (token) {
    try { await customerAuthFetch("/api/customer-auth/logout", { method: "POST" }, token); } catch { /* clear local session anyway */ }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STORE_SESSION_COOKIE);
  return response;
}
