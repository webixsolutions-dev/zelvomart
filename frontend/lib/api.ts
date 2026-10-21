export function backendBase() {
  const value =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : '');

  if (!value) throw new Error('BACKEND_URL/NEXT_PUBLIC_API_URL is not configured');
  return value.replace(/\/$/, '');
}

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

/** A backend answer must arrive within this time, or the request is tried once more. */
const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 300;

/** Last successful answer per GET path on this server, served when the backend fails (better than an empty page). */
const lastGood = new Map<string, unknown>();
const LAST_GOOD_LIMIT = 300;

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Worth one more try: timeouts, dropped connections and 5xx. A 4xx (404, 400) is a real answer. */
const retryable = (error: unknown) => !(error instanceof HttpError) || error.status >= 500;

/**
 * Server-side GET to the backend. Each attempt gives up after 5 s; a failed attempt is retried once.
 * If both fail, the last good answer for the same path is returned (and the failure logged); with none,
 * the error is thrown and the caller shows its own empty or error state. Never invented data.
 */
export async function apiFetch<T>(path: string, init: NextFetchInit = {}): Promise<T> {
  const { cache, next, signal, ...rest } = init;
  // Local development should always reflect admin/database changes immediately.
  // Production still uses Next.js caching + tag/path revalidation.
  const noStore = cache === 'no-store' || process.env.NODE_ENV !== 'production';
  const method = String(rest.method || 'GET').toUpperCase();
  const idempotent = method === 'GET' || method === 'HEAD';
  const url = `${backendBase()}${path}`;

  const attempt = async () => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetch(url, {
      ...rest,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: noStore ? 'no-store' : (cache ?? 'force-cache'),
      ...(noStore ? {} : { next: next ?? { revalidate: 300 } }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new HttpError(body?.error || `API_${response.status}`, response.status);
    }
    return (await response.json()) as T;
  };

  try {
    let data: T;
    try {
      data = await attempt();
    } catch (error) {
      if (!idempotent || !retryable(error) || signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      data = await attempt();
    }
    if (method === 'GET') {
      lastGood.delete(path);
      lastGood.set(path, data);
      if (lastGood.size > LAST_GOOD_LIMIT) lastGood.delete(lastGood.keys().next().value as string);
    }
    return data;
  } catch (error) {
    if (!retryable(error)) throw error;
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (method === 'GET' && lastGood.has(path)) {
      console.error(`[apiFetch] ${path} failed twice (${reason}); serving the last good answer.`);
      return lastGood.get(path) as T;
    }
    console.error(`[apiFetch] ${path} failed twice (${reason}); no earlier answer to fall back on.`);
    throw error;
  }
}
