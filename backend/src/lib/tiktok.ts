import {tiktokProperties} from "./tracking-payload";
import { prisma } from "./db";
import { sha256 } from "./security";
import { getSetting } from "./settings";

export type TikTokServerEvent = {
  eventName: string;
  eventId: string;
  eventTime?: number;
  sourceUrl?: string;
  userAgent?: string;
  ip?: string;
  ttp?: string;
  ttclid?:string;
  phone?: string;
  email?: string;
  externalId?: string;
  customData?: Record<string, unknown>;
  orderId?: string;
};

const TIKTOK_EVENT_MAP: Record<string, string> = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  Search: "Search",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
  Contact: "Contact",
  Lead: "Lead",
};

export function tiktokUserData(event:TikTokServerEvent){
  const userData: Record<string, unknown> = {
    ip: event.ip || undefined,
    user_agent: event.userAgent || undefined,
    ttp: event.ttp || undefined,
    ttclid:event.ttclid||undefined,
    phone: event.phone ? sha256(`+${event.phone.replace(/\D/g, "")}`) : undefined,
    email: event.email ? sha256(event.email.trim().toLowerCase()) : undefined,
    external_id: event.externalId ? sha256(event.externalId) : undefined,
  };

  Object.keys(userData).forEach((key) => userData[key] === undefined && delete userData[key]);

  return userData;
}

export async function sendTikTokServerEvent(event: TikTokServerEvent) {
  const isEventsApiEnabled = await getSetting<boolean | string>("tracking.tiktokEventsApiEnabled", true);
  if (isEventsApiEnabled === false || isEventsApiEnabled === "false") {
    return { ok: false, skipped: "TIKTOK_EVENTS_API_DISABLED" };
  }

  const configuredPixelId = await getSetting<string>(
    "tracking.tiktokPixelId",
    process.env.TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "",
  );
  const pixelId = String(configuredPixelId || process.env.TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "").trim();
  const configuredToken = await getSetting<string>(
    "tracking.tiktokEventsApiToken",
    await getSetting<string>("tracking.tiktokAccessToken", process.env.TIKTOK_EVENTS_API_TOKEN || process.env.TIKTOK_ACCESS_TOKEN || ""),
  );
  const token = String(configuredToken || process.env.TIKTOK_EVENTS_API_TOKEN || process.env.TIKTOK_ACCESS_TOKEN || "").trim();

  if (!pixelId || !token) {
    // If TikTok Events API credentials are not yet configured, skip silently without failing background workers.
    return { ok: false, skipped: "TIKTOK_NOT_CONFIGURED" };
  }

  const ttEvent = TIKTOK_EVENT_MAP[event.eventName] || event.eventName;

  const userData=tiktokUserData(event);

  const properties: Record<string, unknown> = {
    ...tiktokProperties(event.customData || {}),
  };

  const payload: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event: ttEvent,
        event_id: event.eventId,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        user: userData,
        properties: Object.keys(properties).length ? properties : undefined,
        page: event.sourceUrl ? { url: event.sourceUrl } : undefined,
      },
    ],
  };

  const configuredTestCode = await getSetting<string>(
    "tracking.tiktokTestEventCode",
    process.env.TIKTOK_TEST_EVENT_CODE || "",
  );
  const testEventCode = String(configuredTestCode || process.env.TIKTOK_TEST_EVENT_CODE || "").trim();
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  let response: Response;
  let body: any;
  try {
    response = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "access-token": token,
      },
      body: JSON.stringify(payload),
      signal:AbortSignal.timeout(15000),
    });
    body = await response.json().catch(() => ({ status: response.status }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.eventLog.create({
      data: {
        orderId: event.orderId,
        eventName: event.eventName,
        eventId: event.eventId,
        channel: "tiktok-server",
        sourceUrl: event.sourceUrl,
        payload: payload as any,
        accepted: false,
        error: message,
      },
    });
    throw error;
  }

  const isAccepted = response.ok && (body?.code === 0);

  await prisma.eventLog.create({
    data: {
      orderId: event.orderId,
      eventName: event.eventName,
      eventId: event.eventId,
      channel: "tiktok-server",
      sourceUrl: event.sourceUrl,
      payload: payload as any,
      response: body as any,
      accepted: isAccepted,
      error: isAccepted ? undefined : JSON.stringify(body),
    },
  });

  if (!isAccepted) {
    throw new Error(`TikTok Events API error: ${JSON.stringify(body)}`);
  }

  return body;
}
