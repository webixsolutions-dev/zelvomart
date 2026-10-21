import path from "node:path";
import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function env(name: string) {
  return (process.env[name] || "").trim();
}

export function isCloudStorageConfigured() {
  return Boolean(
    env("S3_ENDPOINT") &&
    env("S3_BUCKET") &&
    env("S3_ACCESS_KEY_ID") &&
    env("S3_SECRET_ACCESS_KEY") &&
    env("S3_PUBLIC_BASE_URL"),
  );
}

export function getLocalUploadDir() {
  return env("LOCAL_UPLOAD_DIR") || path.join(process.cwd(), "uploads");
}

const REQUIRED_ENV = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_BASE_URL",
];

export class StorageError extends Error {
  code: "STORAGE_NOT_CONFIGURED" | "UPLOAD_FAILED";

  constructor(code: StorageError["code"], message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.cause = cause;
  }
}

function describeUploadFailure(error: any) {
  const status = error?.$metadata?.httpStatusCode;
  const code = error?.Code || error?.code || error?.cause?.code || error?.name;
  if (code === "NoSuchBucket")
    return `bucket "${env("S3_BUCKET")}" does not exist (check S3_BUCKET)`;
  if (
    code === "InvalidAccessKeyId" ||
    code === "SignatureDoesNotMatch" ||
    status === 401
  ) {
    return "the R2 access key was rejected (check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY)";
  }
  if (code === "AccessDenied" || status === 403)
    return "the R2 API token is not allowed to write to this bucket";
  if (
    [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "EAI_AGAIN",
      "EPROTO",
    ].includes(code)
  ) {
    return `could not reach Cloudflare R2 (${code}; check S3_ENDPOINT and the network connection)`;
  }
  const detail = error?.message || "unknown error";
  return code && code !== "Error" ? `${code}: ${detail}` : detail;
}

function sanitizeKey(key: string) {
  return key
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

function s3() {
  const endpoint = env("S3_ENDPOINT");
  const isR2 = /r2\.cloudflarestorage\.com/i.test(endpoint);
  const forcePathStyle =
    env("S3_FORCE_PATH_STYLE") === "true" ||
    (!isR2 && env("S3_FORCE_PATH_STYLE") !== "false");

  return new S3Client({
    endpoint,
    region: env("S3_REGION") || "auto",
    forcePathStyle,
    // R2 rejects the default AWS SDK checksum headers.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    },
  });
}

export async function uploadObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  const safeKey = sanitizeKey(key);
  if (!safeKey)
    throw new StorageError(
      "UPLOAD_FAILED",
      "Unable to upload to Cloudflare: a storage object key is required.",
    );

  const missing = REQUIRED_ENV.filter((name) => !env(name));
  if (missing.length) {
    throw new StorageError(
      "STORAGE_NOT_CONFIGURED",
      `Unable to upload to Cloudflare: R2 is not configured. Missing ${missing.join(", ")} in the backend environment.`,
    );
  }

  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: env("S3_BUCKET"),
        Key: safeKey,
        Body: body,
        ContentType: contentType,
        CacheControl: "public,max-age=31536000,immutable",
      }),
    );
  } catch (error) {
    console.error("Cloudflare R2 upload failed", { key: safeKey, error });
    throw new StorageError(
      "UPLOAD_FAILED",
      `Unable to upload to Cloudflare: ${describeUploadFailure(error)}.`,
      error,
    );
  }

  return `${env("S3_PUBLIC_BASE_URL").replace(/\/$/, "")}/${safeKey}`;
}

export async function presignReviewUpload(
  key: string,
  contentType: string,
  size: number,
) {
  if (!isCloudStorageConfigured())
    throw new StorageError(
      "STORAGE_NOT_CONFIGURED",
      "Configure R2 storage before uploading review media.",
    );
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env("S3_BUCKET"),
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: 3600 },
  );
}
export async function readStagedReviewObject(
  key: string,
  expectedSize: number,
) {
  const object = await s3().send(
    new GetObjectCommand({ Bucket: env("S3_BUCKET"), Key: key }),
  );
  if (
    object.ContentLength !== expectedSize ||
    expectedSize > 40 * 1024 * 1024
  ) {
    (object.Body as { destroy?: () => void } | undefined)?.destroy?.();
    throw new Error("Staged file size does not match the authorised upload.");
  }
  if (!object.Body) throw new Error("Staged upload is missing.");
  return Buffer.from(await object.Body.transformToByteArray());
}
