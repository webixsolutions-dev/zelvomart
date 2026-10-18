import {friendlyError,notifyError} from './app-errors';
import { prepareImageForUpload } from './image-convert';

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const ADMIN_PROXY_PREFIX = '/api/admin-proxy';

export function adminProxyUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${ADMIN_PROXY_PREFIX}${normalized}`;
}

export async function logoutAdminSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('zelvomart_admin_token');
  localStorage.removeItem('zelvomart_admin_user');
  try {
    await fetch('/api/admin-session/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  } catch {}
}

async function handleUnauthorized(response: Response) {
  if (response.status !== 401 || typeof window === 'undefined') return;
  await logoutAdminSession();
  if (!window.location.pathname.startsWith('/admin/login')) {
    window.location.replace('/admin/login');
  }
}

export async function adminFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(adminProxyUrl(path), {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  await handleUnauthorized(response);
  return response;
}

export async function clientApi<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');

  let response:Response;
  try{response = auth
    ? await adminFetch(path, { ...init, headers })
    : await fetch(`${API_BASE}${path}`, { ...init, headers });}
  catch(error){if(init.signal?.aborted||error instanceof Error&&error.name==='AbortError')throw error;notifyError(error);throw new Error(friendlyError(error));}

  const body = await response.json().catch(() => null);
  if (!response.ok) {const reason=body?.message||body?.error||'';notifyError(reason,response.status);throw new Error(friendlyError(reason,response.status));}
  return body as T;
}

/** Converts the image to WebP in the browser (lib/image-convert.ts), then uploads it to R2. */
export async function uploadAdminImage(original: File | Blob, name = original instanceof File ? original.name : 'image'): Promise<string> {
  const file = await prepareImageForUpload(original, name);
  const data = new FormData();
  data.append('file', file);

  let response: Response;
  try {
    response = await adminFetch('/api/admin/upload', { method: 'POST', body: data });
  } catch {
    throw new Error(`Unable to upload "${file.name}": the server could not be reached.`);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = body?.message || String(body?.error || `API_${response.status}`).replace(/_/g, ' ');
    throw new Error(/^unable to upload/i.test(reason) ? reason : `Unable to upload "${file.name}": ${reason}`);
  }
  const url = body?.url || body?.data?.url;
  if (!url) throw new Error(`Unable to upload "${file.name}": Cloudflare did not return an image URL.`);
  return url;
}
