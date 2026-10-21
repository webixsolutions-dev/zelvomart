"use client";
import {privateSafeUrl} from "./url-privacy";

import {tiktokProperties} from "./tracking-payload";
import {adsAllowed,staffDevice,trackingSettingEnabled} from "./tracking-policy";
import {getReplayVisitorId} from "./session-replay-client";
import { getReplaySessionId } from "@/lib/session-replay-client";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: {
      track: (eventName: string, params?: Record<string, unknown>, options?: { event_id?: string }) => void;
      page: () => void;
      identify?: (options: Record<string, unknown>) => void;
      [key: string]: any;
    };
  }
}

export async function trackStoreEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  options: { eventId?: string } = {},
) {
  const eventId = options.eventId || crypto.randomUUID();
  if(staffDevice())return eventId;
  if(adsAllowed()&&!eventName.startsWith("Replay")){
    const deliver=(platform:'meta'|'tiktok',attempt=0)=>{
      if(!trackingSettingEnabled(platform==='meta'?'tracking.metaPixelEnabled':'tracking.tiktokPixelEnabled'))return;
      try{
        if(platform==='meta'&&window.fbq){window.fbq('track',eventName,params,{eventID:eventId});return;}
        if(platform==='tiktok'&&window.ttq){if(eventName==='PageView')window.ttq.page();else window.ttq.track(eventName,tiktokProperties(params),{event_id:eventId});return;}
      }catch{return;}
      // Pixels load lazily (after the page has loaded and gone idle): keep the event for up to ~25 s.
      if(attempt<100)window.setTimeout(()=>deliver(platform,attempt+1),250);
    };
    deliver('meta');deliver('tiktok');
  }

  try {
    await fetch(`/api/store-proxy/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        eventId,
        occurredAt:Date.now(),
        replaySessionId: getReplaySessionId(),
        sourceUrl: privateSafeUrl(window.location.href),
        params,
        fbp: readCookie("_fbp"),
        fbc: readCookie("_fbc"),
        ttp: readCookie("_ttp"),
        ttclid: readCookie("ttclid"),
        visitorId: getReplayVisitorId(),
      }),
    });
  } catch {}

  return eventId;
}

export function readCookie(name: string) {
  const row = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : undefined;
}
