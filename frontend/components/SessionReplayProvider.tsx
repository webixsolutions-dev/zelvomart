"use client";

import { useEffect } from "react";
import { readCookie } from "@/lib/client-tracking";
import { getReplaySessionId, getReplayVisitorId, sessionReplayEnabled } from "@/lib/session-replay-client";

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
  // Browsers cap fetch keepalive request bodies at roughly 64 KiB. An rrweb
  // FullSnapshot is commonly larger, so normal replay chunks MUST use a
  // regular fetch. keepalive is reserved for genuinely small unload requests.
  const safeKeepalive = keepalive && new Blob([payload]).size <= 60_000;
  return fetch(`/api/store-proxy${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: safeKeepalive,
    cache: "no-store",
    body: payload,
  }).then((response) => response.ok).catch(() => false);
}


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
    let sequence = 0;
    let queue: unknown[] = [];
    let flushing = false;
    const startedAt = Date.now();
    const landingUrl = window.location.href;

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void flush(false);
      }, 2_000);
    };

    const flush = async (keepalive = false) => {
      if (flushing || !queue.length) return true;
      flushing = true;
      // Keep incremental batches modest. The initial Meta + FullSnapshot can be
      // larger than this but is normally just the first 2-4 events.
      const count = Math.min(queue.length, 30);
      const events = queue.splice(0, count);
      const currentSequence = sequence;
      const ok = await send("/api/session-replays/chunk", {
        sessionId,
        sequence: currentSequence,
        events,
        currentUrl: window.location.href,
      }, keepalive);

      if (ok) {
        sequence += 1;
      } else {
        // Do not silently lose the FullSnapshot (or any other batch). Retry the
        // same sequence so the backend's composite key remains idempotent.
        queue = events.concat(queue);
        scheduleRetry();
      }
      flushing = false;

      if (ok && queue.length >= 30) void flush(false);
      return ok;
    };

    const end = () => {
      if (stopped) return;
      stopped = true;
      if (timer) window.clearInterval(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      try { stopRecording?.(); } catch {}

      // Try to send remaining small events on unload. Larger payloads
      // automatically fall back to a regular fetch instead of failing the
      // browser's keepalive quota.
      void flush(true);
      void send("/api/session-replays/end", {
        sessionId,
        endedAt: new Date().toISOString(),
        currentUrl: window.location.href,
        durationMs: Math.max(0, Date.now() - startedAt),
      }, true);
    };

    const start = async () => {
      const source = trafficMeta();
      const started = await send("/api/session-replays/start", {
        sessionId,
        visitorId,
        startedAt: new Date(startedAt).toISOString(),
        landingUrl,
        currentUrl: window.location.href,
        referrer: document.referrer || null,
        source,
        device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });

      if (!started || stopped) return;
      try {
        const { record } = await import("@rrweb/record");
        const stop = record({
          emit(event) {
            queue.push(event);
            const eventType = Number((event as { type?: number }).type);
            // rrweb type 2 is FullSnapshot. Flush Meta + FullSnapshot
            // immediately with a NORMAL fetch (not keepalive). This is the
            // critical event required for a playable recording.
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
        timer = window.setInterval(() => { void flush(false); }, 5_000);
      } catch {
        // Recording is analytics-only. A recorder failure must never affect shopping.
      }
    };

    // Start after the first paint so recording never delays the shopping UI.
    const startTimer = window.setTimeout(() => { void start(); }, 350);

    const onPageHide = () => end();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush(false);
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(startTimer);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      end();
    };
  }, []);

  return null;
}
