import { waitUntil } from "@vercel/functions";

/**
 * Runs work after the response has been sent, on any host.
 * - On Vercel: hands the promise to `waitUntil`, so the function is not frozen before the work finishes.
 * - On a plain Node server (VPS, Docker, local): the process keeps running, so the promise simply continues.
 * Errors are logged, never thrown: background work must not break the request that started it.
 */
export function runInBackground(label: string, task: Promise<unknown> | (() => Promise<unknown>)) {
  const promise = Promise.resolve()
    .then(() => (typeof task === "function" ? task() : task))
    .catch((error) => console.error(`[background] ${label} failed:`, error instanceof Error ? error.message : error));
  if (process.env.VERCEL) {
    try {
      waitUntil(promise);
    } catch {
      // No request context (e.g. called outside a request): the promise still runs.
    }
  }
  return promise;
}
