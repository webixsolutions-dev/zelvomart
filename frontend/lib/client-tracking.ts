"use client";

import { getReplaySessionId } from "@/lib/session-replay-client";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
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

  if (options.clarityEvent) {
    try { window.clarity?.("event", options.clarityEvent); } catch {}
  }

  try {
    const api = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
    await fetch(`${api}/api/events`, {
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
      }),
    });
  } catch {}

  return eventId;
}

export function readCookie(name: string) {
  const row = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : undefined;
}
