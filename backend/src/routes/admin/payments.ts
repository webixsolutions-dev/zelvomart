import { createHash } from "node:crypto";
import type { Express } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../../lib/db";
import type { Prisma } from "../../generated/prisma/client";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { allowRequest, audit, routeParam, setNoStore } from "../../http/shared";
import { runInBackground } from "../../lib/background";
import { runJobsNow } from "../../lib/job-runner";
import {
  codToCollect,
  loadAdvanceSettings,
  REFUND_REASONS,
  refundableAmount,
  suggestedRefund,
  verifyOutcome,
  type RefundReason,
} from "../../lib/advance-payment";
import { transitionOrder } from "../../lib/order";
import { enqueueOrderEmails, enqueuePurchaseOnce } from "../../lib/advance-jobs";
import { normalizeTid } from "../../lib/payment-proof";
import { REJECT_REASONS, type RejectReason } from "../../lib/payment-proof";
import { paymentProofSignedUrl, readPaymentProof } from "../../lib/payment-proof-storage";
import { isCloudStorageConfigured, uploadObject } from "../../lib/storage";
import { geminiReader, prefillFrom } from "../../lib/proof-autoread";
import { SAMPLE_RECEIPT_EXPECTED, SAMPLE_RECEIPT_PNG } from "../../lib/proof-autoread-sample";

/**
 * Admin → Payments: staff check each proof against the Easypaisa merchant app. Nothing here trusts the screenshot:
 * Verify needs the merchant app's own reference, and every action is written to the audit log.
 */
const OPEN = ["SUBMITTED", "MISMATCH"] as const;
const VIEWS: Record<"needs" | "verified" | "rejected" | "all", Prisma.PaymentProofWhereInput> = {
  needs: { status: { in: [...OPEN] } },
  verified: { status: { in: ["VERIFIED", "PARTIAL"] } },
  rejected: { status: "REJECTED" },
  all: {},
};
type View = keyof typeof VIEWS;

const proofListSelect = {
  id: true,
  status: true,
  method: true,
  tid: true,
  amountSent: true,
  senderName: true,
  createdAt: true,
  amountMismatch: true,
  receiverMismatch: true,
  tidDuplicate: true,
  imageDuplicate: true,
  timeOutOfWindow: true,
  detailsMissing: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      fullName: true,
      total: true,
      status: true,
      paymentStatus: true,
    },
  },
} as const;

const flagList = (proof: {
  amountMismatch: boolean;
  receiverMismatch: boolean;
  tidDuplicate: boolean;
  imageDuplicate: boolean;
  timeOutOfWindow: boolean;
  detailsMissing: boolean;
}) =>
  [
    proof.amountMismatch && "AMOUNT",
    proof.tidDuplicate && "DUPLICATE_TID",
    proof.imageDuplicate && "DUPLICATE_IMAGE",
    proof.timeOutOfWindow && "TIME",
    proof.receiverMismatch && "RECEIVER",
    // Amber: only the screenshot came in and nothing was read from it.
    proof.detailsMissing && "DETAILS_MISSING",
  ].filter(Boolean) as string[];

/** Private staff note (never sent) and the optional message that goes into the customer's email. */
const notes = z.string().trim().max(1000).optional();
const customerMessage = z.string().trim().max(1000).optional();
const amountReceived = z.coerce
  .number({ message: "Enter the amount you found in the Easypaisa merchant app." })
  .finite()
  .positive("Enter the amount you found in the Easypaisa merchant app.")
  .max(10_000_000);
const verifySchema = z.object({
  amountReceived,
  /** Optional: prefilled with the customer's TID. Empty: the TID stays the reference. */
  merchantReference: z.string().trim().max(80).optional(),
  checked: z.literal(true, { message: "Tick the box once you have found this payment in the Easypaisa merchant app." }),
  notes,
  customerMessage,
});
const rejectSchema = z.object({
  reason: z.enum(Object.keys(REJECT_REASONS) as [RejectReason, ...RejectReason[]]),
  notes,
  customerMessage,
});
const refundSchema = z.object({
  amount: z.coerce.number().finite().positive("Enter the refund amount.").max(10_000_000),
  reason: z.enum(Object.keys(REFUND_REASONS) as [RefundReason, ...RefundReason[]], {
    message: "Choose why you are refunding.",
  }),
  reference: z.string().trim().max(80).optional(),
  notes,
  customerMessage,
  /** Default on: a refunded order is cancelled (stock goes back) unless staff untick it. */
  cancelOrder: z.boolean().default(true),
});
const convertSchema = z.object({ notes, customerMessage });

