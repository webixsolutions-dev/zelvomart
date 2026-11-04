import { createHash } from "node:crypto";
import type { Express } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../../lib/db";
import type { Prisma } from "../../generated/prisma/client";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { audit, routeParam, setNoStore } from "../../http/shared";
import { runInBackground } from "../../lib/background";
import { runJobsNow } from "../../lib/job-runner";
import { codToCollect, loadAdvanceSettings } from "../../lib/advance-payment";
import { REJECT_REASONS, type RejectReason } from "../../lib/payment-proof";
import { paymentProofSignedUrl, readPaymentProof } from "../../lib/payment-proof-storage";
import { isCloudStorageConfigured, uploadObject } from "../../lib/storage";

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
}) =>
  [
    proof.amountMismatch && "AMOUNT",
    proof.tidDuplicate && "DUPLICATE_TID",
    proof.imageDuplicate && "DUPLICATE_IMAGE",
    proof.timeOutOfWindow && "TIME",
    proof.receiverMismatch && "RECEIVER",
  ].filter(Boolean) as string[];

const reference = z.string().trim().min(4, "Enter the reference from the Easypaisa merchant app.").max(80);
const notes = z.string().trim().max(1000).optional();
const verifySchema = z.object({ merchantReference: reference, notes });
const partialSchema = z.object({
  merchantReference: reference,
  amountReceived: z.coerce.number().finite().positive().max(10_000_000),
  notes,
});
const rejectSchema = z.object({
  reason: z.enum(Object.keys(REJECT_REASONS) as [RejectReason, ...RejectReason[]]),
  notes,
});
const refundSchema = z.object({
  amount: z.coerce.number().finite().positive().max(10_000_000),
  reference: z.string().trim().min(3).max(80),
  notes,
});

class ActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

