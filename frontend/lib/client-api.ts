export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export function adminToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('zelvomart_admin_token') || '';
}
export function setAdminSession(token: string, user: unknown) {
  localStorage.setItem('zelvomart_admin_token', token);
  localStorage.setItem('zelvomart_admin_user', JSON.stringify(user));
}
export function adminUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('zelvomart_admin_user');
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function setAdminUser(user: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('zelvomart_admin_user', JSON.stringify(user));
}
export function clearAdminSession() {
  localStorage.removeItem('zelvomart_admin_token');
  localStorage.removeItem('zelvomart_admin_user');
}
export async function clientApi<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (auth) {
    const token = adminToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || body?.message || `API_${response.status}`);
  return body as T;
}
