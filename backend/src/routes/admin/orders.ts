import { orderExtras } from "../../admin-order-edit";
import { tiktokJobsEnabled } from "../../lib/tiktok";
import { trackingHealth } from "../../lib/tracking-health";
import { Prisma, OrderStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { createOrder, transitionOrder } from "../../lib/order";
import { checkoutSchema } from "../../lib/validators";
import { getSetting } from "../../lib/settings";
import { postexTrackingUrl } from "../../lib/postex";
import { invalidateFrontendCache } from "../../lib/cache-invalidation";
import { dispatchJobRow } from "../../lib/jobs";
import type { Express } from "express";
import { audit, jsonProductSummary, productListSelect, routeParam } from "../../http/shared";

async function orderFilters(query: Record<string, unknown>): Promise<Prisma.OrderWhereInput> {
  const text = (key: string) => String(query[key] || "").trim();
  const q = text("q"),
    status = text("status");
  const groups: Record<string, OrderStatus[]> = {
    Pending: ["NEW", "ON_HOLD"],
    Processing: ["CONFIRMED"],
    Shipped: ["BOOKED", "IN_TRANSIT"],
    Delivered: ["DELIVERED", "SETTLED"],
    Cancelled: ["CANCELLED"],
    Returned: ["RETURNED"],
  };
  const date = (key: string, end = false) => {
    const value = text(key);
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
    const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}+05:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_DATE");
    return parsed;
  };
  const gte = date("from"),
    lte = date("to", true);
  if (gte && lte && gte > lte) throw new Error("INVALID_DATE_RANGE");
  if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) throw new Error("INVALID_STATUS");
  return {
    ...(status
      ? { status: status as OrderStatus }
      : groups[text("group")]
        ? { status: { in: groups[text("group")] } }
        : {}),
    ...(text("hasReplay") === "true" ? { replaySessionId: { not: null } } : {}),
    ...(text("repeat") === "true"
      ? {
          customerId: {
            in: (
              await prisma.order.groupBy({
                by: ["customerId"],
                where: { customerId: { not: null } },
                _count: { _all: true },
                having: { customerId: { _count: { gt: 1 } } },
              })
            ).map((r) => r.customerId!),
          },
        }
      : {}),
    ...(text("city") ? { city: { contains: text("city"), mode: "insensitive" } } : {}),
    ...(text("source") ? { source: { contains: text("source"), mode: "insensitive" } } : {}),
    ...(gte || lte ? { createdAt: { gte, lte } } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { customer: { phone: { contains: q } } },
            { items: { some: { title: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}
async function enqueueOrderStatusTracking(orderId: string, status: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { test: true, staffCreated: true, blocklistedAtOrder: true },
  });
  if (!order || order.test || order.staffCreated || order.blocklistedAtOrder) return;
  const eventName = status === "CONFIRMED" ? "OrderConfirmed" : "OrderDelivered";
  const jobs = await Promise.all(
    (await purchaseJobNames()).map((name) =>
      prisma.job.create({ data: { name, orderId, payload: { orderId, eventName } } }),
    ),
  );
  await Promise.allSettled(jobs.map((job) => dispatchJobRow(job.id)));
}

/** Meta always; TikTok only while its Events API is on and a pixel ID is set. */
async function purchaseJobNames() {
  return ["meta-purchase", ...((await tiktokJobsEnabled()) ? ["tiktok-purchase"] : [])];
}

const ORDER_DELETE_ROLES = new Set(["OWNER", "MANAGER"]);
const canDeleteOrders = (req: AuthedRequest) => ORDER_DELETE_ROLES.has(String(req.admin?.role));

/** Removes one order for good (see the routes below). Returns the deleted id, or "NOT_FOUND". */
async function hardDeleteOrder(req: AuthedRequest, id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, status: true, test: true },
  });
  if (!order) return "NOT_FOUND" as const;
  await prisma.$transaction([
    prisma.job.deleteMany({ where: { orderId: id } }),
    prisma.order.updateMany({ where: { id, replaySessionId: { not: null } }, data: { replaySessionId: null } }),
    prisma.order.delete({ where: { id } }),
  ]);
  await audit(req, "hard_delete", "Order", id, {
    orderNumber: order.orderNumber,
    test: order.test,
    status: order.status,
  });
  return order.id;
}