/** Locks the order row, re-reads the proof and runs the change; returns the job ids to send after the answer. */
async function act(
  proofId: string,
  allowed: readonly string[],
  change: (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    proof: { id: string; status: string; orderId: string },
    order: {
      id: string;
      status: string;
      total: unknown;
      paymentMethod: string;
      paymentStatus: string;
      blocklistedAtOrder: boolean;
    },
  ) => Promise<string[]>,
) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.paymentProof.findUnique({ where: { id: proofId }, select: { orderId: true } });
    if (!found) throw new ActionError("NOT_FOUND", "Proof not found.", 404);
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${found.orderId} FOR UPDATE`;
    const proof = await tx.paymentProof.findUniqueOrThrow({
      where: { id: proofId },
      select: { id: true, status: true, orderId: true },
    });
    if (!allowed.includes(proof.status))
      throw new ActionError(
        "PROOF_STATE_CHANGED",
        `This proof is already ${proof.status.toLowerCase()}. Reload the page.`,
      );
    const order = await tx.order.findUniqueOrThrow({
      where: { id: proof.orderId },
      select: {
        id: true,
        status: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        blocklistedAtOrder: true,
      },
    });
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
        amountSent: Number(row.amountSent),
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
          advanceDiscount: true,
          advanceReceived: true,
          createdAt: true,
          paymentVerifiedAt: true,
        },
      }),
      prisma.paymentProof.findMany({
        where: { orderId: proof.orderId, id: { not: proof.id } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, amountSent: true, createdAt: true },
      }),
      loadAdvanceSettings(),
    ]);
    // Only staff names (never whole user rows).
    const staffIds = [proof.reviewedById, proof.refundedById].filter(Boolean) as string[];
    const staff = staffIds.length
      ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
      : [];
    const name = (id: string | null) => (id ? staff.find((user) => user.id === id)?.name || "Staff" : null);
    const signed = await paymentProofSignedUrl(proof.screenshotKey).catch(() => null);
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
        amountSent: Number(proof.amountSent),
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
        refundAmount: proof.refundAmount === null ? null : Number(proof.refundAmount),
        refundReference: proof.refundReference,
        refundedBy: name(proof.refundedById),
        refundedAt: proof.refundedAt,
        // A 5-minute signed link to the private file, or the same-origin image route when no bucket is set (local).
        imageUrl: signed || `/api/admin/payments/${proof.id}/image`,
        imageIsSigned: !!signed,
      },
      order: {
        ...order,
        total: Number(order.total),
        advanceDiscount: Number(order.advanceDiscount),
        advanceReceived: Number(order.advanceReceived),
        codToCollect: codToCollect(order),
      },
      expected: { amount: Number(order.total), accountName: settings.accountName, tillId: settings.tillId },
      otherProofs: others.map((other) => ({ ...other, amountSent: Number(other.amountSent) })),
      rejectReasons: REJECT_REASONS,
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
  const emailJob = (tx: any, name: string, orderId: string, proofId: string) =>
    tx.job
      .create({ data: { name, orderId, payload: { orderId, proofId } }, select: { id: true } })
      .then((job: { id: string }) => job.id);

  // Verify: staff found the full amount in the Easypaisa merchant app. Order → New, nothing to collect on delivery.
  app.post(
    "/api/admin/payments/:id/verify",
    requireAuth("orders.write"),
    run(async (req) => {
      const body = verifySchema.parse(req.body || {});
      const proofId = routeParam(req, "id");
      const jobIds = await act(proofId, OPEN, async (tx, proof, order) => {
        const now = new Date();
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: "VERIFIED",
            merchantReference: body.merchantReference,
            notes: body.notes || null,
            reviewedById: req.admin?.id,
            reviewedAt: now,
          },
        });
        const next = releasedStatus(order);
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "VERIFIED",
            advanceReceived: order.total as never,
            paymentVerifiedAt: now,
            paymentVerifiedById: req.admin?.id,
            status: next as never,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: order.status as never,
            to: next as never,
            userId: req.admin?.id,
            note: "Advance payment verified in the Easypaisa merchant app.",
          },
        });
        await closeOtherOpenProofs(tx, order.id, proof.id, req.admin?.id);
        await tx.auditLog.create({
          data: {
            userId: req.admin?.id,
            action: "payment_verify",
            entity: "PaymentProof",
            entityId: proof.id,
            details: { orderId: order.id, merchantReference: body.merchantReference },
          },
        });
        return [await emailJob(tx, "advance-verified-email", order.id, proof.id)];
      });
      return { jobIds };
    }),
  );

  // Partial: less arrived than the total. The rest is collected in cash on delivery; the order goes ahead.
  app.post(
    "/api/admin/payments/:id/partial",
    requireAuth("orders.write"),
    run(async (req) => {
      const body = partialSchema.parse(req.body || {});
      const jobIds = await act(routeParam(req, "id"), OPEN, async (tx, proof, order) => {
        if (body.amountReceived >= Number(order.total))
          throw new ActionError("NOT_PARTIAL", "That is the full amount: use Verify instead.", 400);
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: "PARTIAL",
            merchantReference: body.merchantReference,
            notes: body.notes || null,
            reviewedById: req.admin?.id,
            reviewedAt: new Date(),
          },
        });
        const next = releasedStatus(order);
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "MISMATCH", advanceReceived: body.amountReceived, status: next as never },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: order.status as never,
            to: next as never,
            userId: req.admin?.id,
            note: `Partial advance payment of Rs ${body.amountReceived} verified; the rest is collected on delivery.`,
          },
        });
        await closeOtherOpenProofs(tx, order.id, proof.id, req.admin?.id);
        await tx.auditLog.create({
          data: {
            userId: req.admin?.id,
            action: "payment_partial",
            entity: "PaymentProof",
            entityId: proof.id,
            details: {
              orderId: order.id,
              amountReceived: body.amountReceived,
              merchantReference: body.merchantReference,
            },
          },
        });
        return [await emailJob(tx, "advance-issue-email", order.id, proof.id)];
      });
      return { jobIds };
    }),
  );

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
        return [await emailJob(tx, "advance-issue-email", order.id, proof.id)];
      });
      return { jobIds };
    }),
  );

  // Refund recorded: staff already sent the money back from the merchant app; this only records it.
  app.post(
    "/api/admin/payments/:id/refund",
    requireAuth("orders.write"),
    run(async (req) => {
      const body = refundSchema.parse(req.body || {});
      await act(routeParam(req, "id"), ["VERIFIED", "PARTIAL"], async (tx, proof, order) => {
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            refundAmount: body.amount,
            refundReference: body.reference,
            refundedById: req.admin?.id,
            refundedAt: new Date(),
            ...(body.notes ? { notes: body.notes } : {}),
          },
        });
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });
        await tx.auditLog.create({
          data: {
            userId: req.admin?.id,
            action: "payment_refund",
            entity: "PaymentProof",
            entityId: proof.id,
            details: { orderId: order.id, amount: body.amount, reference: body.reference },
          },
        });
        return [];
      });
      return { jobIds: [] };
    }),
  );

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
