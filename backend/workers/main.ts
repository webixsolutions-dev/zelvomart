import { trackingHealth } from "../src/lib/tracking-health";
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { dispatchJobRow, getBoss, jobResultStatus } from "../src/lib/jobs";
import {
  sendCustomerOrderEmail,
  sendCustomerStatusEmail,
  sendFailureAlert,
  sendOrderTeamEmail,
} from "../src/lib/email";
import { sendMetaServerEvent } from "../src/lib/meta";
import { sendTikTokServerEvent } from "../src/lib/tiktok";
import { Resend } from "resend";
import { internalEmail, orderAlertRecipients } from "../src/lib/email-delivery";
import { money } from "../src/lib/format";
import { setSetting, getSetting } from "../src/lib/settings";
import { assertWorkerDatabase, expiredBacklog } from "../src/lib/launch-jobs";
import { SITE_ORIGIN } from "../src/lib/site-url";

async function withJobLog<T>(jobLogId: string | undefined, fn: () => Promise<T>) {
  if (jobLogId) {
    const row = await prisma.job.findUnique({ where: { id: jobLogId } });
    if (!row || row.status === "SKIPPED" || row.status === "SUCCEEDED") return { skipped: "JOB_ALREADY_HANDLED" };
    if (expiredBacklog(row.createdAt)) {
      await prisma.job.updateMany({
        where: { id: jobLogId, status: { in: ["QUEUED", "FAILED"] } },
        data: { status: "SKIPPED", error: "STALE_BACKLOG: older than seven days.", finishedAt: new Date() },
      });
      return { skipped: "STALE_BACKLOG" };
    }
    const claim = await prisma.job.updateMany({
      where: { id: jobLogId, status: { in: ["QUEUED", "FAILED"] } },
      data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date(), error: null },
    });
    if (!claim.count) return { skipped: "JOB_ALREADY_CLAIMED" };
  }

  try {
    const result = await fn();
    if (jobLogId) {
      await prisma.job.update({
        where: { id: jobLogId },
        data: {
          status: jobResultStatus(result),
          error: result && typeof result === "object" && "skipped" in result ? String(result.skipped) : null,
          finishedAt: new Date(),
        },
      });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    if (jobLogId) {
      await prisma.job.update({
        where: { id: jobLogId },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
    }
    await sendFailureAlert("Zelvomart background job failed", message).catch(() => undefined);
    throw error;
  }
}

async function main() {
  assertWorkerDatabase(process.env.WORKER_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL);
  if (process.env.WORKER_BACKLOG_REVIEWED !== "true")
    throw new Error(
      "Run scripts/review-worker-backlog.ts, review the pending sends, then set WORKER_BACKLOG_REVIEWED=true before starting.",
    );
  const boss = await getBoss();
  for (const name of [
    "order-team-email",
    "customer-order-email",
    "customer-status-email",
    "meta-event",
    "meta-purchase",
    "tiktok-event",
    "tiktok-purchase",
    "daily-summary",
    "tracking-health-check",
    "abandoned-checkout-scan",
    "rate-limit-cleanup",
    "session-replay-retention-cleanup",
    "job-recovery",
  ])
    await boss.createQueue(name);
  const heartbeat = () =>
    setSetting("worker.heartbeat", { at: new Date().toISOString(), pid: process.pid }).catch((error) =>
      console.error("Worker heartbeat failed", error),
    );
  await heartbeat();
  setInterval(() => void heartbeat(), 30000);

  await boss.work("order-team-email", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, () => sendOrderTeamEmail(data.orderId));
  });

  await boss.work("customer-order-email", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, () => sendCustomerOrderEmail(data.orderId));
  });

  await boss.work("customer-status-email", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, () => sendCustomerStatusEmail(data.orderId, data.status));
  });

  await boss.work("meta-event", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, () =>
      sendMetaServerEvent({
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
      }),
    );
  });

  await boss.work("meta-purchase", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });
      if (!order || order.test || order.staffCreated || order.blocklistedAtOrder || order.status === "CANCELLED")
        return { skipped: "ORDER_EXCLUDED" };

      const names = order.fullName.trim().split(/\s+/);
      return sendMetaServerEvent({
        eventName: data.eventName || "Purchase",
        eventId: order.id,
        eventTime: Math.floor(order.createdAt.getTime() / 1000),
        orderId: order.id,
        sourceUrl: `${SITE_ORIGIN}/order-confirmed?order=${encodeURIComponent(order.orderNumber)}`,
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
    });
  });

  await boss.work("tiktok-event", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, () =>
      sendTikTokServerEvent({
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
      }),
    );
  });

  await boss.work("tiktok-purchase", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });
      if (!order || order.test || order.staffCreated || order.blocklistedAtOrder || order.status === "CANCELLED")
        return { skipped: "ORDER_EXCLUDED" };

      return sendTikTokServerEvent({
        eventName: data.eventName || "Purchase",
        eventId: order.id,
        eventTime: Math.floor(order.createdAt.getTime() / 1000),
        orderId: order.id,
        sourceUrl: `${SITE_ORIGIN}/order-confirmed?order=${encodeURIComponent(order.orderNumber)}`,
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
    });
  });

  await boss.work("daily-summary", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      if (!process.env.RESEND_API_KEY) return;
      const now = new Date();
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 1);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start, lt: end }, test: false },
        include: { items: { include: { product: { include: { category: true } } } } },
      });
      const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
      const accepted = await prisma.eventLog.count({
        where: { eventName: "Purchase", channel: "server", accepted: true, createdAt: { gte: start, lt: end } },
      });
      const failedJobs = await prisma.job.count({ where: { status: "FAILED", createdAt: { gte: start, lt: end } } });
      const eventCounts = await prisma.eventLog.groupBy({
        by: ["eventName"],
        where: { createdAt: { gte: start, lt: end }, channel: "browser" },
        _count: { _all: true },
      });
      const eventMap = new Map(eventCounts.map((row) => [row.eventName, row._count._all]));
      const sourceMap = new Map<string, { orders: number; revenue: number }>();
      const categoryMap = new Map<string, { quantity: number; revenue: number }>();
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      for (const order of orders) {
        const source = order.source || "direct";
        const sourceRow = sourceMap.get(source) || { orders: 0, revenue: 0 };
        sourceRow.orders += 1;
        sourceRow.revenue += Number(order.total);
        sourceMap.set(source, sourceRow);
        for (const item of order.items) {
          const categoryKey = item.product?.category?.name || "Uncategorized";
          const categoryRow = categoryMap.get(categoryKey) || { quantity: 0, revenue: 0 };
          categoryRow.quantity += item.quantity;
          categoryRow.revenue += Number(item.lineTotal);
          categoryMap.set(categoryKey, categoryRow);

          const productRow = productMap.get(item.title) || { quantity: 0, revenue: 0 };
          productRow.quantity += item.quantity;
          productRow.revenue += Number(item.lineTotal);
          productMap.set(item.title, productRow);
        }
      }
      const sourceRows = [...sourceMap.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 8)
        .map(([name, row]) => `<tr><td>${name}</td><td>${row.orders}</td><td>${money(row.revenue)}</td></tr>`)
        .join("");
      const categoryRows = [...categoryMap.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([name, row]) => `<tr><td>${name}</td><td>${row.quantity}</td><td>${money(row.revenue)}</td></tr>`)
        .join("");
      const productRows = [...productMap.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([name, row]) => `<tr><td>${name}</td><td>${row.quantity}</td><td>${money(row.revenue)}</td></tr>`)
        .join("");
      // Same recipients as the order alert (Admin -> Settings, else ORDER_ALERT_RECIPIENTS).
      const recipients = orderAlertRecipients(await getSetting<unknown>("notifications.orderRecipients", null));

      const health = await trackingHealth();
      const resend = new Resend(process.env.RESEND_API_KEY);
      const summary = internalEmail(
        "Orders",
        recipients,
        `Daily summary • ${start.toISOString().slice(0, 10)}`,
        `<h2>Daily summary</h2><p>Tracking health: ${health.healthy ? "Healthy" : "ACTION REQUIRED"}</p><ul>${health.issues.map((issue) => `<li>${issue}</li>`).join("")}</ul>
          <p>Orders: <b>${orders.length}</b> • Revenue: <b>${money(revenue)}</b> • Meta Purchase accepted: <b>${accepted}</b> • Failed jobs: <b>${failedJobs}</b></p>
          <h3>Funnel</h3><p>PageView ${eventMap.get("PageView") || 0} → ViewContent ${eventMap.get("ViewContent") || 0} → AddToCart ${eventMap.get("AddToCart") || 0} → InitiateCheckout ${eventMap.get("InitiateCheckout") || 0} → Orders ${orders.length}</p>
          <h3>By source</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Source</th><th>Orders</th><th>Revenue</th></tr>${sourceRows || "<tr><td colspan=3>No orders</td></tr>"}</table>
          <h3>By category</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Category</th><th>Qty</th><th>Revenue</th></tr>${categoryRows || "<tr><td colspan=3>No orders</td></tr>"}</table>
          <h3>Top products</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>${productRows || "<tr><td colspan=3>No orders</td></tr>"}</table>`,
      );
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Zelvomart Orders <orders@zelvomart.com>",
        ...summary,
      });
    });
  });

  await boss.work("tracking-health-check", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      const health = await trackingHealth();
      if (health.issues.length) await sendFailureAlert("Zelvomart tracking health alert", health.issues.join("\n"));
    });
  });

  await boss.work("abandoned-checkout-scan", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const rows = await prisma.abandonedCheckout.findMany({
        where: { createdAt: { lte: cutoff }, followedUpAt: null, convertedAt: null },
        take: 100,
      });
      // P1 deliberately does not auto-message. Rows surface in admin with one WhatsApp follow-up button.
      return rows.length;
    });
  });

  await boss.work("rate-limit-cleanup", async () => {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = await prisma.rateLimitBucket.deleteMany({ where: { updatedAt: { lt: cutoff } } });
    return result.count;
  });

  await boss.work("session-replay-retention-cleanup", async () => {
    const settingDays = await getSetting<number | string | null>("tracking.sessionReplayRetentionDays", null).catch(
      () => null,
    );
    const parsedSettingDays = settingDays !== null && settingDays !== undefined ? Number(settingDays) : NaN;
    const days =
      Number.isFinite(parsedSettingDays) && parsedSettingDays > 0
        ? parsedSettingDays
        : Number(process.env.SESSION_REPLAY_RETENTION_DAYS || 30);
    if (!Number.isFinite(days) || days <= 0) return 0;
    const cutoff = new Date(Date.now() - days * 86400000);
    const result = await prisma.sessionReplay.deleteMany({ where: { startedAt: { lt: cutoff } } });
    return result.count;
  });

  await boss.work("job-recovery", async () => {
    const cutoff = new Date(Date.now() - 60 * 1000);
    const stranded = await prisma.job.findMany({
      where: { status: "QUEUED", externalId: null, createdAt: { lte: cutoff } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const row of stranded) {
      try {
        await dispatchJobRow(row.id);
      } catch (error) {
        console.error(`Could not recover job ${row.id}`, error);
      }
    }
    return stranded.length;
  });

  await boss.schedule("daily-summary", "0 4 * * *", {}); // 9:00 Pakistan time
  await boss.schedule("tracking-health-check", "*/15 * * * *", {});
  await boss.schedule("abandoned-checkout-scan", "*/15 * * * *", {});
  await boss.schedule("job-recovery", "*/5 * * * *", {});
  await boss.schedule("rate-limit-cleanup", "30 3 * * *", {});
  await boss.schedule("session-replay-retention-cleanup", "0 3 * * *", {});

  console.log("Zelvomart worker is running.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
