import { prisma } from "./db";
import { sha256 } from "./security";
import { getSetting } from "./settings";

const graphVersion = "v23.0";

export type MetaServerEvent = {
  eventName: string;
  eventId: string;
  eventTime?: number;
  sourceUrl?: string;
  userAgent?: string;
  ip?: string;
  fbp?: string;
  fbc?: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  postcode?: string;
  externalId?: string;
  customData?: Record<string, unknown>;
  orderId?: string;
  /** Admin-only testing: production jobs must never inherit the saved test code. */
  testEventCode?: string;
};

export function metaUserData(event: MetaServerEvent) {
  const userData: Record<string, unknown> = {
    client_ip_address: event.ip,
    client_user_agent: event.userAgent,
    fbp: event.fbp,
    fbc: event.fbc,
    ph: event.phone ? [sha256(event.phone.replace(/\D/g, ""))] : undefined,
    em: event.email ? [sha256(event.email.trim().toLowerCase())] : undefined,
    fn: event.firstName ? [sha256(event.firstName.trim().toLowerCase())] : undefined,
    ln: event.lastName ? [sha256(event.lastName.trim().toLowerCase())] : undefined,
    ct: event.city ? [sha256(event.city.trim().toLowerCase())] : undefined,
    zp: event.postcode ? [sha256(event.postcode.trim().toLowerCase())] : undefined,
    country: [sha256("pk")],
    external_id: event.externalId ? [sha256(event.externalId)] : undefined,
  };

  Object.keys(userData).forEach((key) => userData[key] === undefined && delete userData[key]);

  return userData;
}

export async function sendMetaServerEvent(event: MetaServerEvent) {
  const isCapiEnabled = await getSetting<boolean | string>("tracking.metaCapiEnabled", true);
  if (isCapiEnabled === false || isCapiEnabled === "false") {
    return { ok: false, skipped: "META_CAPI_DISABLED" };
  }

  const configuredPixelId = await getSetting<string>(
    "tracking.metaPixelId",
    process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  );
  const pixelId = String(
    configuredPixelId || process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  ).trim();
  const configuredToken = await getSetting<string>("tracking.metaCapiToken", process.env.META_CAPI_TOKEN || "");
  const token = String(configuredToken || process.env.META_CAPI_TOKEN || "").trim();
  if (!pixelId || !token) {
    return { ok: false, skipped: "META_CAPI_NOT_CONFIGURED" };
  }

  const userData = metaUserData(event);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.sourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: event.customData,
      },
    ],
  };

  const testEventCode = String(event.testEventCode || "").trim();
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  let response: Response;
  let body: any;
  try {
    response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    body = await response.json().catch(() => ({ status: response.status }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.eventLog.create({
      data: {
        orderId: event.orderId,
        eventName: event.eventName,
        eventId: event.eventId,
        channel: "server",
        sourceUrl: event.sourceUrl,
        payload: payload as any,
        accepted: false,
        error: message,
      },
    });
    throw error;
  }

  await prisma.eventLog.create({
    data: {
      orderId: event.orderId,
      eventName: event.eventName,
      eventId: event.eventId,
      channel: "server",
      sourceUrl: event.sourceUrl,
      payload: payload as any,
      response: body as any,
      accepted: response.ok && Number(body?.events_received) > 0,
      error: response.ok ? undefined : JSON.stringify(body),
    },
  });

  if (!response.ok || !Number(body?.events_received)) throw new Error(`Meta CAPI error: ${JSON.stringify(body)}`);
  return body;
}
