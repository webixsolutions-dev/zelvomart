import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function s3() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    } : undefined,
  });
}

export async function uploadObject(key: string, body: Uint8Array, contentType: string) {
  if (!process.env.S3_BUCKET || !process.env.S3_PUBLIC_BASE_URL) throw new Error("S3/R2 storage is not configured");
  await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public,max-age=31536000,immutable" }));
  return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}
