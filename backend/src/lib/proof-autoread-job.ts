import { prisma } from "./db";
import { loadAdvanceSettings } from "./advance-payment";
import { readPaymentProof } from "./payment-proof-storage";
import { autoReader, receiverDiffers, type ProofReader } from "./proof-autoread";

/**
 * Job "advance-proof-autoread": reads the stored (already cleaned) screenshot and saves the hints for the staff
 * comparison table, plus the "receiver differs" flag. It never touches the proof's status or the order.
 */
export async function runProofAutoRead(proofId: string, reader?: ProofReader | null) {
  const settings = await loadAdvanceSettings();
  const active = reader === undefined ? autoReader(settings) : reader;
  if (!active) return { skipped: "AUTO_READ_OFF" };
  const proof = await prisma.paymentProof.findUnique({
    where: { id: proofId },
    select: { id: true, screenshotKey: true, ocrJson: true },
  });
  if (!proof) return { skipped: "PROOF_NOT_FOUND" };
  if (proof.ocrJson) return { skipped: "ALREADY_READ" };
  const result = await active.read(await readPaymentProof(proof.screenshotKey), "image/webp");
  if (!result) return { skipped: "NOTHING_READ" };
  await prisma.paymentProof.update({
    where: { id: proof.id },
    data: {
      ocrJson: { ...result, dateTime: result.dateTime?.toISOString() ?? null },
      ocrTid: result.tid,
      ocrAmount: result.amount,
      ocrDateTime: result.dateTime,
      ocrSender: result.sender,
      ocrReceiver: result.receiver,
      ocrConfidence: result.confidence,
      receiverMismatch: receiverDiffers(result.receiver, settings.accountName),
    },
  });
  return { read: true, confidence: result.confidence };
}