const num = (value: { toString(): string } | null | undefined) => (value == null ? null : Number(value));
const referenceKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

class ActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

const actProofSelect = {
  id: true,
  status: true,
  orderId: true,
  tid: true,
  tidNormalized: true,
  refundAmount: true,
} as const;
const actOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  total: true,
  deliveryFee: true,
  paymentMethod: true,
  paymentStatus: true,
  advanceReceived: true,
  advanceRefunded: true,
  blocklistedAtOrder: true,
} as const;
type ActProof = Prisma.PaymentProofGetPayload<{ select: typeof actProofSelect }>;
type ActOrder = Prisma.OrderGetPayload<{ select: typeof actOrderSelect }>;

/**
 * The merchant reference (or the customer's TID) used to accept another live proof, if any. One credit in the
 * merchant app can pay for one order only.
 */
async function referenceUsedElsewhere(tx: any, orderId: string, reference: string) {
  const key = referenceKey(reference);
  if (!key) return null;
  const other = await tx.paymentProof.findFirst({
    where: {
      orderId: { not: orderId },
      status: { not: "REJECTED" },
      OR: [{ tidNormalized: key }, { merchantReference: { equals: reference, mode: "insensitive" } }],
    },
    select: { order: { select: { orderNumber: true } } },
  });
  return other ? (other.order.orderNumber as string) : null;
}

