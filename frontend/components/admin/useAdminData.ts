"use client";

import { createElement, useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";

type CacheEntry<T = unknown> = {
  data: T;
  fetchedAt: number;
};

const ADMIN_CACHE_TTL_MS = 5 * 60_000;
const adminMemoryCache = new Map<string, CacheEntry>();
const adminInflight = new Map<string, Promise<unknown>>();
const ADMIN_SESSION_CACHE_KEY = "zelvomart:admin-data:v1";

// Persist only catalog/reference data. Orders, customers, sessions and auth state are never cached here.
function isPersistableAdminPath(path: string) {
  return /^\/api\/admin\/(?:products|categories|coupons)(?:\/[^?]*)?(?:\?.*)?$/.test(
    path,
  );
}

function readSessionCache<T>(path: string): CacheEntry<T> | undefined {
  if (!isPersistableAdminPath(path)) return;
  try {
    const cache = JSON.parse(
      sessionStorage.getItem(ADMIN_SESSION_CACHE_KEY) || "{}",
    ) as Record<string, CacheEntry<T>>;
    const entry = cache[path];
    return entry && typeof entry.fetchedAt === "number" ? entry : undefined;
  } catch {
    return;
  }
}

function writeSessionCache(path: string, entry: CacheEntry) {
  if (!isPersistableAdminPath(path)) return;
  try {
    const cache = JSON.parse(
      sessionStorage.getItem(ADMIN_SESSION_CACHE_KEY) || "{}",
    ) as Record<string, CacheEntry>;
    cache[path] = entry;
    sessionStorage.setItem(ADMIN_SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage may be unavailable or full; the in-memory cache still works.
  }
}

function getCache<T>(path: string): CacheEntry<T> | undefined {
  return (
    (adminMemoryCache.get(path) as CacheEntry<T> | undefined) ||
    readSessionCache<T>(path)
  );
}

function isFresh(entry?: CacheEntry) {
  return Boolean(entry && Date.now() - entry.fetchedAt < ADMIN_CACHE_TTL_MS);
}

async function requestAdminData<T>(path: string, force = false): Promise<T> {
  const cached = getCache<T>(path);
  if (!force && isFresh(cached)) return cached!.data;

  const running = adminInflight.get(path);
  if (running) return running as Promise<T>;

  const request = clientApi<T>(path, {}, true)
    .then((result) => {
      const entry = { data: result, fetchedAt: Date.now() };
      adminMemoryCache.set(path, entry);
      writeSessionCache(path, entry);
      return result;
    })
    .finally(() => {
      adminInflight.delete(path);
    });

  adminInflight.set(path, request as Promise<unknown>);
  return request;
}

export function prefetchAdminData(path: string) {
  void requestAdminData(path).catch(() => undefined);
}

export function clearAdminDataCache(path?: string) {
  if (path) {
    adminMemoryCache.delete(path);
    adminInflight.delete(path);
    if (isPersistableAdminPath(path)) {
      try {
        const cache = JSON.parse(
          sessionStorage.getItem(ADMIN_SESSION_CACHE_KEY) || "{}",
        ) as Record<string, CacheEntry>;
        delete cache[path];
        sessionStorage.setItem(ADMIN_SESSION_CACHE_KEY, JSON.stringify(cache));
      } catch {}
    }
    return;
  }
  adminMemoryCache.clear();
  adminInflight.clear();
  try {
    sessionStorage.removeItem(ADMIN_SESSION_CACHE_KEY);
  } catch {}
}

export function useAdminData<T>(path: string, initial: T) {
  const cachedAtRender = getCache<T>(path);
  const [data, setData] = useState<T>(() => cachedAtRender?.data ?? initial);
  const [loading, setLoading] = useState(
    () => !cachedAtRender && initial === null,
  );
  const [error, setError] = useState("");

  const fetchData = useCallback(
    async (force: boolean) => {
      const cachedBeforeRequest = getCache<T>(path);

      // Serve cached data immediately and refresh stale data quietly in background.
      if (cachedBeforeRequest) {
        setData(cachedBeforeRequest.data);
        setLoading(false);
      }

      try {
        const result = await requestAdminData<T>(path, force);
        setData(result);
        setError("");
        return result;
      } catch (requestError: unknown) {
        // If stale cached data exists, keep the page usable instead of replacing it with an error screen.
        if (!cachedBeforeRequest) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Request failed",
          );
        }
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    const cached = getCache<T>(path);
    if (cached) {
      setData(cached.data);
      setLoading(false);
      if (!isFresh(cached)) void fetchData(false);
      return;
    }

    // List/object pages render their supplied initial state immediately while data arrives.
    // Detail pages that pass null may still show a first-load state, but revisits are instant from memory cache.
    void fetchData(false);
  }, [path, fetchData]);

  const reload = useCallback(() => fetchData(true), [fetchData]);

  return { data, setData, loading, error, reload };
}

export function AdminLoading() {
  return createElement(
    "div",
    {
      className: "admin-card admin-loading-state",
      role: "status",
      "aria-label": "Loading",
      "aria-busy": true,
    },
    createElement("span", {
      className: "admin-loading-bar admin-loading-title",
    }),
    createElement("span", { className: "admin-loading-bar" }),
    createElement("span", {
      className: "admin-loading-bar admin-loading-short",
    }),
    createElement("span", { className: "admin-loading-panel" }),
  );
}

export function AdminError({ message }: { message: string }) {
  return createElement(
    "div",
    { className: "admin-card", style: { color: "#b91c1c" } },
    message.replace(/_/g, " "),
  );
}
