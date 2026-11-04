import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";

/**
 * Advance payment proof: the customer's screenshot, TID, amount and sender. Nothing here verifies a payment: staff
 * always find the credit in the Easypaisa merchant app first. These helpers only clean the image and raise flags.
 */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_FORMATS = ["jpeg", "png", "webp"] as const;
/** A customer may send one proof, and one more while it is MISMATCH or REJECTED. */
export const PROOF_MAX_PER_ORDER = 2;
/** dHash distance at or below which two screenshots count as the same picture (out of 64 bits). */
export const NEAR_DUPLICATE_DISTANCE = 6;

/** "abc 123-456" → "ABC123456". Empty when nothing usable is left. */
export function normalizeTid(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export const proofFieldsSchema = z.object({
  method: z.enum(["TILL", "RAAST_QR", "OTHER"]).catch("OTHER"),
  tid: z
    .string()
    .trim()
    .max(60)
    .refine((value) => /^[A-Z0-9]{6,40}$/.test(normalizeTid(value)), "Enter the transaction ID (TID) from your app."),
  amount: z.coerce
    .number()
    .finite()
    .positive("Enter the amount you sent.")
    .max(10_000_000)
    .transform((value) => Math.round(value * 100) / 100),
  senderName: z.string().trim().min(2, "Enter the name on the account you paid from.").max(80),
  senderLast4: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.replace(/\D/g, "") : ""))
    .refine((value) => !value || value.length === 4, "Last 4 digits: enter exactly 4 digits.")
    .transform((value) => value || null),
  paidAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }),
});
export type ProofFields = z.infer<typeof proofFieldsSchema>;

export class ProofImageError extends Error {
  code = "PROOF_IMAGE_INVALID";
}

/**
 * Re-encodes the upload as WebP: metadata (EXIF, GPS, device) is dropped, the EXIF rotation is applied, nothing is
 * cropped and the size is only reduced past 2400 px. Rejects anything that is not a real JPG, PNG or WebP picture.
 */
export async function cleanProofImage(input: Buffer) {
  if (!input.length || input.length > PROOF_MAX_BYTES) throw new ProofImageError("The screenshot must be up to 5 MB.");
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ProofImageError("That file is not a picture we can read. Send a JPG, PNG or WebP screenshot.");
  }
  if (!PROOF_FORMATS.includes(meta.format as (typeof PROOF_FORMATS)[number]))
    throw new ProofImageError("Send a JPG, PNG or WebP screenshot.");
  if ((meta.pages || 1) > 1) throw new ProofImageError("Send a single screenshot, not an animation.");
  const bytes = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  const out = await sharp(bytes).metadata();
  return { bytes, contentType: "image/webp", width: out.width || 0, height: out.height || 0 };
}

export function sha256Hex(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 64-bit difference hash (16 hex characters): near-identical screenshots give near-identical hashes. */
export async function differenceHash(bytes: Buffer) {
  const pixels = await sharp(bytes).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++)
      bits = (bits << 1n) | (pixels[row * 9 + col] > pixels[row * 9 + col + 1] ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string) {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) return 64;
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

/**
 * Flags for staff, never a decision:
 * - amount: what the customer says they sent differs from the order total by Rs 1 or more;
 * - time: the stated payment time is more than 30 minutes before the order, or in the future.
 * An amount mismatch makes the proof (and the order's payment) MISMATCH; other flags leave it SUBMITTED.
 */
export function proofFlags(input: {
  amountSent: number;
  expected: number;
  paidAt: Date | null;
  orderCreatedAt: Date;
  now?: Date;
  tidDuplicate: boolean;
  imageDuplicate: boolean;
}) {
  const now = input.now || new Date();
  const amountMismatch = Math.abs(input.amountSent - input.expected) >= 1;
  const timeOutOfWindow =
    !!input.paidAt &&
    (input.paidAt.getTime() < input.orderCreatedAt.getTime() - 30 * 60_000 ||
      input.paidAt.getTime() > now.getTime() + 10 * 60_000);
  return {
    amountMismatch,
    timeOutOfWindow,
    tidDuplicate: input.tidDuplicate,
    imageDuplicate: input.imageDuplicate,
    status: amountMismatch ? ("MISMATCH" as const) : ("SUBMITTED" as const),
  };
}

/** Whether the customer may send a proof now: the first one, or one more after a mismatch or rejection. */
export function canSubmitProof(order: { paymentMethod: string; paymentStatus: string }, proofCount: number) {
  if (order.paymentMethod !== "ADVANCE_EASYPAISA") return false;
  if (proofCount === 0) return ["AWAITING_PAYMENT", "EXPIRED"].includes(order.paymentStatus);
  return proofCount < PROOF_MAX_PER_ORDER && ["MISMATCH", "REJECTED"].includes(order.paymentStatus);
}

/** Customer-facing reasons staff can pick when rejecting a proof (admin Payments screen). */
export const REJECT_REASONS = {
  NOT_RECEIVED: "We could not find this payment in our Easypaisa merchant account.",
  WRONG_AMOUNT: "The amount we received does not match your order total.",
  WRONG_ACCOUNT: "The payment went to a different account, not Zelvomart.",
  UNREADABLE: "We could not read the screenshot. Please send a clearer one.",
  DUPLICATE: "This transaction was already used for another order.",
  OTHER: "We could not confirm this payment.",
} as const;
export type RejectReason = keyof typeof REJECT_REASONS;
