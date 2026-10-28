"use client";
import {privateSafeUrl} from "@/lib/url-privacy";
import {REPLAY_FLUSH_MS,replayIdle,replayPhase} from '@/lib/replay-timing';
import { createReplayDelivery, replayDeliveryResult, type ReplayDeliveryResult } from "@/lib/replay-delivery";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackStoreEvent,readCookie } from "@/lib/client-tracking";
import {
  claimReplaySequence,
  resetReplaySession,
  touchReplayActivity,
  getReplayLandingUrl,
  getReplaySessionId,
  getReplayStartedAt,
  getReplayVisitorId,
  sessionReplayEnabled,
  isReplaySessionLimited,
  limitReplaySession,
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

/** Set when the backend says recordings have nowhere to go (no private R2 bucket). Recording then stops for this page. */
let storageMissing = false;

function send(path: string, body: unknown, keepalive = false): Promise<ReplayDeliveryResult> {
  if (storageMissing) return Promise.resolve({ ok: false, terminal: true });
  const payload = JSON.stringify(body);
  const safeKeepalive = keepalive && new Blob([payload]).size <= 60_000;
  return fetch(`/api/store-proxy${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: safeKeepalive,
    signal:AbortSignal.timeout(15000),
    cache: "no-store",
    body: payload,
  }).then(async (response) => {
    const data = !response.ok ? (await response.json().catch(() => null)) as { error?: string } | null : null;
    if (response.status === 503) {
      if (data?.error === "REPLAY_STORAGE_NOT_CONFIGURED") storageMissing = true;
    }
    return replayDeliveryResult(response.status, data?.error);
  }).catch(() => ({ ok: false }));
}

type PendingChunk = { sequence: number; events: unknown[]; currentUrl: string };

type RecordWithSnapshot = ((options: Record<string, unknown>) => unknown) & {
  takeFullSnapshot?: () => void;
};

async function announceSession(pageView = false) {
  const sessionId = getReplaySessionId();
  const visitorId = getReplayVisitorId();
  if (!sessionId || !visitorId) return { ok: false };
  const source = trafficMeta();
  return send("/api/session-replays/start", {
    sessionId,
    visitorId,
    startedAt: getReplayStartedAt(),
    landingUrl: getReplayLandingUrl(),
    currentUrl: privateSafeUrl(window.location.href),
    referrer: document.referrer || null,
    source,
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pageView,
  });
}

export default function SessionReplayProvider() {
  const [generation,setGeneration]=useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname || "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`, [pathname, searchParams]);
  const takeSnapshotRef = useRef<null | (() => void)>(null);
  const flushRef = useRef<null | ((keepalive?: boolean) => Promise<boolean>)>(null);
  const lastRouteRef = useRef(routeKey);
  const recorderReadyRef = useRef(false);
  const activityRef=useRef<null|(()=>void)>(null);
  const announcePageRef = useRef<null | (() => Promise<boolean>)>(null);

  useEffect(() => {
    if (!sessionReplayEnabled()) {const preference=()=>setGeneration(n=>n+1);window.addEventListener('zelvo:replay-preference',preference);return()=>window.removeEventListener('zelvo:replay-preference',preference);}

    const sessionId = getReplaySessionId();
    const visitorId = getReplayVisitorId();
    if (!sessionId || !visitorId || isReplaySessionLimited(sessionId)) return;

    let stopped = false;
    let lastActivity=Date.now(),idle=false;
    let paused=document.visibilityState==='hidden',starting=false,bufferPaused=false;
    let stopRecording: undefined | (() => void);
    let timer: number | undefined;
    let retryTimer: number | undefined;
    let initialStartTimer: number | undefined;
    let initialStartReady = false;
    let retryAttempts=0;
    let queue: unknown[] = [];
    let pending: PendingChunk | undefined;
    let flushing = false;
    let retryNotBefore=0;
    const delivery = createReplayDelivery<PendingChunk>({
      register: () => announceSession(false),
      upload: (chunk, keepalive) => send("/api/session-replays/chunk", {
        sessionId, sequence: chunk.sequence, events: chunk.events, currentUrl: chunk.currentUrl,
      }, keepalive),
      stop: () => {
        limitReplaySession(sessionId);
        queue = []; pending = undefined; paused = true;
        if (timer) window.clearInterval(timer);
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = undefined;
        try { stopRecording?.(); } catch {}
        stopRecording = undefined;
        recorderReadyRef.current = false;
        takeSnapshotRef.current = null;
      },
    });
    announcePageRef.current = async () => {
      if (delivery.stopped) return false;
      return delivery.observe(await announceSession(true));
    };

    const scheduleRetry = () => {
      if (stopped || delivery.stopped || retryTimer) return;
      const delay=Math.min(30_000,2_500*2**Math.min(retryAttempts++,4));retryNotBefore=Date.now()+delay;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void flush(false);
      }, delay);
    };

    const flush = async (keepalive = false) => {
      if (flushing || delivery.stopped) return false;
      if(!keepalive&&(Date.now()<retryNotBefore||navigator.onLine===false)){scheduleRetry();return false;}
      if (!pending && !queue.length) return true;
      flushing = true;

      if(!sessionReplayEnabled()){queue=[];pending=undefined;flushing=false;return false;}
      if(storageMissing){queue=[];pending=undefined;flushing=false;try{stopRecording?.()}catch{}return false;}
      if (!pending) {
        const count = Math.min(queue.length, 100);
        pending = {
          sequence: claimReplaySequence(sessionId),
          events: queue.splice(0, count),
          currentUrl: privateSafeUrl(window.location.href),
        };
      }

      const chunk = pending;
      const ok = await delivery.upload(chunk, keepalive);

      if (ok) {
        pending = undefined;
        retryAttempts=0;
        retryNotBefore=0;
      } else {
        scheduleRetry();
      }
      flushing = false;

      if (ok && (queue.length >= 100 || stopped&&queue.length>0)) {
        window.setTimeout(() => { void flush(stopped); }, 250);
      }
      if(ok&&bufferPaused&&queue.length<100&&!stopped){bufferPaused=false;if(document.visibilityState==='visible'&&replayPhase(lastActivity)==='active'){paused=false;void startRecorder();}}
      return ok;
    };

    flushRef.current = flush;

    const stopPageRecorder = () => {
      if (stopped) return;
      stopped = true;
      if (timer) window.clearInterval(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      try { stopRecording?.(); } catch {}
      stopRecording=undefined;recorderReadyRef.current=false;takeSnapshotRef.current=null;
      // Keep the same replay session alive across the shopper journey.
      // A final small keepalive flush is attempted for the last interaction batch.
      void flush(true);
    };

    const pauseRecorder=()=>{if(paused||stopped)return;paused=true;try{stopRecording?.()}catch{}stopRecording=undefined;recorderReadyRef.current=false;takeSnapshotRef.current=null;void flush(true);};

    const startRecorder = async () => {
      if(stopped||delivery.stopped||paused||starting||stopRecording)return;
      starting=true;
      try {
        // Start rrweb first. The API announcement intentionally runs in parallel,
        // so a slow backend can never make us miss the shopper's landing actions.
        const rrwebModule = await import("@rrweb/record");
        if (stopped||paused||document.visibilityState==='hidden'||!sessionReplayEnabled()) return;
        const record = rrwebModule.record as unknown as RecordWithSnapshot;
        void delivery.register();

        const stop = record({
          emit(event: unknown) {
            if(stopped||paused||document.visibilityState==='hidden')return;
            // Bound offline buffering. Resume with a new snapshot after upload
            // recovery rather than retaining unlimited DOM mutations in memory.
            if(queue.length>=2000){bufferPaused=true;pauseRecorder();return;}
            const entry=event as {type:number;data?:{href?:string}};
            if(entry.type===4&&entry.data?.href)entry.data.href=privateSafeUrl(entry.data.href);
            queue.push(event);
            const eventType = Number((event as { type?: number }).type);
            // Full snapshots are valuable and can be large: upload them immediately
            // while the document is still active rather than waiting for unload.
            if (eventType === 2 || queue.length >= 100) {
              void flush(false);
            }
          },
          maskAllInputs: true,
          maskTextSelector: "[data-replay-mask]",
          blockSelector: "[data-replay-block], [data-private], input[autocomplete='cc-number'], input[autocomplete='cc-csc'], input[autocomplete='one-time-code']",
          recordCanvas: false,
          collectFonts: false,
          inlineImages: false,
          sampling: {
            mousemove: 120,
            scroll: 260,
            media: 1200,
            input: "last",
          },
          slimDOMOptions: "all",
        });
        if(stopped||paused||!sessionReplayEnabled()){if(typeof stop==='function')stop();return;}
        if (typeof stop === "function") stopRecording = stop as () => void;
        takeSnapshotRef.current = () => {
          try { record.takeFullSnapshot?.(); } catch {}
        };
        recorderReadyRef.current = true;
      } catch {
        // Replay is analytics-only and must never interrupt shopping.
      }finally{starting=false;}
    };

    const onManualFlush = () => { void flush(false); };
    const onPageHide = () => { pauseRecorder();void flush(true); };
    const onVisibility = () => {
      if(document.visibilityState==='hidden')pauseRecorder();else onActivity();
    };

    const onActivity=()=>{if(!sessionReplayEnabled()){setGeneration(n=>n+1);return;}const previous=lastActivity,expired=idle||replayIdle(previous);lastActivity=Date.now();touchReplayActivity();if(expired){if(!idle){idle=true;stopPageRecorder();void send('/api/session-replays/end',{sessionId,endedAt:new Date(previous).toISOString(),currentUrl:privateSafeUrl(window.location.href)});}resetReplaySession();setGeneration(value=>value+1);return;}if(bufferPaused&&queue.length>=100)return;if(initialStartReady&&document.visibilityState==='visible'&&(paused||!stopRecording)){paused=false;void startRecorder();}};
    activityRef.current=onActivity;
    const onOnline=()=>{retryNotBefore=0;if(retryTimer)clearTimeout(retryTimer);retryTimer=undefined;void flush(false);};
    const onPageShow=()=>onActivity();
    timer=window.setInterval(()=>{
      const phase=replayPhase(lastActivity,Date.now(),document.visibilityState==='visible');
      if(phase==='ended'){idle=true;stopPageRecorder();void send('/api/session-replays/end',{sessionId,endedAt:new Date(lastActivity).toISOString(),currentUrl:privateSafeUrl(window.location.href)});return;}
      if(phase==='paused')pauseRecorder();
      if(!paused&&!queue.length&&!pending)queue.push({type:5,timestamp:Date.now(),data:{tag:'heartbeat',payload:{}}});
      void flush(false);
    },REPLAY_FLUSH_MS);
    let clicks:number[]=[];
    let clickTarget:EventTarget|null=null;
    const onClick=(event:MouseEvent)=>{if(event.target!==clickTarget)clicks=[];clickTarget=event.target;const now=Date.now();clicks=clicks.filter(t=>now-t<1000);clicks.push(now);if(clicks.length===4)void trackStoreEvent('ReplayRageClick');};
    const onError=()=>void trackStoreEvent('ReplayError');
    window.addEventListener('click',onClick);window.addEventListener('error',onError);
    const onPreference=()=>{if(!sessionReplayEnabled()){queue=[];pending=undefined;stopPageRecorder();}setGeneration(value=>value+1);};
    for(const event of ['pointerdown','pointermove','keydown','scroll','touchstart'])window.addEventListener(event,onActivity,{passive:true,capture:true});
    window.addEventListener('zelvo:replay-preference',onPreference);
    // Let the storefront paint before loading rrweb, but start within two seconds.
    const startWhenIdle = () => {
      if (stopped) return;
      initialStartReady = true;
      if (document.visibilityState === "visible") {
        paused = false;
        void startRecorder();
      }
    };
    initialStartTimer = window.setTimeout(startWhenIdle, 2000);
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        if (initialStartTimer) window.clearTimeout(initialStartTimer);
        startWhenIdle();
      }, { timeout: 2000 });
    }
    window.addEventListener("zelvo:replay-flush", onManualFlush);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener('online',onOnline);window.addEventListener('pageshow',onPageShow);

    return () => {
      for(const event of ['pointerdown','pointermove','keydown','scroll','touchstart'])window.removeEventListener(event,onActivity,true);
      window.removeEventListener('zelvo:replay-preference',onPreference);
      window.removeEventListener('click',onClick);window.removeEventListener('error',onError);
      window.removeEventListener("zelvo:replay-flush", onManualFlush);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener('online',onOnline);window.removeEventListener('pageshow',onPageShow);activityRef.current=null;
      if (initialStartTimer) window.clearTimeout(initialStartTimer);
      takeSnapshotRef.current = null;
      flushRef.current = null;
      announcePageRef.current = null;
      recorderReadyRef.current = false;
      stopPageRecorder();
    };
  }, [generation]);

  useEffect(() => {
    if (!sessionReplayEnabled()) return;
    if (!routeKey) return;

    if (!lastRouteRef.current) {
      lastRouteRef.current = routeKey;
      return;
    }
    if (lastRouteRef.current === routeKey) return;
    lastRouteRef.current = routeKey;
    activityRef.current?.();

    // Next.js client navigation keeps the root recorder mounted. Force a fresh
    // FullSnapshot after each route settles so product -> cart -> checkout ->
    // confirmation remains a clean, complete A-to-Z replay in one session.
    const timer = window.setTimeout(() => {
      if (recorderReadyRef.current) {
        takeSnapshotRef.current?.();
        void flushRef.current?.(false);
      }
      void announcePageRef.current?.();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [routeKey]);

  return null;
}
