export function backendBase() {
  const value = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('BACKEND_URL/NEXT_PUBLIC_API_URL is not configured');
  return value.replace(/\/$/, '');
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendBase()}${path}`, { ...init, cache: init?.cache ?? 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `API_${response.status}`);
  }
  return response.json() as Promise<T>;
}
