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

function cleanCurrentUrl() {
  return `${window.location.origin}${window.location.pathname}`;
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

async function send(path: string, body: unknown, keepalive = false, attempts = 2) {
  const payload = JSON.stringify(body);
  const safeKeepalive = keepalive && new Blob([payload]).size <= 60_000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`/api/store-proxy${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: safeKeepalive,
        cache: "no-store",
        body: payload,
      });
      if (response.ok) return true;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) return false;
    } catch {}
    if (!keepalive && attempt + 1 < attempts) await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
  }
  return false;
}

type PendingChunk = { sequence: number; events: unknown[]; currentUrl: string };
type RecordWithSnapshot = ((options: Record<string, unknown>) => unknown) & { takeFullSnapshot?: () => void };

async function announceSession(pageView = false) {
  const sessionId = getReplaySessionId();
  const visitorId = getReplayVisitorId();
  if (!sessionId || !visitorId) return false;
  const source = trafficMeta();
  return send("/api/session-replays/start", {
    sessionId,
    visitorId,
    startedAt: getReplayStartedAt(),
    landingUrl: (() => {
      try {
        const url = new URL(getReplayLandingUrl());
        return `${url.origin}${url.pathname}`;
      } catch { return getReplayLandingUrl().split("?")[0]; }
    })(),
    currentUrl: cleanCurrentUrl(),
    referrer: document.referrer ? document.referrer.split("?")[0] : null,
    source,
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pageView,
  }, false, 3);
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
    let snapshotTimer: number | undefined;
    let queue: unknown[] = [];
    let pending: PendingChunk | undefined;
    let flushing = false;

    // Create the database session immediately, independently of rrweb loading.
    // This makes failed recorder initialization visible in admin instead of silently losing the visit.
    void announceSession(false);

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void flush(false);
      }, 1_000);
    };

    const flush = async (keepalive = false) => {
      if (flushing) return false;
      if (!pending && !queue.length) return true;
      flushing = true;

      if (!pending) {
        const count = Math.min(queue.length, 20);
        pending = {
          sequence: claimReplaySequence(),
          events: queue.splice(0, count),
          currentUrl: cleanCurrentUrl(),
        };
      }

      const chunk = pending;
      const ok = await send("/api/session-replays/chunk", {
        sessionId,
        sequence: chunk.sequence,
        events: chunk.events,
        currentUrl: chunk.currentUrl,
      }, keepalive, keepalive ? 1 : 3);

      if (ok) pending = undefined;
      else scheduleRetry();
      flushing = false;

      if (ok && queue.length && !stopped) void flush(false);
      return ok;
    };

    flushRef.current = flush;

    const startRecorder = async () => {
      try {
        const rrwebModule = await import("@rrweb/record");
        if (stopped) return;
        const record = rrwebModule.record as unknown as RecordWithSnapshot;
        const stop = record({
          emit(event: unknown) {
            queue.push(event);
            const eventType = Number((event as { type?: number }).type);
            // FullSnapshot = type 2. Push it immediately rather than waiting for the batch interval.
            if (eventType === 2 || queue.length >= 20) void flush(false);
          },
          maskAllInputs: true,
          maskTextSelector: "[data-replay-mask], [data-clarity-mask]",
          blockSelector: "[data-replay-block], [data-private], input[autocomplete='cc-number'], input[autocomplete='cc-csc'], input[autocomplete='one-time-code']",
          recordCanvas: false,
          collectFonts: false,
          inlineImages: false,
          checkoutEveryNms: 25_000,
          sampling: { mousemove: 75, scroll: 180, media: 800, input: "last" },
          slimDOMOptions: "all",
        });

        if (typeof stop === "function") stopRecording = stop as () => void;
        takeSnapshotRef.current = () => { try { record.takeFullSnapshot?.(); } catch {} };
        recorderReadyRef.current = true;
        timer = window.setInterval(() => { void flush(false); }, 1_250);

        // Some browser/rrweb combinations delay the first snapshot. Force one once hydration settles.
        snapshotTimer = window.setTimeout(() => {
          if (stopped) return;
          try { record.takeFullSnapshot?.(); } catch {}
          window.setTimeout(() => { void flush(false); }, 80);
        }, 120);
      } catch {
        // The start row already exists; admin can distinguish recorder load failure from a missing visit.
      }
    };

    const onManualFlush = () => { void flush(false); };
    const onPageHide = () => { void flush(true); };
    const onVisibility = () => { if (document.visibilityState === "hidden") void flush(true); };

    void startRecorder();
    window.addEventListener("zelvo:replay-flush", onManualFlush);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("zelvo:replay-flush", onManualFlush);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) window.clearInterval(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (snapshotTimer) window.clearTimeout(snapshotTimer);
      try { stopRecording?.(); } catch {}
      // Flush before marking stopped so the final pending chunk still gets one attempt.
      void flush(true);
      stopped = true;
      takeSnapshotRef.current = null;
      flushRef.current = null;
      recorderReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionReplayEnabled() || !routeKey) return;
    if (!lastRouteRef.current) { lastRouteRef.current = routeKey; return; }
    if (lastRouteRef.current === routeKey) return;
    lastRouteRef.current = routeKey;

    const timer = window.setTimeout(() => {
      if (recorderReadyRef.current) {
        takeSnapshotRef.current?.();
        window.setTimeout(() => { void flushRef.current?.(false); }, 80);
      }
      void announceSession(true);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [routeKey]);

  return null;
}
