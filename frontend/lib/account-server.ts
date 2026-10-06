import { backendBase } from "@/lib/api";

export const STORE_SESSION_COOKIE = "zelvo_store_session";
export const STORE_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function customerAuthFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${backendBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
