"use client";

import { useEffect } from "react";
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

type PendingChunk = { sequence: number; events: unknown[] };

export default function SessionReplayProvider() {
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
    const pageStartedAt = Date.now();
    const journeyStartedAt = getReplayStartedAt();
    const landingUrl = getReplayLandingUrl();

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void flush(false);
      }, 1_800);
    };

    const flush = async (keepalive = false) => {
      if (flushing) return false;
      if (!pending && !queue.length) return true;
      flushing = true;

      if (!pending) {
        const count = Math.min(queue.length, 30);
        pending = {
          sequence: claimReplaySequence(),
          events: queue.splice(0, count),
        };
      }

      const chunk = pending;
      const ok = await send("/api/session-replays/chunk", {
        sessionId,
        sequence: chunk.sequence,
        events: chunk.events,
        currentUrl: window.location.href,
      }, keepalive);

      if (ok) {
        pending = undefined;
      } else {
        scheduleRetry();
      }
      flushing = false;

      if (ok && queue.length >= 30) void flush(false);
      return ok;
    };

    const stopPageRecorder = () => {
      if (stopped) return;
      stopped = true;
      if (timer) window.clearInterval(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      try { stopRecording?.(); } catch {}
      // Do NOT end the journey here. A page unload/reload is still the same
      // shopper session. Persisted session id + chunk sequence lets the next
      // page continue the same A-to-Z replay.
      void flush(true);
    };

    const start = async () => {
      const source = trafficMeta();
      const started = await send("/api/session-replays/start", {
        sessionId,
        visitorId,
        startedAt: journeyStartedAt,
        landingUrl,
        currentUrl: window.location.href,
        referrer: document.referrer || null,
        source,
        device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        pageStartedAt: new Date(pageStartedAt).toISOString(),
      });

      if (!started || stopped) return;
      try {
        const { record } = await import("@rrweb/record");
        const stop = record({
          emit(event) {
            queue.push(event);
            const eventType = Number((event as { type?: number }).type);
            // Each real document load gets a FullSnapshot. Because the replay id
            // is shared across the whole tab journey, these snapshots form clean
            // page boundaries inside one order-linked recording.
            if (eventType === 2) {
              void flush(false);
            } else if (queue.length >= 30) {
              void flush(false);
            }
          },
          maskAllInputs: true,
          maskTextSelector: "[data-replay-mask], [data-clarity-mask]",
          blockSelector: "[data-replay-block], [data-private], input[autocomplete='cc-number'], input[autocomplete='cc-csc'], input[autocomplete='one-time-code']",
          recordCanvas: false,
          collectFonts: false,
          inlineImages: false,
          checkoutEveryNms: 60_000,
          sampling: {
            mousemove: 75,
            scroll: 180,
            media: 800,
            input: "last",
          },
          slimDOMOptions: "all",
        });
        if (typeof stop === "function") stopRecording = stop;
        timer = window.setInterval(() => { void flush(false); }, 4_000);
      } catch {
        // Replay is analytics-only and must never interrupt shopping.
      }
    };

    // Start near-immediately so the landing page itself is part of the replay.
    const startTimer = window.setTimeout(() => { void start(); }, 80);

    const onPageHide = () => { void flush(true); };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(startTimer);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      stopPageRecorder();
    };
  }, []);

  return null;
}
