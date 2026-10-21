export function postexTrackingUrl(trackingNumber: string) {
  const base = process.env.POSTEX_TRACKING_BASE_URL || "https://postex.pk/tracking";
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(trackingNumber)}`;
}

// Booking a PostEx shipment is not built yet: orders are booked in the PostEx portal and the tracking number
// is entered in Admin → Orders. (An unused bookPostExOrder() stub was removed so nobody assumes it works.)
