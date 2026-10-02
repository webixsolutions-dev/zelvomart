"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadObject = uploadObject;
const client_s3_1 = require("@aws-sdk/client-s3");
function s3() {
    return new client_s3_1.S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || "auto",
        credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        } : undefined,
    });
}
async function uploadObject(key, body, contentType) {
    if (!process.env.S3_BUCKET || !process.env.S3_PUBLIC_BASE_URL)
        throw new Error("S3/R2 storage is not configured");
    await s3().send(new client_s3_1.PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public,max-age=31536000,immutable" }));
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}
