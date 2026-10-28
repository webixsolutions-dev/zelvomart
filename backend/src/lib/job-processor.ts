import { prisma } from "./db";
import { SITE_ORIGIN } from "./site-url";
import { expiredBacklog } from "./launch-jobs";
import { sendCustomerOrderEmail, sendCustomerStatusEmail, sendFailureAlert, sendOrderTeamEmail } from "./email";
import { sendMetaServerEvent } from "./meta";
import { sendTikTokServerEvent } from "./tiktok";
import { jobResultStatus } from "./jobs";

type Row = Awaited<ReturnType<typeof prisma.job.findUnique>>;

/** Process one persisted job with the same atomic claim used by the worker. */
export async function processJobRow(jobLogId: string) {
  const row = await prisma.job.findUnique({ where: { id: jobLogId } });
  if (!row || ["SKIPPED", "SUCCEEDED"].includes(row.status)) return { skipped: "JOB_ALREADY_HANDLED" };
  if (expiredBacklog(row.createdAt)) {
    await prisma.job.updateMany({
      where: { id: jobLogId, status: { in: ["QUEUED", "FAILED"] } },
      data: { status: "SKIPPED", error: "STALE_BACKLOG: older than seven days.", finishedAt: new Date() },
    });
    return { skipped: "STALE_BACKLOG" };
  }
  const claim = await prisma.job.updateMany({
    where: { id: jobLogId, status: { in: ["QUEUED", "FAILED"] }, attempts: { lt: 5 } },
    data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date(), error: null },
  });
  if (!claim.count) return { skipped: "JOB_ALREADY_CLAIMED" };

  try {
    const data = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, any>;
    const orderId = String(data.orderId || row.orderId || "");
    const result = await handle(row, data, orderId);
    await prisma.job.update({
      where: { id: row.id },
      data: {
        status: jobResultStatus(result),
        error: result && typeof result === "object" && "skipped" in result ? String(result.skipped) : null,
        finishedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await prisma.job.update({
      where: { id: row.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await sendFailureAlert("Zelvomart background job failed", message).catch(() => undefined);
    throw error;
  }
}

async function handle(row: NonNullable<Row>, data: Record<string, any>, orderId: string) {
  switch (row.name) {
    case "order-team-email":
      return sendOrderTeamEmail(orderId);
    case "customer-order-email":
      return sendCustomerOrderEmail(orderId);
    case "customer-status-email":
      if (!["CONFIRMED", "BOOKED", "DELIVERED"].includes(String(data.status))) return { skipped: "INVALID_STATUS" };
      return sendCustomerStatusEmail(orderId, data.status as "CONFIRMED" | "BOOKED" | "DELIVERED");
    case "meta-event":
      return sendMetaServerEvent({
        eventName: String(data.eventName),
        eventId: String(data.eventId),
        sourceUrl: data.sourceUrl || undefined,
        userAgent: data.userAgent || undefined,
        ip: data.ip || undefined,
        fbp: data.fbp || undefined,
        fbc: data.fbc || undefined,
        eventTime: data.eventTime,
        externalId: data.visitorId || undefined,
        customData: data.customData && typeof data.customData === "object" ? data.customData : undefined,
      });
    case "tiktok-event":
      return sendTikTokServerEvent({
        eventName: String(data.eventName),
        eventId: String(data.eventId),
        sourceUrl: data.sourceUrl || undefined,
        userAgent: data.userAgent || undefined,
        ip: data.ip || undefined,
        ttp: data.ttp || undefined,
        ttclid: data.ttclid || undefined,
        eventTime: data.eventTime,
        externalId: data.visitorId || undefined,
        customData: data.customData && typeof data.customData === "object" ? data.customData : undefined,
      });
    case "meta-purchase":
    case "tiktok-purchase":
      return purchase(row.name, orderId, data.eventName);
    default:
      throw new Error(`Unsupported cron job: ${row.name}`);
  }
}

async function purchase(name: string, orderId: string, eventName?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.test || order.staffCreated || order.blocklistedAtOrder || order.status === "CANCELLED")
    return { skipped: "ORDER_EXCLUDED" };
  const names = order.fullName.trim().split(/\s+/);
  const sourceUrl = `${SITE_ORIGIN}/order-confirmed/?order=${encodeURIComponent(order.orderNumber)}`;
  // Use the public order number for browser/server deduplication; the local one-time
  // browser flag remains keyed by the database ID to avoid collisions if numbers roll over.
  const eventId = order.orderNumber;
  if (name === "meta-purchase")
    return sendMetaServerEvent({
      eventName: eventName || "Purchase",
      eventId,
      orderId: order.id,
      eventTime: Math.floor(order.createdAt.getTime() / 1000),
      sourceUrl,
      fbp: order.fbp || undefined,
      fbc: order.fbc || undefined,
      ip: order.clientIp || undefined,
      userAgent: order.clientUserAgent || undefined,
      phone: order.phone,
      email: order.email || undefined,
      firstName: names[0],
      lastName: names.slice(1).join(" ") || undefined,
      city: order.city,
      postcode: order.postcode || undefined,
      externalId: order.visitorId || order.customerId || undefined,
      customData: {
        content_ids: order.items.map((item) => item.sku),
        contents: order.items.map((item) => ({
          id: item.sku,
          content_id: item.sku,
          content_name: item.title,
          quantity: item.quantity,
          item_price: Number(item.unitPrice),
        })),
        num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
        value: Number(order.total),
        currency: "PKR",
        order_id: order.orderNumber,
      },
    });
  return sendTikTokServerEvent({
    eventName: eventName || "Purchase",
    eventId,
    orderId: order.id,
    eventTime: Math.floor(order.createdAt.getTime() / 1000),
    sourceUrl,
    ip: order.clientIp || undefined,
    userAgent: order.clientUserAgent || undefined,
    ttp: order.ttp || undefined,
    ttclid: order.ttclid || undefined,
    phone: order.phone,
    email: order.email || undefined,
    externalId: order.visitorId || order.customerId || undefined,
    customData: {
      content_type: "product",
      contents: order.items.map((item) => ({
        content_id: item.sku,
        content_name: item.title,
        quantity: item.quantity,
        price: Number(item.unitPrice),
      })),
      value: Number(order.total),
      currency: "PKR",
      order_id: order.orderNumber,
    },
  });
}
