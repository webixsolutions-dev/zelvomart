import { PrismaClient } from "../src/generated/prisma";
import { dispatchJobRow, getBoss } from "../src/lib/jobs";
import { sendCustomerOrderEmail, sendCustomerStatusEmail, sendFailureAlert, sendOrderTeamEmail } from "../src/lib/email";
import { sendMetaServerEvent } from "../src/lib/meta";
import { Resend } from "resend";
import { money } from "../src/lib/format";
import { getSetting } from "../src/lib/settings";

const prisma = new PrismaClient();

async function withJobLog<T>(jobLogId: string | undefined, fn: () => Promise<T>) {
  if (jobLogId) {
    await prisma.job.update({
      where: { id: jobLogId },
      data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date(), error: null },
    });
  }

  try {
    const result = await fn();
    if (jobLogId) {
      await prisma.job.update({
        where: { id: jobLogId },
        data: { status: "SUCCEEDED", finishedAt: new Date() },
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
  const boss = await getBoss();

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
    return withJobLog(data.jobLogId, () => sendMetaServerEvent({
      eventName: String(data.eventName),
      eventId: String(data.eventId),
      sourceUrl: data.sourceUrl || undefined,
      userAgent: data.userAgent || undefined,
      ip: data.ip || undefined,
      fbp: data.fbp || undefined,
      fbc: data.fbc || undefined,
      customData: data.customData && typeof data.customData === "object" ? data.customData : undefined,
    }));
  });

  await boss.work("meta-purchase", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });
      if (!order || order.test || order.staffCreated) return;

      const names = order.fullName.trim().split(/\s+/);
      await sendMetaServerEvent({
        eventName: "Purchase",
        eventId: order.orderNumber,
        orderId: order.id,
        sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success/${order.orderNumber}`,
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
        externalId: order.customerId || undefined,
        customData: {
          content_ids: order.items.map((item) => item.sku),
          contents: order.items.map((item) => ({
            id: item.sku,
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
      const sourceRows = [...sourceMap.entries()].sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,8)
        .map(([name,row])=>`<tr><td>${name}</td><td>${row.orders}</td><td>${money(row.revenue)}</td></tr>`).join("");
      const categoryRows = [...categoryMap.entries()].sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,10)
        .map(([name,row])=>`<tr><td>${name}</td><td>${row.quantity}</td><td>${money(row.revenue)}</td></tr>`).join("");
      const productRows = [...productMap.entries()].sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,10)
        .map(([name,row])=>`<tr><td>${name}</td><td>${row.quantity}</td><td>${money(row.revenue)}</td></tr>`).join("");
      const recipients = await getSetting<string[]>(
        "notifications.orderRecipients",
        (process.env.ORDER_ALERT_RECIPIENTS || "zelvomart@gmail.com").split(",").map((x) => x.trim()).filter(Boolean),
      );

      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Zelvomart Orders <orders@zelvomart.com>",
        to: recipients,
        subject: `Zelvomart daily summary • ${start.toISOString().slice(0, 10)}`,
        html: `<h2>Daily summary</h2>
          <p>Orders: <b>${orders.length}</b> • Revenue: <b>${money(revenue)}</b> • Meta Purchase accepted: <b>${accepted}</b> • Failed jobs: <b>${failedJobs}</b></p>
          <h3>Funnel</h3><p>PageView ${eventMap.get("PageView")||0} → ViewContent ${eventMap.get("ViewContent")||0} → AddToCart ${eventMap.get("AddToCart")||0} → InitiateCheckout ${eventMap.get("InitiateCheckout")||0} → Orders ${orders.length}</p>
          <h3>By source</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Source</th><th>Orders</th><th>Revenue</th></tr>${sourceRows||"<tr><td colspan=3>No orders</td></tr>"}</table>
          <h3>By category</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Category</th><th>Qty</th><th>Revenue</th></tr>${categoryRows||"<tr><td colspan=3>No orders</td></tr>"}</table>
          <h3>Top products</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>${productRows||"<tr><td colspan=3>No orders</td></tr>"}</table>`,
      });
    });
  });

  await boss.work("tracking-health-check", async ([job]) => {
    const data = job.data as any;
    return withJobLog(data.jobLogId, async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orders = await prisma.order.count({ where: { createdAt: { gte: since }, test: false, staffCreated: false } });
      const accepted = await prisma.eventLog.count({
        where: { eventName: "Purchase", channel: "server", accepted: true, createdAt: { gte: since } },
      });
      const issues: string[] = [];
      if (orders !== accepted) {
        const recentOrders = await prisma.order.findMany({
          where: { createdAt: { gte: since }, test: false, staffCreated: false },
          select: { orderNumber: true },
          orderBy: { createdAt: "asc" },
        });
        const acceptedRows = await prisma.eventLog.findMany({
          where: { eventName: "Purchase", channel: "server", accepted: true, createdAt: { gte: since } },
          select: { eventId: true },
        });
        const acceptedIds = new Set(acceptedRows.map((row) => row.eventId));
        const missing = recentOrders.map((row) => row.orderNumber).filter((id) => !acceptedIds.has(id));
        issues.push(`Website orders in last 24h: ${orders}; accepted server Purchase events: ${accepted}. Missing/failed order IDs: ${missing.join(", ") || "none resolved"}`);
      }

      const eventNames = ["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "Purchase", "Contact"];
      const dayMs = 24 * 60 * 60 * 1000;
      for (const eventName of eventNames) {
        const lastDay = await prisma.eventLog.count({ where: { eventName, createdAt: { gte: since } } });
        const eightDaysAgo = new Date(Date.now() - 8 * dayMs);
        const sevenDayCount = await prisma.eventLog.count({ where: { eventName, createdAt: { gte: eightDaysAgo, lt: since } } });
        const dailyAverage = sevenDayCount / 7;
        if (dailyAverage >= 4 && lastDay < dailyAverage / 2) {
          issues.push(`${eventName} volume ${lastDay} is below half of its recent daily average (${dailyAverage.toFixed(1)}).`);
        }
      }

      const metaErrors = await prisma.eventLog.count({
        where: { channel: "server", createdAt: { gte: since }, OR: [{ accepted: false }, { error: { not: null } }] },
      });
      if (metaErrors) issues.push(`Meta/server event errors in last 24h: ${metaErrors}`);

      if (issues.length) {
        await sendFailureAlert("Zelvomart tracking health alert", issues.join("\n"));
      }
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
  await boss.schedule("tracking-health-check", "15 4 * * *", {});
  await boss.schedule("abandoned-checkout-scan", "*/15 * * * *", {});
  await boss.schedule("job-recovery", "*/5 * * * *", {});
  await boss.schedule("rate-limit-cleanup", "30 3 * * *", {});

  console.log("Zelvomart worker is running.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
