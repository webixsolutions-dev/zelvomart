import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Payment screenshots are private: they go to PAYMENT_PROOF_S3_BUCKET, or else the private replay bucket
 * (REPLAY_S3_BUCKET) under `payment-proofs/`, whose R2 lifecycle rule only deletes `replays/`. The public media
 * bucket (S3_BUCKET) is always refused. Staff see a screenshot only through a 5-minute signed link.
 * Off production with no bucket, files go to a local folder (PAYMENT_PROOF_LOCAL_DIR or the temp folder): testing only.
 */
const PREFIX = "payment-proofs/";
const KEY_PATTERN = /^payment-proofs\/ZM-\d{4,12}\/[0-9a-f]{24}\.webp$/;

function env(name: string) {
  return (process.env[name] || "").trim();
}

export function paymentProofBucket() {
  const bucket = env("PAYMENT_PROOF_S3_BUCKET") || env("REPLAY_S3_BUCKET");
  if (!bucket || bucket === env("S3_BUCKET")) return "";
  return env("S3_ENDPOINT") && env("S3_ACCESS_KEY_ID") && env("S3_SECRET_ACCESS_KEY") ? bucket : "";
}

/** Never on production; elsewhere when a folder is named, or on a developer machine (not Vercel). */
function localFallbackAllowed() {
  if (env("APP_ENV") === "production") return false;
  return !!env("PAYMENT_PROOF_LOCAL_DIR") || (process.env.NODE_ENV !== "production" && !process.env.VERCEL);
}

function localDir() {
  return env("PAYMENT_PROOF_LOCAL_DIR") || path.join(os.tmpdir(), "zelvomart-payment-proofs");
}

/** Whether a proof can be stored at all (a private bucket, or the local folder off production). */
export function paymentProofStorageReady() {
  return !!paymentProofBucket() || localFallbackAllowed();
}

function client() {
  return new S3Client({
    endpoint: env("S3_ENDPOINT"),
    region: env("S3_REGION") || "auto",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: env("S3_ACCESS_KEY_ID"), secretAccessKey: env("S3_SECRET_ACCESS_KEY") },
  });
}

export function isPaymentProofKey(key: string) {
  return KEY_PATTERN.test(key);
}

export async function storePaymentProof(orderNumber: string, bytes: Buffer) {
  if (!/^ZM-\d{4,12}$/.test(orderNumber)) throw new Error("Invalid order number for a proof file");
  const key = `${PREFIX}${orderNumber}/${randomBytes(12).toString("hex")}.webp`;
  const bucket = paymentProofBucket();
  if (bucket) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: "image/webp",
        CacheControl: "private, no-store",
        IfNoneMatch: "*",
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
    return key;
  }
  if (!localFallbackAllowed()) throw new Error("PAYMENT_PROOF_STORAGE_NOT_CONFIGURED");
  const file = path.join(localDir(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
  return key;
}

/** Staff only: a link valid for 5 minutes (or null off production, where the admin reads the bytes instead). */
export async function paymentProofSignedUrl(key: string) {
  if (!isPaymentProofKey(key)) throw new Error("Invalid proof key");
  const bucket = paymentProofBucket();
  if (!bucket) return null;
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}

/** Staff only: the stored bytes (used for the local fallback and for the auto-read). */
export async function readPaymentProof(key: string) {
  if (!isPaymentProofKey(key)) throw new Error("Invalid proof key");
  const bucket = paymentProofBucket();
  if (bucket) {
    const object = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) throw new Error("Proof file is empty");
    return Buffer.from(await object.Body.transformToByteArray());
  }
  if (!localFallbackAllowed()) throw new Error("PAYMENT_PROOF_STORAGE_NOT_CONFIGURED");
  return readFile(path.join(localDir(), key));
}
