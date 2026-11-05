import { prisma } from "./db";
import type { Prisma } from "../generated/prisma/client";
import { loadAdvanceSettings } from "./advance-payment";
import { normalizeTid } from "./payment-proof";
import { readPaymentProof } from "./payment-proof-storage";
import { autoReader, prefillFrom, receiverDiffers, type ProofReader } from "./proof-autoread";

/**
 * Job "advance-proof-autoread": reads the stored (already cleaned) screenshot and saves the hints for the staff
 * comparison table, plus the "receiver differs" flag. It never verifies a payment.
 *
 * Screenshot-only proofs (the customer typed no TID or amount): the clearly read values become the proof's own
 * values, marked "auto-read", so the duplicate-TID and amount checks still run. Whatever the customer typed always
 * wins. Nothing read: the proof stays flagged "details missing, check the screenshot".
 */
export async function runProofAutoRead(proofId: string, reader?: ProofReader | null) {
  const settings = await loadAdvanceSettings();
  const active = reader === undefined ? autoReader(settings) : reader;
  if (!active) return { skipped: "AUTO_READ_OFF" };
  const source = await prisma.paymentProof.findUnique({
    where: { id: proofId },
    select: {
      orderId: true,
      screenshotKey: true,
      ocrJson: true,
    },
  });
  if (!source) return { skipped: "PROOF_NOT_FOUND" };
  if (!source.screenshotKey) return { skipped: "NO_SCREENSHOT" };
  if (source.ocrJson) return { skipped: "ALREADY_READ" };
  const result = await active.read(await readPaymentProof(source.screenshotKey), "image/webp");
  if (!result) return { skipped: "NOTHING_READ" };

  return prisma.$transaction(async (tx) => {
    // Staff can decide while Gemini is working. Re-read under the same order lock as the staff actions.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${source.orderId} FOR UPDATE`;
    const proof = await tx.paymentProof.findUnique({
      where: { id: proofId },
      select: { id: true, orderId: true, status: true, ocrJson: true, tid: true, amountSent: true, senderName: true },
    });
    if (!proof) return { skipped: "PROOF_NOT_FOUND" };
    if (proof.ocrJson) return { skipped: "ALREADY_READ" };

    const fill = prefillFrom(result);
    const data: Prisma.PaymentProofUncheckedUpdateInput = {
      ocrJson: { ...result, dateTime: result.dateTime?.toISOString() ?? null },
      ocrTid: result.tid,
      ocrAmount: result.amount,
      ocrDateTime: result.dateTime,
      ocrSender: result.sender,
      ocrReceiver: result.receiver,
      ocrConfidence: result.confidence,
      receiverMismatch: receiverDiffers(result.receiver, settings.accountName),
    };
    // Only while staff have not decided yet, and only for what the customer left empty.
    const open = proof.status === "SUBMITTED" || proof.status === "MISMATCH";
    let filled = false;
    let tid = proof.tid;
    let amount = proof.amountSent == null ? null : Number(proof.amountSent);
    let orderStatus: "MISMATCH" | null = null;
    if (open && fill) {
      if (!tid && fill.tid && normalizeTid(fill.tid).length >= 6) {
        tid = fill.tid;
        const key = normalizeTid(fill.tid);
        const same = await tx.paymentProof.findMany({
          where: { tidNormalized: key, id: { not: proof.id } },
          select: { orderId: true, status: true },
        });
        data.tid = fill.tid;
        // The partial unique index covers live proofs only: a TID already live elsewhere is kept as a flag.
        data.tidNormalized = same.some((row) => row.status !== "REJECTED") ? null : key;
        data.tidDuplicate = same.some((row) => row.orderId !== proof.orderId);
        filled = true;
      }
      if (amount == null && fill.amount != null) {
        amount = fill.amount;
        const order = await tx.order.findUniqueOrThrow({ where: { id: proof.orderId }, select: { total: true } });
        const mismatch = Math.abs(fill.amount - Number(order.total)) >= 1;
        data.amountSent = fill.amount;
        data.amountMismatch = mismatch;
        if (mismatch && proof.status === "SUBMITTED") {
          data.status = "MISMATCH";
          orderStatus = "MISMATCH";
        }
        filled = true;
      }
      if (!proof.senderName && fill.sender) data.senderName = fill.sender;
      if (filled) data.detailsFromAutoRead = true;
    }
    data.detailsMissing = !tid || amount == null;

    await tx.paymentProof.update({ where: { id: proof.id }, data });
    // The read amount differs from the total: the order shows the same "amount issue" as a typed one.
    if (orderStatus)
      await tx.order.updateMany({
        where: { id: proof.orderId, paymentStatus: "SUBMITTED" },
        data: { paymentStatus: orderStatus },
      });
    return { read: true, confidence: result.confidence, filled };
  });
}
