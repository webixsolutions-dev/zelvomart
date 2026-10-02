"use client";

import { createElement, useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";

type CacheEntry<T = unknown> = {
  data: T;
  fetchedAt: number;
};

const ADMIN_CACHE_TTL_MS = 90_000;
const adminMemoryCache = new Map<string, CacheEntry>();
const adminInflight = new Map<string, Promise<unknown>>();

function getCache<T>(path: string): CacheEntry<T> | undefined {
  return adminMemoryCache.get(path) as CacheEntry<T> | undefined;
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
      adminMemoryCache.set(path, { data: result, fetchedAt: Date.now() });
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
    return;
  }
  adminMemoryCache.clear();
  adminInflight.clear();
}

export function useAdminData<T>(path: string, initial: T) {
  const cachedAtRender = getCache<T>(path);
  const [data, setData] = useState<T>(() => cachedAtRender?.data ?? initial);
  const [loading, setLoading] = useState(() => !cachedAtRender && initial === null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (force: boolean) => {
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
        setError(requestError instanceof Error ? requestError.message : "Request failed");
      }
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [path]);

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
  return createElement("div", { className: "admin-card" }, "Loading…");
}

export function AdminError({ message }: { message: string }) {
  return createElement(
    "div",
    { className: "admin-card", style: { color: "#b91c1c" } },
    message.replace(/_/g, " "),
  );
}
