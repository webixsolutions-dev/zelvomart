import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { prisma } from "../lib/db";
import { getSetting } from "../lib/settings";
import { requestIp } from "../lib/rate-limit";
import { runJobsNow } from "../lib/job-runner";
import { runInBackground } from "../lib/background";
import { allowRequest, allowRules, routeParam, setNoStore } from "../http/shared";
import {
  canSubmitProof,
  cleanProofImage,
  differenceHash,
  hammingDistance,
  NEAR_DUPLICATE_DISTANCE,
  normalizeTid,
  PROOF_MAX_BYTES,
  PROOF_MAX_PER_ORDER,
  ProofImageError,
  PROOF_NEEDS_SCREENSHOT_OR_DETAILS,
  proofFieldsSchema,
  proofFlags,
  proofHasEnough,
  REJECT_REASONS,
  sha256Hex,
  type RejectReason,
} from "../lib/payment-proof";
import { paymentProofStorageReady, storePaymentProof } from "../lib/payment-proof-storage";
import { autoReader, prefillFrom } from "../lib/proof-autoread";
import { enqueueOrderEmails, enqueuePurchaseOnce } from "../lib/advance-jobs";
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
  test: true,
  staffCreated: true,
  subtotal: true,
  bundleSaving: true,
  deliveryFee: true,
  couponDiscount: true,
  advanceDiscount: true,
  advanceReceived: true,
  total: true,
  createdAt: true,
  _count: { select: { paymentProofs: true } },
  // Only what the customer may see about their own latest proof (no TID, no screenshot, no staff notes).
  paymentProofs: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true, amountSent: true, createdAt: true, rejectReason: true },
  },
} as const;

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PROOF_MAX_BYTES, files: 1, fields: 10, fieldSize: 2000 },
}).single("screenshot");

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
  const latest = order.paymentProofs[0];
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
    canSubmitProof: canSubmitProof(order, order._count.paymentProofs),
    // Auto-read prefill on the proof form (Settings switch + GEMINI_API_KEY); a hint only.
    autoRead: !!autoReader(settings),
    proofsLeft: Math.max(0, PROOF_MAX_PER_ORDER - order._count.paymentProofs),
    proof: latest
      ? {
          status: latest.status,
          amountSent: latest.amountSent == null ? null : Number(latest.amountSent),
          submittedAt: latest.createdAt.toISOString(),
          rejectMessage:
            latest.status === "REJECTED"
              ? REJECT_REASONS[(latest.rejectReason as RejectReason) || "OTHER"] || REJECT_REASONS.OTHER
              : null,
        }
      : null,
  };
}

/** multer with a JSON answer for a too-large or extra file (instead of Express's HTML error page). */
function parseProofUpload(req: Request, res: Response, next: NextFunction) {
  proofUpload(req, res, (error: unknown) => {
    if (!error) return next();
    const code = (error as { code?: string }).code;
    res.status(code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: code === "LIMIT_FILE_SIZE" ? "PROOF_TOO_LARGE" : "PROOF_UPLOAD_INVALID",
      message: code === "LIMIT_FILE_SIZE" ? "The screenshot must be up to 5 MB." : "Send one screenshot with the form.",
    });
  });
}

