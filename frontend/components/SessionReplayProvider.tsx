"use client";

import { useEffect } from "react";
import { API_BASE } from "@/lib/client-api";
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

function send(path: string, body: unknown) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => undefined);
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
    let sequence = 0;
    let queue: unknown[] = [];
    const startedAt = Date.now();
    const landingUrl = window.location.href;

    const flush = () => {
      if (!queue.length) return;
      const events = queue;
      queue = [];
      void send("/api/session-replays/chunk", {
        sessionId,
        sequence: sequence++,
        events,
        currentUrl: window.location.href,
      });
    };

    const end = () => {
      if (stopped) return;
      stopped = true;
      flush();
      if (timer) window.clearInterval(timer);
      try { stopRecording?.(); } catch {}
      void send("/api/session-replays/end", {
        sessionId,
        endedAt: new Date().toISOString(),
        currentUrl: window.location.href,
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    };

    const start = async () => {
      const source = trafficMeta();
      await send("/api/session-replays/start", {
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

      if (stopped) return;
      try {
        const { record } = await import("@rrweb/record");
        const stop = record({
          emit(event) {
            queue.push(event);
            // rrweb type 2 is the FullSnapshot. Persist it immediately so a
            // short visit still produces a replayable session.
            if ((event as { type?: number }).type === 2 || queue.length >= 45) flush();
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
        timer = window.setInterval(flush, 8_000);
      } catch {
        // Recording is analytics-only. A recorder failure must never affect shopping.
      }
    };

    // Start after the first paint so recording never delays the shopping UI.
    const startTimer = window.setTimeout(() => { void start(); }, 700);

    const onPageHide = () => end();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
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
