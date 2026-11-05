import type { Express, Request } from "express";
import { prisma } from "../lib/db";
import { getSetting } from "../lib/settings";
import { allowRequest, routeParam, setNoStore } from "../http/shared";
import {
  advanceAvailability,
  advancePolicy,
  loadAdvanceSettings,
  paymentTokenMatches,
  type AdvanceSettings,
} from "../lib/advance-payment";

/** Shown until the owner uploads the real merchant QR (a storefront file, clearly marked "DEMO – NOT FOR PAYMENT"). */
export const DEMO_QR_PATH = "/images/payments/demo-raast-qr.png";
const REFUND_POLICY_PATH = "/refund_returns/";
/** A customer may switch to COD only before sending any proof. */
const SWITCHABLE = ["AWAITING_PAYMENT", "EXPIRED"] as const;

const orderForPage = {
  id: true,
  orderNumber: true,
  fullName: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  paymentTokenHash: true,
  blocklistedAtOrder: true,
  subtotal: true,
  bundleSaving: true,
  deliveryFee: true,
  couponDiscount: true,
  advanceDiscount: true,
  total: true,
  createdAt: true,
  _count: { select: { paymentProofs: true } },
} as const;

/** The order behind a payment link, or null for a wrong/missing token (always answered as 404, never a hint). */
async function orderByToken(req: Request) {
  const orderNumber = routeParam(req, "orderNumber").toUpperCase().slice(0, 40);
  const token = req.query.t;
  if (!/^ZM-\d{4,12}$/.test(orderNumber) || typeof token !== "string") return null;
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: orderForPage });
  if (!order || !paymentTokenMatches(token, order.paymentTokenHash)) return null;
  return order;
}

type PageOrder = NonNullable<Awaited<ReturnType<typeof orderByToken>>>;

async function payPage(order: PageOrder, settings: AdvanceSettings) {
  const info = await getSetting<{ whatsapp?: string }>("store.info", {});
  const { demo } = advanceAvailability(settings);
  return {
    orderNumber: order.orderNumber,
    // Only the first name: the link may be forwarded, so no other personal data is on this page.
    firstName:
      String(order.fullName || "")
        .trim()
        .split(/\s+/)[0] || "",
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: Number(order.total),
    advanceDiscount: Number(order.advanceDiscount),
    accountName: settings.accountName,
    tillId: settings.tillId,
    qrUrl: settings.qrImageUrl || DEMO_QR_PATH,
    demo,
    verificationHours: settings.verificationHours,
    whatsapp: String(info.whatsapp || "").replace(/\D/g, ""),
    refundPolicyPath: REFUND_POLICY_PATH,
    canSwitchToCod:
      order.paymentMethod === "ADVANCE_EASYPAISA" &&
      order._count.paymentProofs === 0 &&
      (SWITCHABLE as readonly string[]).includes(order.paymentStatus),
  };
}

export function registerPaymentRoutes(app: Express) {
  // Checkout: whether to offer advance payment, and its discount rule (lib/advance-payment.ts decides).
  app.get("/api/payments/advance", async (_req, res) => {
    setNoStore(res);
    const settings = await loadAdvanceSettings();
    const { available, demo } = advanceAvailability(settings);
    if (!available) return res.json({ available: false });
    const policy = advancePolicy(settings);
    res.json({ available, demo, accountName: settings.accountName, ...policy });
  });

  // Payment page data. A wrong or missing token is a plain 404, the same as an unknown order.
  app.get("/api/pay/:orderNumber", async (req, res) => {
    setNoStore(res);
    if (!(await allowRequest(req, res, "pay-page", 120, 15 * 60 * 1000))) return;
    const order = await orderByToken(req);
    if (!order || order.paymentMethod === "NAYAPAY") return res.status(404).json({ error: "NOT_FOUND" });
    res.json(await payPage(order, await loadAdvanceSettings()));
  });

  // "Pay on delivery instead": only before any proof is sent. The discount is removed and the order becomes a normal
  // COD order (on hold stays on hold for a blocklisted customer).
  app.post("/api/pay/:orderNumber/cod", async (req, res) => {
    setNoStore(res);
    if (!(await allowRequest(req, res, "pay-switch", 10, 15 * 60 * 1000))) return;
    const order = await orderByToken(req);
    if (!order || order.paymentMethod === "NAYAPAY") return res.status(404).json({ error: "NOT_FOUND" });
    const page = await payPage(order, await loadAdvanceSettings());
    if (!page.canSwitchToCod) return res.status(409).json({ error: "CANNOT_SWITCH_TO_COD" });
    const nextStatus = order.status === "ON_HOLD" && !order.blocklistedAtOrder ? "NEW" : order.status;
    const switched = await prisma.$transaction(async (tx) => {
      // Guarded update: a proof sent at the same moment wins and the switch is refused.
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentMethod: "ADVANCE_EASYPAISA",
          paymentStatus: { in: [...SWITCHABLE] },
          paymentProofs: { none: {} },
        },
        data: {
          paymentMethod: "COD",
          paymentStatus: "NOT_REQUIRED",
          advanceDiscount: 0,
          total: { increment: order.advanceDiscount },
          status: nextStatus,
        },
      });
      if (!changed.count) return false;
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: order.status,
          to: nextStatus,
          note: "Customer chose Cash on Delivery instead of advance payment (discount removed).",
        },
      });
      return true;
    });
    if (!switched) return res.status(409).json({ error: "CANNOT_SWITCH_TO_COD" });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: orderForPage });
    res.json(await payPage(fresh, await loadAdvanceSettings()));
  });
}