/** Exact (SHA-256) or near (dHash) copy of a screenshot already sent for any order in the last 180 days. */
async function screenshotSeenBefore(sha256: string, dhash: string) {
  if (await prisma.paymentProof.findFirst({ where: { sha256 }, select: { id: true } })) return true;
  const recent = await prisma.paymentProof.findMany({
    where: { dhash: { not: null }, createdAt: { gte: new Date(Date.now() - 180 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { dhash: true },
  });
  return recent.some((row) => hammingDistance(row.dhash!, dhash) <= NEAR_DUPLICATE_DISTANCE);
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

  // Auto-read prefill: the customer picks a screenshot and the form fills in what was read. Nothing is stored here;
  // the image is cleaned (metadata removed) before it is sent. Off unless the switch is on and a key is set.
  app.post("/api/pay/:orderNumber/proof/read", async (req, res, next) => {
    setNoStore(res);
    const orderNumber = routeParam(req, "orderNumber").toUpperCase().slice(0, 40);
    if (
      !(await allowRules(res, [
        { key: `pay-read:ip:${requestIp(req)}`, limit: 10, windowMs: 15 * 60 * 1000 },
        { key: `pay-read:order:${orderNumber}`, limit: 8, windowMs: 60 * 60 * 1000 },
      ]))
    )
      return;
    next();
  });
  app.post("/api/pay/:orderNumber/proof/read", parseProofUpload, async (req, res) => {
    const order = await orderByToken(req);
    if (!order || order.paymentMethod === "NAYAPAY") return res.status(404).json({ error: "NOT_FOUND" });
    const reader = autoReader(await loadAdvanceSettings());
    if (!reader || !canSubmitProof(order, order._count.paymentProofs)) return res.json({ prefill: null });
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) return res.json({ prefill: null });
    try {
      const image = await cleanProofImage(file.buffer);
      res.json({ prefill: prefillFrom(await reader.read(image.bytes, image.contentType)) });
    } catch {
      res.json({ prefill: null });
    }
  });

  // Payment proof: screenshot (re-encoded, metadata removed, private storage), TID, amount, sender. It never marks
  // a payment as paid: the order waits On hold until staff find the credit in the Easypaisa merchant app.
  app.post("/api/pay/:orderNumber/proof", async (req, res, next) => {
    setNoStore(res);
    const orderNumber = routeParam(req, "orderNumber").toUpperCase().slice(0, 40);
    if (
      !(await allowRules(res, [
        { key: `pay-proof:ip:${requestIp(req)}`, limit: 10, windowMs: 15 * 60 * 1000 },
        { key: `pay-proof:order:${orderNumber}`, limit: 12, windowMs: 60 * 60 * 1000 },
      ]))
    )
      return;
    next();
  });
  app.post("/api/pay/:orderNumber/proof", parseProofUpload, async (req, res) => {
    const order = await orderByToken(req);
    if (!order || order.paymentMethod === "NAYAPAY") return res.status(404).json({ error: "NOT_FOUND" });
    if (!canSubmitProof(order, order._count.paymentProofs))
      return res
        .status(409)
        .json({ error: "PROOF_NOT_ACCEPTED", message: "A payment proof is not needed for this order now." });
    const fields = proofFieldsSchema.safeParse(req.body || {});
    if (!fields.success)
      return res
        .status(400)
        .json({ error: "PROOF_FIELDS_INVALID", message: fields.error.issues[0]?.message || "Check the form." });
    const file = (req as Request & { file?: Express.Multer.File }).file;
    // A screenshot alone is enough, or the TID + amount without one (owner decision; same rule as the form).
    if (!proofHasEnough(!!file, fields.data))
      return res.status(400).json({ error: "PROOF_SCREENSHOT_OR_DETAILS", message: PROOF_NEEDS_SCREENSHOT_OR_DETAILS });
    if (file && !paymentProofStorageReady())
      return res
        .status(503)
        .json({ error: "PROOF_STORAGE_NOT_CONFIGURED", message: "Please send your proof on WhatsApp." });

    let image: Awaited<ReturnType<typeof cleanProofImage>> | null = null;
    if (file)
      try {
        image = await cleanProofImage(file.buffer);
      } catch (error) {
        if (error instanceof ProofImageError)
          return res.status(400).json({ error: "PROOF_IMAGE_INVALID", message: error.message });
        throw error;
      }
    const sha256 = image ? sha256Hex(image.bytes) : null;
    const dhash = image ? await differenceHash(image.bytes) : null;
    const tidNormalized = fields.data.tid ? normalizeTid(fields.data.tid) : null;
    const sameTid = tidNormalized
      ? await prisma.paymentProof.findMany({ where: { tidNormalized }, select: { orderId: true, status: true } })
      : [];
    // Another order already used this TID (whatever happened to it): flag it. The partial unique index only
    // covers live proofs, so a second live use is stored without tidNormalized.
    let tidDuplicate = sameTid.some((row) => row.orderId !== order.id);
    let tidTaken = sameTid.some((row) => row.status !== "REJECTED");
    const imageDuplicate = sha256 && dhash ? await screenshotSeenBefore(sha256, dhash) : false;
    const flags = proofFlags({
      amountSent: fields.data.amount ?? null,
      expected: Number(order.total),
      paidAt: fields.data.paidAt,
      orderCreatedAt: order.createdAt,
      tidDuplicate,
      imageDuplicate,
    });
    const screenshotKey = image ? await storePaymentProof(order.orderNumber, image.bytes) : null;
    // Only the screenshot: auto-read fills the TID and amount (proof-autoread-job.ts); until then staff see
    // "details missing, check the screenshot".
    const detailsMissing = !fields.data.tid || fields.data.amount == null;
    const autoRead = !!screenshotKey && !!autoReader(await loadAdvanceSettings());

    const save = () =>
      prisma.$transaction(async (tx) => {
        // Row lock: a second upload or a COD switch at the same moment waits, then sees the new state.
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
        const current = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          select: {
            paymentMethod: true,
            paymentStatus: true,
            advanceReceived: true,
            _count: { select: { paymentProofs: true } },
          },
        });
        if (!canSubmitProof(current, current._count.paymentProofs)) return null;
        const proof = await tx.paymentProof.create({
          data: {
            orderId: order.id,
            method: fields.data.method,
            tid: fields.data.tid?.trim() || null,
            tidNormalized: tidTaken ? null : tidNormalized,
            amountSent: fields.data.amount ?? null,
            senderName: fields.data.senderName || "",
            detailsMissing,
            senderLast4: fields.data.senderLast4,
            paidAt: fields.data.paidAt,
            screenshotKey,
            sha256,
            dhash,
            amountMismatch: flags.amountMismatch,
            tidDuplicate,
            imageDuplicate,
            timeOutOfWindow: flags.timeOutOfWindow,
            status: flags.status,
          },
          select: { id: true },
        });
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: flags.status } });
        const jobs = await Promise.all(
          [
            "advance-proof-team-email",
            "advance-proof-customer-email",
            ...(autoRead ? ["advance-proof-autoread"] : []),
          ].map((name) =>
            tx.job.create({
              data: { name, orderId: order.id, payload: { orderId: order.id, proofId: proof.id } },
              select: { id: true },
            }),
          ),
        );
        // The first proof is the Purchase moment for an advance order (once; same event_id as checkout used to).
        return [...jobs.map((job) => job.id), ...(await enqueuePurchaseOnce(tx, order))];
      });
    let jobIds: string[] | null;
    try {
      jobIds = await save();
    } catch (error) {
      // Same TID sent for another order at the same moment: store it as a flagged duplicate instead.
      if ((error as { code?: string }).code !== "P2002" || tidTaken) throw error;
      tidTaken = true;
      tidDuplicate = true;
      jobIds = await save();
    }
    if (!jobIds)
      return res
        .status(409)
        .json({ error: "PROOF_NOT_ACCEPTED", message: "A payment proof is not needed for this order now." });
    runInBackground("advance proof emails", () => runJobsNow(jobIds!));
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: orderForPage });
    res.status(201).json(await payPage(fresh, await loadAdvanceSettings()));
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
      if (!changed.count) return null;
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: order.status,
          to: nextStatus,
          note: "Customer chose Cash on Delivery instead of advance payment (discount removed).",
        },
      });
      // Now a normal COD order: the COD emails and the Purchase event go out from here.
      return [...(await enqueueOrderEmails(tx, order.id, "cod-switch")), ...(await enqueuePurchaseOnce(tx, order))];
    });
    if (!switched) return res.status(409).json({ error: "CANNOT_SWITCH_TO_COD" });
    runInBackground("COD switch emails", () => runJobsNow(switched));
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: orderForPage });
    res.json(await payPage(fresh, await loadAdvanceSettings()));
  });
}
