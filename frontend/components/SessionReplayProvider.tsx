"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readCookie } from "@/lib/client-tracking";
import {
  claimReplaySequence,
  getReplayLandingUrl,
  getReplaySessionId,
  getReplayStartedAt,
  getReplayVisitorId,
  sessionReplayEnabled,
} from "@/lib/session-replay-client";

function parseJsonCookie(name: string) {
  const raw = readCookie(name);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
}

function trafficMeta() {
  const params = new URLSearchParams(window.location.search);
  const firstTouch = parseJsonCookie("zm_first_touch");
  const lastTouch = parseJsonCookie("zm_last_touch");
  const source = String(params.get("utm_source") || lastTouch?.utm_source || firstTouch?.utm_source || "direct");
  return {
    source,
    medium: String(params.get("utm_medium") || lastTouch?.utm_medium || firstTouch?.utm_medium || ""),
    campaign: String(params.get("utm_campaign") || lastTouch?.utm_campaign || firstTouch?.utm_campaign || ""),
    firstTouch,
    lastTouch,
  };
}

function send(path: string, body: unknown, keepalive = false) {
  const payload = JSON.stringify(body);
  const safeKeepalive = keepalive && new Blob([payload]).size <= 60_000;
  return fetch(`/api/store-proxy${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: safeKeepalive,
    cache: "no-store",
    body: payload,
  }).then((response) => response.ok).catch(() => false);
}

type PendingChunk = { sequence: number; events: unknown[]; currentUrl: string };

type RecordWithSnapshot = ((options: Record<string, unknown>) => unknown) & {
  takeFullSnapshot?: () => void;
};

async function announceSession(pageView = false) {
  const sessionId = getReplaySessionId();
  const visitorId = getReplayVisitorId();
  if (!sessionId || !visitorId) return false;
  const source = trafficMeta();
  return send("/api/session-replays/start", {
    sessionId,
    visitorId,
    startedAt: getReplayStartedAt(),
    landingUrl: getReplayLandingUrl(),
    currentUrl: window.location.href,
    referrer: document.referrer || null,
    source,
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pageView,
  });
}

export default function SessionReplayProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname || "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`, [pathname, searchParams]);
  const takeSnapshotRef = useRef<null | (() => void)>(null);
  const flushRef = useRef<null | ((keepalive?: boolean) => Promise<boolean>)>(null);
  const lastRouteRef = useRef(routeKey);
  const recorderReadyRef = useRef(false);

  useEffect(() => {
    if (!sessionReplayEnabled()) return;

    const sessionId = getReplaySessionId();
    const visitorId = getReplayVisitorId();
    if (!sessionId || !visitorId) return;

    let stopped = false;
    let stopRecording: undefined | (() => void);
    let timer: number | undefined;
    let retryTimer: number | undefined;
    let queue: unknown[] = [];
    let pending: PendingChunk | undefined;
    let flushing = false;

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void flush(false);
      }, 1_200);
    };

    const flush = async (keepalive = false) => {
      if (flushing) return false;
      if (!pending && !queue.length) return true;
      flushing = true;

      if (!pending) {
        const count = Math.min(queue.length, 24);
        pending = {
          sequence: claimReplaySequence(),
          events: queue.splice(0, count),
          currentUrl: window.location.href,
        };
      }

      const chunk = pending;
      const ok = await send("/api/session-replays/chunk", {
        sessionId,
        sequence: chunk.sequence,
        events: chunk.events,
        currentUrl: chunk.currentUrl,
      }, keepalive);

      if (ok) {
        pending = undefined;
      } else {
        scheduleRetry();
      }
      flushing = false;

      if (ok && queue.length) void flush(false);
      return ok;
    };

    flushRef.current = flush;

    const stopPageRecorder = () => {
      if (stopped) return;
      stopped = true;
      if (timer) window.clearInterval(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      try { stopRecording?.(); } catch {}
      // Keep the same replay session alive across the shopper journey.
      // A final small keepalive flush is attempted for the last interaction batch.
      void flush(true);
    };

    const startRecorder = async () => {
      try {
        // Start rrweb first. The API announcement intentionally runs in parallel,
        // so a slow backend can never make us miss the shopper's landing actions.
        const rrwebModule = await import("@rrweb/record");
        if (stopped) return;
        const record = rrwebModule.record as unknown as RecordWithSnapshot;
        const stop = record({
          emit(event: unknown) {
            queue.push(event);
            const eventType = Number((event as { type?: number }).type);
            // Full snapshots are valuable and can be large: upload them immediately
            // while the document is still active rather than waiting for unload.
            if (eventType === 2 || queue.length >= 24) {
              void flush(false);
            }
          },
          maskAllInputs: true,
          maskTextSelector: "[data-replay-mask], [data-clarity-mask]",
          blockSelector: "[data-replay-block], [data-private], input[autocomplete='cc-number'], input[autocomplete='cc-csc'], input[autocomplete='one-time-code']",
          recordCanvas: false,
          collectFonts: false,
          inlineImages: false,
          checkoutEveryNms: 30_000,
          sampling: {
            mousemove: 75,
            scroll: 180,
            media: 800,
            input: "last",
          },
          slimDOMOptions: "all",
        });
        if (typeof stop === "function") stopRecording = stop as () => void;
        takeSnapshotRef.current = () => {
          try { record.takeFullSnapshot?.(); } catch {}
        };
        recorderReadyRef.current = true;
        timer = window.setInterval(() => { void flush(false); }, 1_500);

        // Initial server row creation/update is deliberately non-blocking.
        void announceSession(false);
      } catch {
        // Replay is analytics-only and must never interrupt shopping.
      }
    };

    const onManualFlush = () => { void flush(false); };
    const onPageHide = () => { void flush(true); };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };

    // Start immediately after hydration instead of waiting for a network round-trip.
    void startRecorder();
    window.addEventListener("zelvo:replay-flush", onManualFlush);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("zelvo:replay-flush", onManualFlush);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      takeSnapshotRef.current = null;
      flushRef.current = null;
      recorderReadyRef.current = false;
      stopPageRecorder();
    };
  }, []);

  useEffect(() => {
    if (!sessionReplayEnabled()) return;
    if (!routeKey) return;

    if (!lastRouteRef.current) {
      lastRouteRef.current = routeKey;
      return;
    }
    if (lastRouteRef.current === routeKey) return;
    lastRouteRef.current = routeKey;

    // Next.js client navigation keeps the root recorder mounted. Force a fresh
    // FullSnapshot after each route settles so product -> cart -> checkout ->
    // confirmation remains a clean, complete A-to-Z replay in one session.
    const timer = window.setTimeout(() => {
      if (recorderReadyRef.current) {
        takeSnapshotRef.current?.();
        void flushRef.current?.(false);
      }
      void announceSession(true);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [routeKey]);

  return null;
}
