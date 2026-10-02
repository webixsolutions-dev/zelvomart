"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postexTrackingUrl = postexTrackingUrl;
exports.bookPostExOrder = bookPostExOrder;
function postexTrackingUrl(trackingNumber) {
    const base = process.env.POSTEX_TRACKING_BASE_URL || "https://postex.pk/tracking";
    return `${base.replace(/\/$/, "")}/${encodeURIComponent(trackingNumber)}`;
}
async function bookPostExOrder(payload) {
    if (!process.env.POSTEX_API_BASE_URL || !process.env.POSTEX_API_TOKEN) {
        throw new Error("PostEx API is not configured");
    }
    const response = await fetch(`${process.env.POSTEX_API_BASE_URL.replace(/\/$/, "")}/orders`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${process.env.POSTEX_API_TOKEN}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok)
        throw new Error(`PostEx booking failed: ${response.status}`);
    return response.json();
}
