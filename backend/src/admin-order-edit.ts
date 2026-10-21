import { canSell } from "./lib/stock";
import { Router } from "express";
import { prisma } from "./lib/db";
import { Prisma } from "./generated/prisma/client";
import { requireAuth, type AuthedRequest } from "./lib/auth";
import { normalizePakistanPhone } from "./lib/phone";
import { getSetting } from "./lib/settings";
import { quoteDelivery } from "./lib/shipping";
import { productHasFreeShipping } from "./lib/catalog-meta";
import { priceSummary, variantPriceSummary } from "./lib/pricing";
export const orderEditRouter = Router();
const decimal = (n: number) => new Prisma.Decimal(n.toFixed(2));
orderEditRouter.post("/:id/notes", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
  const body = String(req.body.body || "").trim();
  if (!body || body.length > 5000) return res.status(400).json({ error: "Enter a note of 1–5,000 characters." });
  const orderId = String(req.params.id);
  const note = await prisma.$transaction(async (tx) => {
    const row = await tx.orderNote.create({
      data: { orderId, body, authorId: req.admin?.id, authorName: req.admin?.name },
    });
    await tx.auditLog.create({
      data: { userId: req.admin?.id, action: "add_note", entity: "Order", entityId: orderId },
    });
    return row;
  });
  res.status(201).json(note);
});
orderEditRouter.patch("/:id", requireAuth("orders.write"), async (req: AuthedRequest, res) => {
  const id = String(req.params.id),
    phone = normalizePakistanPhone(String(req.body.phone || "")),
    name = String(req.body.fullName || "").trim(),
    city = String(req.body.city || "").trim(),
    address = String(req.body.address || "").trim(),
    email = String(req.body.email || "")
      .trim()
      .toLowerCase(),
    notes = String(req.body.notes || "").trim();
  if (
    name.length < 2 ||
    name.length > 100 ||
    !phone ||
    city.length < 2 ||
    city.length > 100 ||
    address.length < 8 ||
    address.length > 500 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    notes.length > 1000
  )
    return res.status(400).json({ error: "Enter valid customer and delivery details." });
  const delivery = await getSetting<any>("store.delivery", {});
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${id}))`;
        const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
        if (req.body.updatedAt && new Date(req.body.updatedAt).getTime() !== order.updatedAt.getTime())
          throw new Error("This order was changed by another staff member. Refresh before saving.");
        const changes: string[] = [];
        for (const [key, value] of Object.entries({
          fullName: name,
          phone,
          city,
          address,
          email: email || null,
          notes: notes || null,
        }))
          if ((order as any)[key] !== value) changes.push(`${key} updated`);
        let totals: any = {};
        if (req.body.items) {
          if (["CANCELLED", "RETURNED", "DELIVERED", "SETTLED"].includes(order.status))
            throw new Error("Items cannot be edited after delivery, cancellation or return.");
          if (!Array.isArray(req.body.items) || !req.body.items.length || req.body.items.length > 50)
            throw new Error("Keep between 1 and 50 order lines.");
          const prepared: any[] = [],
            stock = new Map<string, { productId: string; variantId?: string; delta: number }>();
          const addStock = (productId: string | null, variantId: string | null, delta: number) => {
            if (!productId) return;
            const key = variantId || productId;
            const old = stock.get(key);
            stock.set(key, { productId, variantId: variantId || undefined, delta: (old?.delta || 0) + delta });
          };
          for (const item of order.items)
            if (item.stockReduced) addStock(item.productId, item.variantId, -item.quantity);
          const existingIds = new Set<string>();
          for (const input of req.body.items) {
            const quantity = Number(input.quantity);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)
              throw new Error("Quantity must be between 1 and 100.");
            let line: any;
            if (input.id) {
              if (existingIds.has(input.id)) throw new Error("Duplicate order line.");
              existingIds.add(input.id);
              const old = order.items.find((i) => i.id === input.id);
              if (!old) throw new Error("Order item not found.");
              line = {
                ...old,
                quantity,
                lineTotal: decimal((Number(old.unitPrice) - Number(old.bundleDiscount) / old.quantity) * quantity),
                bundleDiscount: decimal((Number(old.bundleDiscount) / old.quantity) * quantity),
              };
              delete line.id;
              delete line.orderId;
            } else {
              const product = await tx.product.findFirst({
                where: { id: String(input.productId), status: "PUBLISHED" },
                include: { variants: true },
              });
              if (!product) throw new Error("Product unavailable.");
              const variant = product.variants.find((v) => v.id === input.variantId && v.active);
              if ((input.variantId && !variant) || (!variant && product.variants.some((v) => v.active)))
                throw new Error("Select an active variation.");
              const item = variant || product;
              if (!item.trackStock && !canSell(item, quantity)) throw new Error("Product is out of stock.");
              const price = variantPriceSummary(priceSummary(product.price, product.salePrice), {
                priceOverride: variant?.priceOverride,
              }).price;
              line = {
                productId: product.id,
                variantId: variant?.id,
                sku: variant?.sku || product.sku,
                title: product.title,
                variantLabel: variant?.name,
                quantity,
                unitPrice: decimal(price),
                lineTotal: decimal(price * quantity),
                bundleDiscount: decimal(0),
                imageUrl: variant?.imageUrl || (Array.isArray(product.images) ? String(product.images[0] || "") : null),
                stockReduced: item.trackStock,
              };
            }
            if (line.stockReduced) addStock(line.productId, line.variantId, quantity);
            prepared.push(line);
          }
          for (const change of [...stock.values()].sort((a, b) =>
            (a.variantId || a.productId).localeCompare(b.variantId || b.productId),
          )) {
            if (!change.delta) continue;
            const table = change.variantId ? tx.variant : tx.product;
            const where: any = {
              id: change.variantId || change.productId,
              ...(change.delta > 0 ? { stock: { gte: change.delta } } : {}),
            };
            const changed = await (table as any).updateMany({ where, data: { stock: { increment: -change.delta } } });
            if (change.delta > 0 && changed.count !== 1) throw new Error("Not enough stock for the new quantity.");
          }
          const subtotal = prepared.reduce((n, i) => n + Number(i.unitPrice) * i.quantity, 0),
            saving = prepared.reduce((n, i) => n + Number(i.bundleDiscount), 0),
            net = subtotal - saving;
          const products = await tx.product.findMany({
            where: { id: { in: prepared.map((i) => i.productId).filter(Boolean) } },
            select: { id: true, sourceUrl: true },
          });
          const allFree = prepared.every((i) =>
            products.some((p) => p.id === i.productId && productHasFreeShipping(p.sourceUrl)),
          );
          let discount = Number(order.couponDiscount);
          if (order.couponCode) {
            const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
            if (coupon?.type === "PERCENT") {
              const oldNet = Number(order.subtotal) - Number(order.bundleSaving);
              discount = oldNet ? (net * Number(order.couponDiscount)) / oldNet : 0;
            }
          }
          discount = Math.min(net, Math.max(0, discount));
          const fee = quoteDelivery(net, allFree, delivery).fee;
          totals = {
            subtotal: decimal(subtotal),
            bundleSaving: decimal(saving),
            couponDiscount: decimal(discount),
            deliveryFee: decimal(fee),
            codFee: decimal(0),
            total: decimal(net - discount + fee),
          };
          await tx.orderItem.deleteMany({ where: { orderId: id } });
          await tx.orderItem.createMany({ data: prepared.map((i) => ({ ...i, orderId: id })) });
          changes.push("Items and totals recalculated");
        }
        const customer = await tx.customer.upsert({
          where: { phone },
          update: { name, email: email || undefined },
          create: { phone, name, email: email || null },
        });
        const updated = await tx.order.update({
          where: { id },
          data: {
            fullName: name,
            phone,
            email: email || null,
            city,
            address,
            notes: notes || null,
            customerId: customer.id,
            ...totals,
          },
        });
        if (changes.length) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: id,
              from: order.status,
              to: order.status,
              userId: req.admin?.id,
              note: changes.join("; "),
            },
          });
          await tx.auditLog.create({
            data: { userId: req.admin?.id, action: "edit", entity: "Order", entityId: id, details: { changes } },
          });
        }
        return updated;
      },
      { maxWait: 15000, timeout: 90000 },
    );
    res.json({ ok: true, id: result.id, total: Number(result.total) });
  } catch (e: any) {
    res.status(409).json({ error: e.code === "P2025" ? "Order not found." : e.message });
  }
});
export async function orderExtras(order: any) {
  const [notes, history, replay, events, city, previous, next] = await Promise.all([
    prisma.orderNote.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } }),
    prisma.order.findMany({
      where: { phone: order.phone },
      select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    order.replaySessionId
      ? prisma.sessionReplay.findUnique({
          where: { id: order.replaySessionId },
          select: { device: true, pageViews: true, landingUrl: true },
        })
      : null,
    prisma.eventLog.findMany({
      where: { orderId: order.id, eventName: "Purchase", channel: { in: ["server", "tiktok-server"] } },
      select: { channel: true, accepted: true, createdAt: true, error: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.city.findUnique({ where: { name: order.city } }),
    prisma.order.findFirst({
      where: { createdAt: { lt: order.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.order.findFirst({
      where: { createdAt: { gt: order.createdAt } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);
  const delivered = history.filter((o) => ["DELIVERED", "SETTLED"].includes(o.status)),
    spent = delivered.reduce((n, o) => n + Number(o.total), 0);
  return {
    privateNotes: notes,
    customerHistory: {
      orders: history.map((o) => ({ ...o, total: Number(o.total) })),
      delivered: delivered.length,
      returned: history.filter((o) => o.status === "RETURNED").length,
      spent,
      aov: delivered.length ? spent / delivered.length : 0,
    },
    replay,
    purchaseEvents: events,
    deliveryEstimate: `${city?.deliveryMinDays ?? 2}–${city?.deliveryMaxDays ?? 7} working days`,
    previous: previous?.id,
    next: next?.id,
  };
}
