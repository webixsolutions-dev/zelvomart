export function backendBase() {
  const value = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('BACKEND_URL/NEXT_PUBLIC_API_URL is not configured');
  return value.replace(/\/$/, '');
}

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export async function apiFetch<T>(path: string, init: NextFetchInit = {}): Promise<T> {
  const { cache, next, ...rest } = init;
  const noStore = cache === 'no-store';
  const response = await fetch(`${backendBase()}${path}`, {
    ...rest,
    cache: noStore ? 'no-store' : (cache ?? 'force-cache'),
    ...(noStore ? {} : { next: next ?? { revalidate: 300 } }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `API_${response.status}`);
  }
  return response.json() as Promise<T>;
}
