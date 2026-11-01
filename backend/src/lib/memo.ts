/**
 * Small in-memory cache for data that rarely changes (settings, categories, cities, redirects, policy pages).
 * - memo(key, ttlMs, loader): the first caller loads, callers in the next ttlMs get the same value; callers that
 *   arrive while it loads share that one load (no stampede). A failed load is not cached.
 * - forget(prefix): drops every key that starts with prefix; admin saves call it so the change shows at once.
 * Per process: on serverless each running instance has its own copy (see lib/cache-invalidation.ts for how the
 * storefront is refreshed again once every copy has expired).
 */
type Entry = { value: unknown; expires: number };

const values = new Map<string, Entry>();
const loading = new Map<string, Promise<unknown>>();
/** Bumped by forget(): a load that started before a save must not store the older value. */
const generations = new Map<string, number>();
const MAX_KEYS = 500;

export const MEMO_TTL_MS = 60_000;

export async function memo<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = values.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = loading.get(key);
  if (pending) return pending as Promise<T>;
  const generation = generations.get(key) ?? 0;
  const load = loader()
    .then((value) => {
      // A save that happened while this load was running wins: do not store the older value.
      if ((generations.get(key) ?? 0) === generation) {
        values.set(key, { value, expires: Date.now() + ttlMs });
        if (values.size > MAX_KEYS) values.delete(values.keys().next().value as string);
      }
      return value;
    })
    .finally(() => loading.delete(key));
  loading.set(key, load);
  return load;
}

/** Forget cached values whose key starts with `prefix` ("" clears everything). */
export function forget(prefix: string) {
  for (const key of [...values.keys(), ...loading.keys()]) {
    if (!key.startsWith(prefix)) continue;
    values.delete(key);
    loading.delete(key);
    generations.set(key, (generations.get(key) ?? 0) + 1);
  }
}

/** Test helper: number of cached keys. */
export function memoSize() {
  return values.size;
}
