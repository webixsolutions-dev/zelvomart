import { Prisma, type OrderStatus } from "../generated/prisma/client";
import { prisma } from "./db";
import { getSetting } from "./settings";
import { productHasFreeShipping } from "./catalog-meta";
import { BUY_TWO_DISCOUNT_PERCENT, bundleLineTotal, priceSummary, variantPriceSummary } from "./pricing";
import { resolveDeliveryPolicy, quoteFromPolicy } from "./shipping";
import { canSell } from "./stock";
import { dispatchJobRow } from "./jobs";

// Far-away database: allow time to open a connection and finish (Prisma default wait is 2s).
const ORDER_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

type CheckoutInput = {
  idempotencyKey: string;
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
  postcode?: string;
  orderNotes?: string;
  paymentMethod: "COD" | "NAYAPAY";
  terms: boolean;
  cart: Array<{ productId: string; variantId?: string | null; quantity: number; bundleSize: 1 | 2 }>;
  source?: Record<string, unknown>;
  fbp?: string;
  fbc?: string;
  clarityId?: string;
  replaySessionId?: string;
  clientIp?: string;
  clientUserAgent?: string;
  experiments?: Record<string, string>;
};

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export async function createOrder(input: CheckoutInput) {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: true },
  });
  if (existing) return existing;

  const [deliveryRule, requiredFields, paymentMethods] = await Promise.all([
    getSetting<any>("store.delivery", { mode: "FREE", flatRate: 0, freeAbove: 0, codFee: 0 }),
    getSetting<Record<string, boolean>>("checkout.requiredFields", {
      fullName: true,
      phone: true,
      email: true,
      city: true,
      address: true,
      postcode: true,
      terms: true,
    }),
    getSetting<string[]>("payments.methods", ["COD"]),
  ]);

  if (!paymentMethods.includes(input.paymentMethod)) throw new Error("PAYMENT_METHOD_DISABLED");
  if (requiredFields.email && !input.email) throw new Error("EMAIL_REQUIRED");
  if (requiredFields.postcode && !input.postcode) throw new Error("POSTCODE_REQUIRED");
  if (requiredFields.orderNotes && !input.orderNotes) throw new Error("ORDER_NOTES_REQUIRED");
  if (requiredFields.terms && !input.terms) throw new Error("TERMS_REQUIRED");

  const productIds = [...new Set(input.cart.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "PUBLISHED" },
    include: { variants: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  type Prepared = {
    productId: string;
    variantId?: string;
    sku: string;
    title: string;
    variantLabel?: string;
    quantity: number;
    stockNeeded: number;
    /** Track ON: this line reduces (and on cancel/return restores) stock. */
    tracked: boolean;
    unitPrice: number;
    lineTotal: number;
    bundleDiscount: number;
    imageUrl?: string;
    freeShipping: boolean;
  };

  const prepared: Prepared[] = [];

  for (const item of input.cart) {
    const product = productMap.get(item.productId);
    if (!product) throw new Error("PRODUCT_NOT_AVAILABLE");

    const variant = item.variantId ? product.variants.find((row) => row.id === item.variantId && row.active) : undefined;
    if (item.variantId && !variant) throw new Error("VARIANT_NOT_AVAILABLE");
    // A product with variations is bought as one of its variations.
    if (!variant && product.variants.some((row) => row.active)) throw new Error("VARIANT_REQUIRED");

    const base = variantPriceSummary(priceSummary(product.price, product.salePrice), { priceOverride: variant?.priceOverride }).price;
    const offerSize: 1 | 2 = item.bundleSize === 2 && product.bundleEnabled ? 2 : 1;
    const priced = bundleLineTotal(base, item.quantity, offerSize, BUY_TWO_DISCOUNT_PERCENT);
    // Track ON: enough quantity. Track OFF: the stock status must be In stock.
    const stockItem = variant || product;
    if (!canSell(stockItem, priced.pieces)) throw new Error("OUT_OF_STOCK");

    const images = Array.isArray(product.images) ? (product.images as string[]) : [];
    prepared.push({
      productId: product.id,
      variantId: variant?.id,
      sku: variant?.sku || product.sku,
      title: product.title,
      variantLabel: variant?.name,
      quantity: priced.pieces,
      stockNeeded: priced.pieces,
      tracked: Boolean(stockItem.trackStock),
      unitPrice: base,
      lineTotal: priced.total,
      bundleDiscount: priced.saving,
      imageUrl: variant?.imageUrl || images[0],
      freeShipping: productHasFreeShipping(product.sourceUrl),
    });
  }

  const subtotal = prepared.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const bundleSaving = prepared.reduce((sum, item) => sum + item.bundleDiscount, 0);
  const discountedSubtotal = subtotal - bundleSaving;
  const everyItemFree = prepared.length > 0 && prepared.every((item) => item.freeShipping);
  const deliveryPolicy = resolveDeliveryPolicy(deliveryRule);
  const deliveryFee = quoteFromPolicy(discountedSubtotal, everyItemFree, deliveryPolicy).fee;
  const codFee = input.paymentMethod === "COD" ? deliveryPolicy.codFee : 0;
  const total = discountedSubtotal + deliveryFee + codFee;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.order.findMany({
    where: { phone: input.phone, createdAt: { gte: since } },
    include: { items: true },
    take: 20,
  });
  const signature = prepared
    .map((item) => `${item.sku}:${item.quantity}`)
    .sort()
    .join("|");
  const possibleDuplicate = recent.some(
    (order) =>
      order.items
        .map((item) => `${item.sku}:${item.quantity}`)
        .sort()
        .join("|") === signature,
  );

  const existingCustomer = await prisma.customer.findUnique({ where: { phone: input.phone } });
  const blocklisted = Boolean(existingCustomer?.blocklisted);
  const cityKnown = await prisma.city.findUnique({ where: { name: input.city } });
  const initialStatus: OrderStatus = blocklisted ? "ON_HOLD" : "NEW";

  const result = await prisma.$transaction(async (tx) => {
    await tx.sequence.upsert({
      where: { name: "order" },
      update: {},
      create: { name: "order", value: 10000 },
    });
    const seq = await tx.sequence.update({
      where: { name: "order" },
      data: { value: { increment: 1 } },
    });
    const orderNumber = `ZM-${seq.value}`;

    const customer = await tx.customer.upsert({
      where: { phone: input.phone },
      update: { name: input.fullName, email: input.email || undefined },
      create: { phone: input.phone, name: input.fullName, email: input.email || undefined },
    });

    for (const item of prepared) {
      // Track OFF: not checked against or reduced from a quantity.
      if (!item.tracked) continue;
      if (item.variantId) {
        const changed = await tx.variant.updateMany({
          where: { id: item.variantId, trackStock: true, stock: { gte: item.stockNeeded } },
          data: { stock: { decrement: item.stockNeeded } },
        });
        if (changed.count !== 1) throw new Error("OUT_OF_STOCK");
      } else {
        const changed = await tx.product.updateMany({
          where: { id: item.productId, trackStock: true, stock: { gte: item.stockNeeded } },
          data: { stock: { decrement: item.stockNeeded } },
        });
        if (changed.count !== 1) throw new Error("OUT_OF_STOCK");
      }
    }

    const source = input.source || {};
    const firstTouch = source.firstTouch && typeof source.firstTouch === "object" ? source.firstTouch as Record<string, unknown> : {};
    const lastTouch = source.lastTouch && typeof source.lastTouch === "object" ? source.lastTouch as Record<string, unknown> : {};
    const rawSource = source.utm_source || lastTouch.utm_source || firstTouch.utm_source || "direct";
    const sourceName = (() => {
      const value = String(rawSource || "direct").trim().toLowerCase();
      if (["fb", "facebook"].includes(value) || value.includes("facebook")) return "facebook";
      if (["ig", "instagram"].includes(value) || value.includes("instagram")) return "instagram";
      if (value.includes("google")) return "google";
      if (value.includes("tiktok")) return "tiktok";
      return value || "direct";
    })();
    const order = await tx.order.create({
      data: {
        orderNumber,
        idempotencyKey: input.idempotencyKey,
        customerId: customer.id,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email || null,
        city: input.city,
        address: input.address,
        postcode: input.postcode || null,
        notes: [input.orderNotes, !cityKnown ? "City entered as free text; review before booking." : null]
          .filter(Boolean)
          .join("\n") || null,
        status: initialStatus,
        paymentMethod: input.paymentMethod,
        subtotal: decimal(subtotal),
        bundleSaving: decimal(bundleSaving),
        deliveryFee: decimal(deliveryFee),
        codFee: decimal(codFee),
        total: decimal(total),
        source: sourceName,
        firstTouch: (source.firstTouch as any) || null,
        lastTouch: (source.lastTouch as any) || source as any,
        fbp: input.fbp,
        fbc: input.fbc,
        clarityId: input.clarityId,
        replaySessionId: input.replaySessionId || null,
        clientIp: input.clientIp || null,
        clientUserAgent: input.clientUserAgent || null,
        experiments: input.experiments as any,
        possibleDuplicate,
        blocklistedAtOrder: blocklisted,
        items: {
          create: prepared.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            title: item.title,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            unitPrice: decimal(item.unitPrice),
            lineTotal: decimal(item.lineTotal),
            bundleDiscount: decimal(item.bundleDiscount),
            imageUrl: item.imageUrl,
            stockReduced: item.tracked,
          })),
        },
        statusHistory: {
          create: {
            to: initialStatus,
            note: blocklisted ? "Order held because this customer is blocklisted." : "Order placed.",
          },
        },
      },
      include: { items: true },
    });

    const phoneTail = input.phone.replace(/\D/g, "").slice(-10);
    if (phoneTail) {
      await tx.abandonedCheckout.updateMany({
        where: { phone: { endsWith: phoneTail }, convertedAt: null },
        data: { convertedAt: new Date() },
      });
    }

    const jobs = await Promise.all([
      tx.job.create({ data: { name: "order-team-email", orderId: order.id, payload: { orderId: order.id } } }),
      tx.job.create({ data: { name: "customer-order-email", orderId: order.id, payload: { orderId: order.id } } }),
      ...(order.test || order.staffCreated
        ? []
        : [
            tx.job.create({ data: { name: "meta-purchase", orderId: order.id, payload: { orderId: order.id } } }),
            tx.job.create({ data: { name: "tiktok-purchase", orderId: order.id, payload: { orderId: order.id } } }),
          ]),
    ]);

    return { order, jobIds: jobs.map((job) => job.id) };
  }, ORDER_TX_OPTIONS);

  await Promise.allSettled(result.jobIds.map((id) => dispatchJobRow(id)));
  return result.order;
}

export async function restoreOrderStock(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  // Only lines that took stock off a tracked item put it back. updateMany: a deleted
  // variation or product is skipped instead of failing the whole restore.
  const restock = order.items.filter((item) => item.stockReduced);
  if (!restock.length) return;
  await prisma.$transaction(async (tx) => {
    for (const item of restock) {
      if (item.variantId) {
        await tx.variant.updateMany({ where: { id: item.variantId, trackStock: true }, data: { stock: { increment: item.quantity } } });
      } else if (item.productId) {
        await tx.product.updateMany({ where: { id: item.productId, trackStock: true }, data: { stock: { increment: item.quantity } } });
      }
    }
    // Put back once only: cancelling, reopening and cancelling the same order again must not add stock twice.
    await tx.orderItem.updateMany({ where: { id: { in: restock.map((item) => item.id) } }, data: { stockReduced: false } });
  }, ORDER_TX_OPTIONS);
}
