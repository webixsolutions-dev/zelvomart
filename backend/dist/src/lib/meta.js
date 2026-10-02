"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMetaServerEvent = sendMetaServerEvent;
const db_1 = require("./db");
const security_1 = require("./security");
const settings_1 = require("./settings");
const graphVersion = "v23.0";
async function sendMetaServerEvent(event) {
    const configuredPixelId = await (0, settings_1.getSetting)("tracking.metaPixelId", process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "1645715973642563");
    const pixelId = configuredPixelId || process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;
    if (!pixelId || !token)
        throw new Error("Meta Conversions API is not configured");
    const userData = {
        client_ip_address: event.ip,
        client_user_agent: event.userAgent,
        fbp: event.fbp,
        fbc: event.fbc,
        ph: event.phone ? [(0, security_1.sha256)(event.phone.replace(/\D/g, ""))] : undefined,
        em: event.email ? [(0, security_1.sha256)(event.email.trim().toLowerCase())] : undefined,
        fn: event.firstName ? [(0, security_1.sha256)(event.firstName.trim().toLowerCase())] : undefined,
        ln: event.lastName ? [(0, security_1.sha256)(event.lastName.trim().toLowerCase())] : undefined,
        ct: event.city ? [(0, security_1.sha256)(event.city.trim().toLowerCase())] : undefined,
        zp: event.postcode ? [(0, security_1.sha256)(event.postcode.trim().toLowerCase())] : undefined,
        country: [(0, security_1.sha256)("pk")],
        external_id: event.externalId ? [(0, security_1.sha256)(event.externalId)] : undefined,
    };
    Object.keys(userData).forEach((key) => userData[key] === undefined && delete userData[key]);
    const payload = {
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
    if (process.env.APP_ENV === "staging" && process.env.META_TEST_EVENT_CODE) {
        payload.test_event_code = process.env.META_TEST_EVENT_CODE;
    }
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ status: response.status }));
    await db_1.prisma.eventLog.create({
        data: {
            orderId: event.orderId,
            eventName: event.eventName,
            eventId: event.eventId,
            channel: "server",
            sourceUrl: event.sourceUrl,
            payload: payload,
            response: body,
            accepted: response.ok,
            error: response.ok ? undefined : JSON.stringify(body),
        },
    });
    if (!response.ok)
        throw new Error(`Meta CAPI error: ${JSON.stringify(body)}`);
    return body;
}