export function registerAdminOrdersRoutes(app: Express) {
  app.get("/api/admin/dashboard", requireAuth("orders.read"), async (_req, res) => {
    const health = await trackingHealth();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const yesterday = new Date(start.getTime() - 86400000);
    const [
      todayOrders,
      yesterdayOrders,
      products,
      customers,
      failedJobs,
      events,
      recent,
      acceptedPurchases,
      teamEmails,
    ] = await Promise.all([
      prisma.order.findMany({ where: { createdAt: { gte: start } } }),
      prisma.order.findMany({ where: { createdAt: { gte: yesterday, lt: start } } }),
      prisma.product.count({ where: { status: "PUBLISHED" } }),
      prisma.customer.count(),
      prisma.job.count({ where: { status: "FAILED" } }),
      prisma.eventLog.groupBy({ by: ["eventName"], where: { createdAt: { gte: start } }, _count: { _all: true } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.eventLog.count({
        where: { createdAt: { gte: start }, channel: "server", eventName: "Purchase", accepted: true },
      }),
      prisma.job.count({ where: { createdAt: { gte: start }, name: "order-team-email", status: "SUCCEEDED" } }),
    ]);
    const realOrders = todayOrders.filter((o) => !o.test && !o.staffCreated).length;
    res.json({
      health,
      ordersToday: todayOrders.length,
      revenueToday: todayOrders.reduce((s, o) => s + Number(o.total), 0),
      ordersYesterday: yesterdayOrders.length,
      revenueYesterday: yesterdayOrders.reduce((s, o) => s + Number(o.total), 0),
      delivered: todayOrders.filter((o) => o.status === "DELIVERED").length,
      failedJobs,
      products,
      customers,
      acceptedPurchases,
      trackingCoverage: realOrders ? Math.round((acceptedPurchases / realOrders) * 1000) / 10 : null,
      teamEmails,
      emailCoverage: todayOrders.length ? Math.round((teamEmails / todayOrders.length) * 1000) / 10 : null,
      events: Object.fromEntries(events.map((e) => [e.eventName, e._count._all])),
      recent: recent.map((o) => ({ ...o, total: Number(o.total) })),
    });
  });

  // Static routes must precede /orders/:id.
  app.get("/api/admin/orders/export.csv", requireAuth("orders.export"), async (req, res) => {
    let where: Prisma.OrderWhereInput;
    try {
      where = await orderFilters(req.query);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    const rows = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" } });
    const esc = (v: unknown) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replace(/"/g, '""')}"`;
    const csv = [
      "orderNumber,date,customer,phone,email,city,status,paymentMethod,total,source,tracking",
      ...rows.map((o) =>
        [
          o.orderNumber,
          o.createdAt.toISOString(),
          o.fullName,
          o.phone,
          o.email,
          o.city,
          o.status,
          o.paymentMethod,
          o.total,
          o.source,
          o.postexTracking,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\r\n");
    res
      .attachment("zelvomart-orders.csv")
      .type("text/csv")
      .send("\uFEFF" + csv);
  });
  app.get("/api/admin/orders/dashboard", requireAuth("orders.read"), async (req, res) => {
    let where: Prisma.OrderWhereInput;
    try {
      where = await orderFilters({ ...req.query, status: "", group: "" });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    // Compare the selected period with the preceding equal-length period in Pakistan time.
    const now = new Date(Date.now() + 5 * 3600000);
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5 * 3600000);
    const range = where.createdAt as Prisma.DateTimeFilter | undefined;
    const currentEnd =
      range?.lte instanceof Date
        ? range.lte
        : new Date(Math.max(Date.now(), range?.gte instanceof Date ? range.gte.getTime() + 86400000 - 1 : 0));
    const currentStart =
      range?.gte instanceof Date
        ? range.gte
        : start > currentEnd
          ? new Date(currentEnd.getTime() - 30 * 86400000)
          : start;
    const duration = currentEnd.getTime() - currentStart.getTime() + 1;
    const comparisonBase = { ...where, createdAt: undefined };
    const [counts, current, previous, activity, products] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.order.groupBy({
        by: ["status"],
        where: { ...comparisonBase, createdAt: { gte: currentStart, lte: currentEnd } },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { ...comparisonBase, createdAt: { gte: new Date(currentStart.getTime() - duration), lt: currentStart } },
        _count: { _all: true },
      }),
      prisma.orderStatusHistory.findMany({
        where: { order: where },
        include: { order: { select: { id: true, orderNumber: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.orderItem.groupBy({
        by: ["sku", "title", "imageUrl"],
        where: { order: { ...where, status: { notIn: ["CANCELLED", "RETURNED"] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);
    const map = (rows: typeof counts) => Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    res.json({
      counts: map(counts),
      current: map(current),
      previous: map(previous),
      comparison: { from: currentStart, to: currentEnd },
      activity,
      products: products.map((p) => ({
        sku: p.sku,
        title: p.title,
        imageUrl: p.imageUrl,
        quantity: p._sum.quantity || 0,
      })),
    });
  });
  app.get("/api/admin/orders/catalog", requireAuth("orders.write"), async (req, res) => {
    const search = String(req.query.search || "").trim();
    const items = await prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { sku: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: productListSelect,
      take: 10,
      orderBy: { title: "asc" },
    });
    const discount = Number(await getSetting("store.bundleDefaultDiscountPercent", 5));
    res.json({ items: items.map((row) => jsonProductSummary(row, discount)) });
  });
  app.post("/api/admin/orders", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      const order = await createOrder({
        ...parsed.data,
        staffCreated: true,
        email: parsed.data.email || undefined,
        source: { utm_source: "admin" },
      });
      await audit(req, "create", "Order", order.id);
      await invalidateFrontendCache(["products"]);
      res.status(201).json({ id: order.id, orderNumber: order.orderNumber });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "ORDER_CREATE_FAILED" });
    }
  });
  app.post("/api/admin/orders/:id/mark-test", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    const id = routeParam(req, "id");
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, test: true } });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    if (order.test) return res.json({ ok: true, alreadyTest: true });
    await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { test: true } }),
      prisma.job.updateMany({
        where: { orderId: id, status: { in: ["QUEUED", "FAILED"] } },
        data: { status: "SKIPPED", error: "Marked as a test order by an administrator.", finishedAt: new Date() },
      }),
    ]);
    await audit(req, "mark_test", "Order", id);
    res.json({ ok: true });
  });
  app.get("/api/admin/orders", requireAuth("orders.read"), async (req, res) => {
    let where: Prisma.OrderWhereInput;
    try {
      where = await orderFilters(req.query);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    const paginated = req.query.page !== undefined;
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 10)));
    const sorts: Record<string, Prisma.OrderOrderByWithRelationInput> = {
      newest: { createdAt: "desc" },
      oldest: { createdAt: "asc" },
      highest: { total: "desc" },
      lowest: { total: "asc" },
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: { select: { refusalCount: true, blocklisted: true, _count: { select: { orders: true } } } },
        },
        orderBy: [sorts[String(req.query.sort)] || sorts.newest, { id: "asc" }],
        skip: paginated ? (page - 1) * limit : 0,
        take: paginated ? limit : 1000,
      }),
      prisma.order.count({ where }),
    ]);
    const items = rows.map((r) => ({ ...r, total: Number(r.total) }));
    res.json(paginated ? { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) } : items);
  });
  app.patch("/api/admin/orders/bulk-status", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).slice(0, 100) : [];
    const next = String(req.body.status) as OrderStatus;
    if (!ids.length || !Object.values(OrderStatus).includes(next))
      return res.status(400).json({ error: "INVALID_BULK_UPDATE" });
    let updated = 0;
    for (const id of ids) {
      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing || existing.status === next) continue;
      await transitionOrder(id, next, req.admin?.id, "Bulk status update");
      if (["CONFIRMED", "BOOKED", "DELIVERED"].includes(next)) {
        const job = await prisma.job.create({
          data: { name: "customer-status-email", orderId: id, payload: { orderId: id, status: next } },
        });
        dispatchJobRow(job.id).catch(() => undefined);
      }
      if (["CONFIRMED", "DELIVERED"].includes(next)) await enqueueOrderStatusTracking(id, next);
      updated += 1;
    }
    await audit(req, "bulk_status_change", "Order", undefined, { ids, status: next, updated });
    if (["CANCELLED", "RETURNED"].includes(next)) await invalidateFrontendCache(["products"]);
    res.json({ ok: true, updated });
  });
  // Deleting orders: OWNER and MANAGER only, any order, one confirm in the admin. The order's queued jobs are removed
  // in the same transaction (so no email or Meta/TikTok event is ever sent for it), its session recording is
  // unlinked, and items/history/notes cascade. Stock is not put back and the customer record stays.
  app.delete("/api/admin/orders/:id", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    if (!canDeleteOrders(req)) return res.status(403).json({ error: "FORBIDDEN" });
    const result = await hardDeleteOrder(req, routeParam(req, "id"));
    if (result === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ deleted: [result] });
  });
  app.post("/api/admin/orders/bulk-delete", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    if (!canDeleteOrders(req)) return res.status(403).json({ error: "FORBIDDEN" });
    const ids: string[] = Array.isArray(req.body?.ids)
      ? [
          ...new Set<string>(
            req.body.ids.map((id: unknown) => (typeof id === "string" ? id : "")).filter((id: string) => id.length > 0),
          ),
        ].slice(0, 200)
      : [];
    if (!ids.length) return res.status(400).json({ error: "NO_ORDERS_SELECTED" });
    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const errors: { id: string; error: string }[] = [];
    for (const id of ids) {
      try {
        const result = await hardDeleteOrder(req, id);
        if (result === "NOT_FOUND") skipped.push({ id, reason: "NOT_FOUND" });
        else deleted.push(result);
      } catch (error) {
        errors.push({ id, error: error instanceof Error ? error.message : "DELETE_FAILED" });
      }
    }
    res.json({ deleted, skipped, errors });
  });
  app.post("/api/admin/orders/:id/resend-purchase", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    const id = routeParam(req, "id"),
      order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    if (order.test || order.staffCreated || order.blocklistedAtOrder)
      return res.status(400).json({ error: "Tracking is excluded for this order." });
    for (const name of await purchaseJobNames()) {
      const existing = await prisma.job.findFirst({
        where: { orderId: id, name, status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (!existing) {
        const job = await prisma.job.create({ data: { orderId: id, name, payload: { orderId: id } } });
        void dispatchJobRow(job.id).catch(() => undefined);
      }
    }
    await audit(req, "resend_purchase", "Order", id);
    res.json({ ok: true });
  });
  app.get("/api/admin/orders/:id", requireAuth("orders.read"), async (req, res) => {
    const row = await prisma.order.findUnique({
      where: { id: routeParam(req, "id") },
      include: {
        items: true,
        statusHistory: { include: { user: true }, orderBy: { createdAt: "desc" } },
        customer: true,
      },
    });
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({
      ...row,
      ...(await orderExtras(row)),
      total: Number(row.total),
      subtotal: Number(row.subtotal),
      bundleSaving: Number(row.bundleSaving),
      deliveryFee: Number(row.deliveryFee),
      codFee: Number(row.codFee),
      items: row.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        bundleDiscount: Number(i.bundleDiscount),
      })),
      trackingUrl: row.postexTracking ? postexTrackingUrl(row.postexTracking) : null,
    });
  });
  app.patch("/api/admin/orders/:id/status", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    const id = routeParam(req, "id");
    const next = String(req.body.status) as OrderStatus;
    if (!Object.values(OrderStatus).includes(next)) return res.status(400).json({ error: "INVALID_STATUS" });
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });
    await transitionOrder(id, next, req.admin?.id, String(req.body.note || "").slice(0, 5000));
    if (existing.status !== next && ["CONFIRMED", "DELIVERED"].includes(next))
      await enqueueOrderStatusTracking(id, next);
    await audit(req, "status_change", "Order", id, { from: existing.status, to: next });
    if (["CANCELLED", "RETURNED"].includes(next)) await invalidateFrontendCache(["products"]);
    if (existing.status !== next && ["CONFIRMED", "BOOKED", "DELIVERED"].includes(next)) {
      const job = await prisma.job.create({
        data: { name: "customer-status-email", orderId: id, payload: { orderId: id, status: next } },
      });
      dispatchJobRow(job.id).catch(() => undefined);
    }
    res.json({ ok: true });
  });
  app.patch("/api/admin/orders/:id/tracking", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
    const id = routeParam(req, "id");
    const tracking = String(req.body.tracking || "").trim();
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });
    await transitionOrder(
      id,
      tracking ? "BOOKED" : existing.status,
      req.admin?.id,
      tracking ? `PostEx tracking ${tracking}` : undefined,
      tracking || null,
    );
    if (tracking && existing.status !== "BOOKED") {
      const job = await prisma.job.create({
        data: { name: "customer-status-email", orderId: id, payload: { orderId: id, status: "BOOKED" } },
      });
      dispatchJobRow(job.id).catch(() => undefined);
    }
    await audit(req, "tracking_update", "Order", id, { tracking });
    res.json({ ok: true, trackingUrl: tracking ? postexTrackingUrl(tracking) : null });
  });
}
