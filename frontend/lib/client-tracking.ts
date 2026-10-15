"use client";

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
    clarity?: (...args: any[]) => void;
  }
}

export async function trackStoreEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  options: { eventId?: string; clarityEvent?: string } = {},
) {
  const eventId = options.eventId || crypto.randomUUID();
  try {
    window.fbq?.("track", eventName, params, { eventID: eventId });
  } catch {}

  try {
    const tiktokEventMap: Record<string, string> = {
      PageView: "PageView",
      ViewContent: "ViewContent",
      Search: "Search",
      AddToCart: "AddToCart",
      InitiateCheckout: "InitiateCheckout",
      Purchase: "CompletePayment",
      Contact: "Contact",
      Lead: "SubmitForm",
    };
    const ttEvent = tiktokEventMap[eventName] || eventName;
    if (eventName === "PageView") {
      window.ttq?.page();
    }
    window.ttq?.track(ttEvent, params, { event_id: eventId });
  } catch {}

  if (options.clarityEvent) {
    try { window.clarity?.("event", options.clarityEvent); } catch {}
  }

  try {
    await fetch(`/api/store-proxy/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        eventId,
        replaySessionId: getReplaySessionId(),
        sourceUrl: window.location.href,
        params,
        fbp: readCookie("_fbp"),
        fbc: readCookie("_fbc"),
        ttp: readCookie("_ttp"),
      }),
    });
  } catch {}

  return eventId;
}

export function readCookie(name: string) {
  const row = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : undefined;
}