/** Locks the order row, re-reads the proof and runs the change; returns the job ids to send after the answer. */
async function act(
  proofId: string,
  allowed: readonly string[],
  change: (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    proof: ActProof,
    order: ActOrder,
  ) => Promise<string[]>,
) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.paymentProof.findUnique({ where: { id: proofId }, select: { orderId: true } });
    if (!found) throw new ActionError("NOT_FOUND", "Proof not found.", 404);
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${found.orderId} FOR UPDATE`;
    const proof = await tx.paymentProof.findUniqueOrThrow({ where: { id: proofId }, select: actProofSelect });
    if (!allowed.includes(proof.status))
      throw new ActionError(
        "PROOF_STATE_CHANGED",
        `This proof is already ${proof.status.toLowerCase()}. Reload the page.`,
      );
    const order = await tx.order.findUniqueOrThrow({ where: { id: proof.orderId }, select: actOrderSelect });
    if (order.paymentMethod !== "ADVANCE_EASYPAISA")
      throw new ActionError("NOT_ADVANCE", "This order is no longer an advance-payment order.");
    return change(tx, proof, order);
  });
}

/** Once one proof is accepted, the order's other open proofs are closed (no email: the customer is already paid up). */
async function closeOtherOpenProofs(tx: any, orderId: string, keepId: string, userId?: string) {
  const others = await tx.paymentProof.findMany({
    where: { orderId, id: { not: keepId }, status: { in: [...OPEN] } },
    select: { id: true },
  });
  if (!others.length) return;
  await tx.paymentProof.updateMany({
    where: { id: { in: others.map((o: { id: string }) => o.id) } },
    data: {
      status: "REJECTED",
      rejectReason: "OTHER",
      notes: "Closed automatically: another proof for this order was accepted.",
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
}

/** On hold only because of the payment → New, so it enters the normal order flow (a blocklisted order stays on hold). */
const releasedStatus = (order: { status: string; blocklistedAtOrder: boolean }) =>
  order.status === "ON_HOLD" && !order.blocklistedAtOrder ? "NEW" : order.status;

const proofImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
const QR_TYPES: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp" };

export function registerAdminPaymentsRoutes(app: Express) {
  // Counts for the sidebar and tabs: open proofs, and how many of them carry a flag.
  app.get("/api/admin/payments/summary", requireAuth("orders.read"), async (_req, res) => {
    setNoStore(res);
    const open = await prisma.paymentProof.findMany({
      where: { status: { in: [...OPEN] } },
      select: proofListSelect,
    });
    res.json({ needs: open.length, flagged: open.filter((proof) => flagList(proof).length).length });
  });

  app.get("/api/admin/payments", requireAuth("orders.read"), async (req, res) => {
    setNoStore(res);
    const view =
      (String(req.query.view || "needs") as View) in VIEWS ? (String(req.query.view || "needs") as View) : "needs";
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 60);
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const where: Prisma.PaymentProofWhereInput = {
      ...VIEWS[view],
      ...(q
        ? {
            OR: [
              { tid: { contains: q, mode: "insensitive" as const } },
              { senderName: { contains: q, mode: "insensitive" as const } },
              { order: { orderNumber: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      prisma.paymentProof.findMany({
        where,
        orderBy: { createdAt: view === "needs" ? "asc" : "desc" },
        skip: (page - 1) * 50,
        take: 50,
        select: proofListSelect,
      }),
      prisma.paymentProof.count({ where }),
      prisma.paymentProof.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const count = (statuses: string[]) =>
      counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count._all, 0);
    res.json({
      view,
      page,
      total,
      counts: {
        needs: count([...OPEN]),
        verified: count(["VERIFIED", "PARTIAL"]),
        rejected: count(["REJECTED"]),
        all: count(["SUBMITTED", "MISMATCH", "VERIFIED", "PARTIAL", "REJECTED"]),
      },
      rows: rows.map((row) => ({
        ...row,
        amountSent: num(row.amountSent),
        flags: flagList(row),
        order: { ...row.order, total: Number(row.order.total) },
      })),
    });
  });

  app.get("/api/admin/payments/:id", requireAuth("orders.read"), async (req, res) => {
    setNoStore(res);
    const proof = await prisma.paymentProof.findUnique({ where: { id: routeParam(req, "id") } });
    if (!proof) return res.status(404).json({ error: "NOT_FOUND" });
    const [order, others, settings] = await Promise.all([
      prisma.order.findUniqueOrThrow({
        where: { id: proof.orderId },
        select: {
          id: true,
          orderNumber: true,
          fullName: true,
          phone: true,
          city: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          total: true,
          deliveryFee: true,
          advanceDiscount: true,
          advanceReceived: true,
          advanceRefunded: true,
          createdAt: true,
          paymentVerifiedAt: true,
          statusHistory: { select: { to: true } },
        },
      }),
      prisma.paymentProof.findMany({
        where: { orderId: proof.orderId, id: { not: proof.id } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, amountSent: true, amountReceived: true, createdAt: true },
      }),
      loadAdvanceSettings(),
    ]);
    // Only staff names (never whole user rows).
    const staffIds = [proof.reviewedById, proof.refundedById].filter(Boolean) as string[];
    const staff = staffIds.length
      ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
      : [];
    const name = (id: string | null) => (id ? staff.find((user) => user.id === id)?.name || "Staff" : null);
    const signed = proof.screenshotKey ? await paymentProofSignedUrl(proof.screenshotKey).catch(() => null) : null;
    const history = await prisma.auditLog.findMany({
      where: { entity: "PaymentProof", entityId: proof.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, createdAt: true, details: true, user: { select: { name: true } } },
    });
    res.json({
      proof: {
        id: proof.id,
        status: proof.status,
        method: proof.method,
        tid: proof.tid,
        amountSent: num(proof.amountSent),
        amountReceived: num(proof.amountReceived),
        detailsFromAutoRead: proof.detailsFromAutoRead,
        detailsMissing: proof.detailsMissing,
        senderName: proof.senderName,
        senderLast4: proof.senderLast4,
        paidAt: proof.paidAt,
        createdAt: proof.createdAt,
        flags: flagList(proof),
        ocr: proof.ocrJson
          ? {
              tid: proof.ocrTid,
              amount: proof.ocrAmount === null ? null : Number(proof.ocrAmount),
              dateTime: proof.ocrDateTime,
              sender: proof.ocrSender,
              receiver: proof.ocrReceiver,
              confidence: proof.ocrConfidence,
            }
          : null,
        merchantReference: proof.merchantReference,
        rejectReason: proof.rejectReason,
        notes: proof.notes,
        reviewedBy: name(proof.reviewedById),
        reviewedAt: proof.reviewedAt,
        refundAmount: num(proof.refundAmount),
        refundReference: proof.refundReference,
        refundReason: proof.refundReason,
        refundedBy: name(proof.refundedById),
        refundedAt: proof.refundedAt,
        // A 5-minute signed link to the private file, or the same-origin image route when no bucket is set (local).
        // Null: the customer sent only the TID and amount.
        imageUrl: proof.screenshotKey ? signed || `/api/admin/payments/${proof.id}/image` : null,
        imageIsSigned: !!signed,
      },
      order: {
        ...order,
        total: Number(order.total),
        deliveryFee: Number(order.deliveryFee),
        advanceDiscount: Number(order.advanceDiscount),
        advanceReceived: Number(order.advanceReceived),
        advanceRefunded: Number(order.advanceRefunded),
        codToCollect: codToCollect(order),
        refundable: refundableAmount(order),
      },
      expected: { amount: Number(order.total), accountName: settings.accountName, tillId: settings.tillId },
      otherProofs: others.map((other) => ({
        ...other,
        amountSent: num(other.amountSent),
        amountReceived: num(other.amountReceived),
      })),
      rejectReasons: REJECT_REASONS,
      refundReasons: REFUND_REASONS,
      refundSuggestions: Object.fromEntries(
        (Object.keys(REFUND_REASONS) as RefundReason[]).map((reason) => [
          reason,
          suggestedRefund(reason, {
            ...order,
            dispatched: order.statusHistory.some((entry) =>
              ["IN_TRANSIT", "DELIVERED", "SETTLED", "RETURNED"].includes(entry.to),
            ),
          }),
        ]),
      ),
      history: history.map((entry) => ({ ...entry, user: entry.user?.name || null })),
    });
  });

  app.get("/api/admin/payments/:id/image", requireAuth("orders.read"), async (req, res) => {
    const proof = await prisma.paymentProof.findUnique({
      where: { id: routeParam(req, "id") },
      select: { screenshotKey: true },
    });
    if (!proof) return res.status(404).json({ error: "NOT_FOUND" });
    try {
      if (!proof.screenshotKey) return res.status(404).json({ error: "NO_SCREENSHOT" });
      const bytes = await readPaymentProof(proof.screenshotKey);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(bytes);
    } catch {
      res.status(404).json({ error: "PROOF_FILE_MISSING" });
    }
  });

  const run = (handler: (req: AuthedRequest) => Promise<{ jobIds: string[] }>) => async (req: any, res: any) => {
    setNoStore(res);
    try {
      const { jobIds } = await handler(req);
      if (jobIds.length) runInBackground("advance payment email", () => runJobsNow(jobIds));
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: "INVALID", message: error.issues[0]?.message || "Check the form." });
      if (error instanceof ActionError)
        return res.status(error.status).json({ error: error.code, message: error.message });
      throw error;
    }
  };
  const emailJob = (
    tx: any,
    name: string,
    orderId: string,
    proofId: string,
    message?: string,
    extra: Record<string, unknown> = {},
  ) =>
    tx.job
      .create({
        data: { name, orderId, payload: { orderId, proofId, ...(message ? { message } : {}), ...extra } },
        select: { id: true },
      })
      .then((job: { id: string }) => job.id);

  // Verify: staff found the payment in the Easypaisa merchant app and type the amount that arrived. The full amount
  // (or more) verifies; less is saved as a partial and the rest is collected in cash on delivery. Either way the
  // order goes ahead (On hold → New). `/partial` is the same action, kept for older admin pages.
  const verify = run(async (req) => {
    const body = verifySchema.parse(req.body || {});
    const jobIds = await act(routeParam(req, "id"), OPEN, async (tx, proof, order) => {
      const received = Math.round(body.amountReceived * 100) / 100;
      const outcome = verifyOutcome(received, order.total);
      if (req.path.endsWith("/partial") && outcome !== "PARTIAL")
        throw new ActionError("NOT_PARTIAL", "That is the full amount: use Verify instead.", 400);
      // The staff reference becomes the TID when the customer sent only a screenshot.
      const reference = body.merchantReference || proof.tid || "";
      const usedOn = reference ? await referenceUsedElsewhere(tx, order.id, reference) : null;
      if (usedOn)
        throw new ActionError(
          "DUPLICATE_REFERENCE",
          `This reference is already used on order ${usedOn}. One payment can pay for one order only.`,
        );
      const now = new Date();
      // First: the order's other open proofs are closed, so a TID written below never clashes with one of them.
      await closeOtherOpenProofs(tx, order.id, proof.id, req.admin?.id);
      await tx.paymentProof.update({
        where: { id: proof.id },
        data: {
          status: outcome,
          amountReceived: received,
          merchantReference: body.merchantReference || null,
          ...(!proof.tid && reference ? { tid: reference, tidNormalized: referenceKey(reference) || null } : {}),
          notes: body.notes || null,
          reviewedById: req.admin?.id,
          reviewedAt: now,
        },
      });
      const next = releasedStatus(order);
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: outcome === "VERIFIED" ? "VERIFIED" : "MISMATCH",
          advanceReceived: received,
          paymentVerifiedAt: now,
          paymentVerifiedById: req.admin?.id,
          status: next as never,
        },
      });
      const collect = codToCollect({ ...order, advanceReceived: received });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: order.status as never,
          to: next as never,
          userId: req.admin?.id,
          note:
            outcome === "VERIFIED"
              ? `Advance payment of Rs ${received} verified in the Easypaisa merchant app.`
              : `Partial advance payment of Rs ${received} verified; Rs ${collect} is collected on delivery.`,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.admin?.id,
          action: outcome === "VERIFIED" ? "payment_verify" : "payment_partial",
          entity: "PaymentProof",
          entityId: proof.id,
          details: {
            orderId: order.id,
            amountReceived: received,
            merchantReference: body.merchantReference || null,
            checkedInMerchantApp: true,
          },
        },
      });
      // One confirmation: the order email ("Paid in advance, nothing to pay on delivery", or the balance for a
      // partial) and the team's new-order email marked Advance paid.
      return enqueueOrderEmails(tx, order.id, "advance-paid", body.customerMessage);
    });
    return { jobIds };
  });
  app.post("/api/admin/payments/:id/verify", requireAuth("orders.write"), verify);
  app.post("/api/admin/payments/:id/partial", requireAuth("orders.write"), verify);

  // Reject: the payment is not in the merchant app (or another reason). The order stays on hold; the customer may
  // send one corrected proof.
  app.post(
    "/api/admin/payments/:id/reject",
    requireAuth("orders.write"),
    run(async (req) => {
      const body = rejectSchema.parse(req.body || {});
      const jobIds = await act(routeParam(req, "id"), OPEN, async (tx, proof, order) => {
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: "REJECTED",
            rejectReason: body.reason,
            notes: body.notes || null,
            reviewedById: req.admin?.id,
            reviewedAt: new Date(),
          },
        });
        if (order.paymentStatus !== "VERIFIED")
          await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "REJECTED" } });
        await tx.auditLog.create({
          data: {
            userId: req.admin?.id,
            action: "payment_reject",
            entity: "PaymentProof",
            entityId: proof.id,
            details: { orderId: order.id, reason: body.reason },
          },
        });
        return [await emailJob(tx, "advance-issue-email", order.id, proof.id, body.customerMessage)];
      });
      return { jobIds };
    }),
  );

  // Refund recorded: staff already sent the money back from the merchant app; this records it. Never more than
  // received − earlier refunds. The order is cancelled by default (stock goes back; nothing is booked or collected);
  // if staff keep it, the courier collects the refunded amount again on delivery.
  app.post(
    "/api/admin/payments/:id/refund",
    requireAuth("orders.write"),
    run(async (req) => {
      const body = refundSchema.parse(req.body || {});
      let cancel: { orderId: string; from: string } | null = null;
      const jobIds = await act(routeParam(req, "id"), ["VERIFIED", "PARTIAL"], async (tx, proof, order) => {
        const amount = Math.round(body.amount * 100) / 100;
        const refundable = refundableAmount(order);
        if (amount > refundable)
          throw new ActionError(
            "REFUND_TOO_HIGH",
            refundable > 0
              ? `You can refund at most Rs ${refundable} (received minus earlier refunds).`
              : "Nothing is left to refund on this order.",
            400,
          );
        const now = new Date();
        const refundedTotal = Number(order.advanceRefunded) + amount;
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            refundAmount: Number(proof.refundAmount || 0) + amount,
            refundReference: body.reference || null,
            refundReason: body.reason,
            refundedById: req.admin?.id,
            refundedAt: now,
            ...(body.notes ? { notes: body.notes } : {}),
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            advanceRefunded: refundedTotal,
            // Everything received is back: REFUNDED. A part (e.g. an overpayment) keeps the payment status.
            ...(refundedTotal >= Number(order.advanceReceived) ? { paymentStatus: "REFUNDED" } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.admin?.id,
            action: "payment_refund",
            entity: "PaymentProof",
            entityId: proof.id,
            details: {
              orderId: order.id,
              amount,
              reason: body.reason,
              reference: body.reference || null,
              cancelOrder: body.cancelOrder,
            },
          },
        });
        if (body.cancelOrder && !["CANCELLED", "RETURNED"].includes(order.status))
          cancel = { orderId: order.id, from: order.status };
        return [
          await emailJob(tx, "advance-refund-email", order.id, proof.id, body.customerMessage, {
            amount,
            reason: body.reason,
            refundedAt: now.getTime(),
          }),
        ];
      });
      // Cancelling uses the normal order transition (stock back, history); it runs before the email is sent.
      if (cancel) {
        const { orderId, from } = cancel as { orderId: string; from: string };
        await transitionOrder(
          orderId,
          "CANCELLED",
          req.admin?.id,
          `Advance payment refunded: ${REFUND_REASONS[body.reason]}.`,
        );
        await audit(req, "status_change", "Order", orderId, { from, to: "CANCELLED", reason: "advance_refund" });
      }
      return { jobIds };
    }),
  );

  // Staff convert an unpaid advance order to Cash on Delivery (the customer called, or never paid). Only while
  // nothing has been accepted; the advance discount is removed, open proofs are closed, the normal COD flow follows.
  app.post(
    "/api/admin/orders/:id/convert-to-cod",
    requireAuth("orders.write"),
    run(async (req) => {
      const body = convertSchema.parse(req.body || {});
      const orderId = routeParam(req, "id");
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { ...actOrderSelect, advanceDiscount: true, test: true, staffCreated: true },
        });
        if (!order) throw new ActionError("NOT_FOUND", "Order not found.", 404);
        if (order.paymentMethod !== "ADVANCE_EASYPAISA")
          throw new ActionError("NOT_ADVANCE", "This order is not an advance-payment order.");
        if (Number(order.advanceReceived) > 0 || ["VERIFIED", "REFUNDED"].includes(order.paymentStatus))
          throw new ActionError(
            "ADVANCE_ALREADY_ACCEPTED",
            "A payment was already accepted on this order. Record a refund instead of converting it.",
          );
        const next = releasedStatus(order);
        const total = Number(order.total) + Number(order.advanceDiscount);
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: "COD",
            paymentStatus: "NOT_REQUIRED",
            advanceDiscount: 0,
            total,
            status: next as never,
          },
        });
        const open = await tx.paymentProof.updateMany({
          where: { orderId: order.id, status: { in: [...OPEN] } },
          data: {
            status: "REJECTED",
            rejectReason: "OTHER",
            notes: "Closed: staff converted the order to Cash on Delivery.",
            reviewedById: req.admin?.id,
            reviewedAt: new Date(),
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: order.status as never,
            to: next as never,
            userId: req.admin?.id,
            note: `Converted to Cash on Delivery by staff (advance discount removed; Rs ${total} collected on delivery).${body.notes ? ` ${body.notes}` : ""}`,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.admin?.id,
            action: "payment_convert_cod",
            entity: "Order",
            entityId: order.id,
            details: { total, discountRemoved: Number(order.advanceDiscount), proofsClosed: open.count },
          },
        });
        // Now a normal COD order: the COD emails, and the Purchase event if no proof sent it already.
        return [
          ...(await enqueueOrderEmails(tx, order.id, "cod-switch", body.customerMessage)),
          ...(await enqueuePurchaseOnce(tx, order)),
        ];
      });
      return { jobIds: result };
    }),
  );

  // Test the configured Gemini key with fictional data, even while customer auto-read is switched off.
  app.post("/api/admin/payments/auto-read/test", requireAuth("settings.write"), async (req: AuthedRequest, res) => {
    setNoStore(res);
    if (!(await allowRequest(req, res, "payment-auto-read-test", 5, 60_000, req.admin?.id))) return;
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key)
      return res.status(503).json({
        error: "KEY_NOT_CONFIGURED",
        message: "GEMINI_API_KEY is missing from the backend deployment.",
      });

    const attempt = await geminiReader(key).readWithDiagnostics(SAMPLE_RECEIPT_PNG, "image/png");
    if ("failure" in attempt)
      return res.status(502).json({
        error: attempt.failure.status,
        ...attempt.failure,
      });

    const prefill = prefillFrom(attempt.result);
    const matches =
      prefill?.tid === SAMPLE_RECEIPT_EXPECTED.tid &&
      prefill.amount === SAMPLE_RECEIPT_EXPECTED.amount &&
      prefill.sender?.toLowerCase() === SAMPLE_RECEIPT_EXPECTED.sender.toLowerCase();
    if (!matches)
      return res.status(502).json({
        error: "SAMPLE_READ_INCOMPLETE",
        model: attempt.model,
        message: "Gemini responded but could not read all three sample receipt fields correctly.",
        prefill,
      });
    res.json({ model: attempt.model, prefill });
  });

  // Settings → Payments: the merchant Raast QR is stored exactly as uploaded (no re-encode, crop or resize), so it
  // stays scannable. Public media bucket: it is shown to every customer on the payment page.
  app.post(
    "/api/admin/payments/qr",
    requireAuth("settings.write"),
    (req, res, next) =>
      proofImage.single("file")(req, res, (error: unknown) =>
        error
          ? res.status(400).json({ error: "UPLOAD_FAILED", message: "Upload one PNG, JPG or WebP up to 4 MB." })
          : next(),
      ),
    async (req: any, res) => {
      setNoStore(res);
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "FILE_REQUIRED", message: "Choose the QR image." });
      const meta = await sharp(file.buffer)
        .metadata()
        .catch(() => null);
      const ext = meta?.format ? QR_TYPES[meta.format] : undefined;
      if (!ext || !meta?.width || !meta.height)
        return res.status(400).json({ error: "IMAGE_REQUIRED", message: "Upload a PNG, JPG or WebP image." });
      if (Math.min(meta.width, meta.height) < 300)
        return res.status(400).json({
          error: "QR_TOO_SMALL",
          message: "This image is too small to scan. Upload the original QR (300 px or more).",
        });
      if (!isCloudStorageConfigured())
        return res
          .status(503)
          .json({ error: "STORAGE_NOT_CONFIGURED", message: "Media storage (R2) is not configured." });
      const hash = createHash("sha256").update(file.buffer).digest("hex").slice(0, 24);
      const url = await uploadObject(`payments/raast-qr-${hash}.${ext}`, file.buffer, `image/${meta.format}`);
      await audit(req, "payment_qr_upload", "Setting", "payments.advance", { url });
      res.json({ url, width: meta.width, height: meta.height });
    },
  );
}
