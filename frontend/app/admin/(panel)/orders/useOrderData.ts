"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';

// Query changes cancel earlier requests so a slower search cannot replace newer results.
export function useOrderData<T>(path: string) {
  const controller = useRef<AbortController | null>(null);
  const activePath = useRef(path);
  activePath.current = path;
  const [result, setResult] = useState<{path: string; data: T | null; error: string; loading: boolean}>({path, data: null, error: '', loading: true});
  const reload = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setResult(previous => ({path, data: previous.path === path ? previous.data : null, error: '', loading: true}));
    try {
      const data = await clientApi<T>(path, {signal: request.signal}, true);
      if (!request.signal.aborted && activePath.current === path) setResult({path, data, error: '', loading: false});
    } catch (error) {
      if (!request.signal.aborted && activePath.current === path) setResult({path, data: null, error: error instanceof Error ? error.message : 'Unable to load orders', loading: false});
    }
  }, [path]);
  useEffect(() => { void reload(); return () => controller.current?.abort(); }, [reload]);
  return {data: result.path === path ? result.data : null, error: result.path === path ? result.error : '', loading: result.path !== path || result.loading, reload};
}
