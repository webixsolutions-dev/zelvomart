import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const db = await PGlite.create();
const schema = execFileSync(
  process.execPath,
  [
    require.resolve("prisma/build/index.js"),
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)),
    "--script",
  ],
  { encoding: "utf8" },
);
await db.exec(schema);
console.log("PASS: isolated PostgreSQL schema initialized");
const socket = new PGLiteSocketServer({ db, port: 55439, host: "127.0.0.1" });
await socket.start();
const objects = new Map();
const storage = http.createServer((req, res) => {
  const pathname = new URL(req.url!, "http://localhost").pathname;
  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      objects.set(pathname, Buffer.concat(chunks));
      res.writeHead(200, { etag: '"test"' });
      res.end();
    });
  } else {
    const object = objects.get(pathname) || objects.get("/qa" + pathname);
    res.writeHead(object ? 200 : 404, object ? { "content-length": object.length } : {});
    res.end(object);
  }
});
await new Promise((r) => storage.listen(55440, "127.0.0.1", r));
Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55439/postgres",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:55439/postgres",
  DATABASE_SSL: "false",
  JWT_SECRET: "isolated-local-review-test-secret-only",
  VERCEL: "1",
  REVALIDATION_SECRET: "",
  S3_ENDPOINT: "http://127.0.0.1:55440",
  S3_BUCKET: "qa",
  S3_ACCESS_KEY_ID: "qa",
  S3_SECRET_ACCESS_KEY: "qa",
  S3_PUBLIC_BASE_URL: "http://127.0.0.1:55440",
  S3_FORCE_PATH_STYLE: "true",
  FRONTEND_URL: "http://127.0.0.1:55441",
});
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../src/generated/prisma/client.ts");
globalThis.prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })),
});
const { prisma } = require("../src/lib/db.ts");
const { signAdminToken, passwordStamp } = require("../src/lib/auth.ts");
const { app } = require("../src/server.ts");
const { csv, REVIEW_COLUMNS } = require("../src/lib/review-import.ts");
const { zipSync } = require("fflate");
const sharp = require("sharp");
const qaOwnerHash = await require("bcryptjs").hash("QaReview123!", 4);
await prisma.user.create({
  data: {
    id: "qa-owner",
    name: "QA Owner",
    email: "qa@example.invalid",
    passwordHash: qaOwnerHash,
    role: "OWNER",
  },
});
for (const [id, title, sku] of [
  ["p1", "QA Bag", "QA-BAG"],
  ["p2", "QA Cable", "QA-USB"],
])
  await prisma.product.create({
    data: {
      id,
      title,
      slug: id,
      sku,
      price: 100,
      stock: 10,
      status: "PUBLISHED",
    },
  });
const token = signAdminToken(
  {
    id: "qa-owner",
    name: "QA Owner",
    email: "qa@example.invalid",
    role: "OWNER",
  },
  passwordStamp(qaOwnerHash),
);
const api = app.listen(55441, "127.0.0.1");
async function call(path, options = {}, auth = true) {
  const response = await fetch("http://127.0.0.1:55441" + path, {
    ...options,
    headers: {
      ...(auth ? { authorization: "Bearer " + token } : {}),
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}
function ok(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  return result.body;
}
const png = await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#aabbcc" },
})
  .png()
  .toBuffer();
const rows = [
  ["QA-001", "QA Bag", "QA-BAG"],
  ["QA-002", "QA Bag", "QA-BAG"],
  ["QA-003", "QA Cable", "QA-USB"],
  ["QA-004", "QA Cable", "QA-USB"],
].map(([reviewRef, productTitle, productSku], i) => ({
  reviewRef,
  productTitle,
  productSku,
  reviewerName: `QA reviewer ${i}`,
  reviewerEmail: `private-${i}@example.invalid`,
  rating: String(i === 0 ? 5 : 4),
  reviewText: "TEST ONLY. Not historical customer feedback.",
  reviewDate: "2025-03-08",
  mediaFiles: i === 0 ? "QA-001/photo.png|QA-001/video.mp4" : "",
  avatarFile: i === 0 ? "QA-001/avatar.png" : "",
}));
const zipped = zipSync({
  "QA-001/photo.png": png,
  "QA-001/avatar.png": png,
  "QA-001/video.mp4": readFileSync(new URL("./fixtures/review-test.mp4", import.meta.url)),
  "unassigned.png": png,
});
function form(records = rows, zip = zipped) {
  const data = new FormData();
  data.append(
    "csv",
    new Blob([csv([REVIEW_COLUMNS, ...records.map((r) => REVIEW_COLUMNS.map((k) => r[k] || ""))])]),
    "qa-only.csv",
  );
  data.append("zip", new Blob([zip]), "qa-only.zip");
  data.append("overrides", "{}");
  return data;
}
try {
  assert.equal((await call("/api/admin/reviews", {}, false)).status, 401);
  const zipTicket = ok(
    await call("/api/admin/reviews/upload-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "qa-only.zip",
        contentType: "application/zip",
        size: zipped.length,
        field: "zip",
      }),
    }),
  );
  assert.equal(
    (
      await fetch(zipTicket.url, {
        method: "PUT",
        body: zipped,
        headers: { "content-type": zipTicket.contentType },
      })
    ).status,
    200,
  );
  const directPayload = {
    csvContent: csv([REVIEW_COLUMNS, ...rows.map((r) => REVIEW_COLUMNS.map((k) => r[k] || ""))]),
    csvFilename: "qa-only.csv",
    uploadTokens: [zipTicket.token],
    overrides: "{}",
  };
  assert.equal(
    (
      await call("/api/admin/reviews/preview", {
        method: "POST",
        body: JSON.stringify(directPayload),
        headers: {
          authorization:
            "Bearer " +
            signAdminToken(
              {
                id: "qa-other-owner",
                name: "Other",
                email: "other@example.invalid",
                role: "OWNER",
              },
              "no-such-account",
            ),
        },
      })
    ).status,
    400,
  );
  const preview = ok(
    await call("/api/admin/reviews/preview", {
      method: "POST",
      body: JSON.stringify(directPayload),
    }),
  );
  assert.equal(preview.rows.length, 4);
  assert.ok(preview.rows.every((r) => !r.errors.length));
  assert.equal(preview.rows[0].media.length, 3);
  assert.deepEqual(preview.unassigned, ["unassigned.png"]);
  console.log("PASS: multi-product preview and attachment ownership");
  const commit = JSON.stringify({
    ...directPayload,
    digest: preview.digest,
    selected: "[0,1,2,3]",
  });
  const batch = ok(await call("/api/admin/reviews/import", { method: "POST", body: commit }), 201);
  assert.equal(batch.imported, 4);
  assert.equal(batch.failed, 0);
  let product = ok(await call("/api/products/slug/p1", {}, false));
  assert.equal(product.reviews.length, 0);
  console.log("PASS: imported reviews default to Pending");
  let all = ok(await call("/api/admin/reviews"));
  const imported = all.find((r) => r.reviewRef === "QA-001");
  assert.equal(imported.reviewDate.slice(0, 10), "2025-03-08");
  assert.equal(imported.verified, false);
  assert.equal(imported.media.length, 2);
  assert.ok(imported.avatarUrl);
  assert.equal([...objects.keys()].filter((key) => key.includes("/reviews/assets/")).length, 2);
  ok(
    await call("/api/admin/reviews/" + imported.id, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    }),
  );
  product = ok(await call("/api/products/slug/p1", {}, false));
  assert.equal(product.reviewCount, 1);
  assert.equal(product.averageRating, 5);
  assert.equal(product.reviews[0].createdAt.slice(0, 10), "2025-03-08");
  assert.equal(product.reviews[0].media.length, 2);
  assert.equal(product.reviews[0].verified, false);
  assert.ok(!JSON.stringify(product).includes("private-"));
  assert.ok(!("email" in product.reviews[0]));
  console.log("PASS: approval, original date, media, rating and email privacy");
  const duplicates = ok(await call("/api/admin/reviews/preview", { method: "POST", body: form() }));
  assert.ok(duplicates.rows.every((r) => r.errors.some((e) => e.includes("Duplicate"))));
  const invalid = [
    {
      ...rows[0],
      reviewRef: "QA-ERROR",
      rating: "6",
      reviewDate: "2099-01-01",
    },
  ];
  const invalidPreview = ok(
    await call("/api/admin/reviews/preview", {
      method: "POST",
      body: form(invalid, zipSync({})),
    }),
  );
  assert.ok(invalidPreview.rows[0].errors.length >= 2);
  console.log("PASS: duplicate protection and invalid row rejection");
  const manual = new FormData();
  for (const [key, value] of Object.entries({
    productId: "p1",
    name: "QA manual",
    email: "manual-private@example.invalid",
    rating: "3",
    body: "TEST ONLY manual feedback",
    reviewDate: "2024-01-01",
    status: "APPROVED",
  }))
    manual.append(key, value);
  const manualReview = ok(await call("/api/admin/reviews", { method: "POST", body: manual }), 201);
  assert.equal(manualReview.origin, "MANUAL");
  assert.equal(manualReview.verified, false);
  product = ok(await call("/api/products/slug/p1", {}, false));
  assert.equal(product.reviewCount, 2);
  assert.equal(product.averageRating, 4);
  console.log("PASS: manual review and aggregate updates");
  const otherRows = [{ ...rows[2], reviewRef: "QA-OTHER", mediaFiles: "", avatarFile: "" }];
  const otherPreview = ok(
    await call("/api/admin/reviews/preview", {
      method: "POST",
      body: form(otherRows, zipSync({})),
    }),
  );
  const otherForm = form(otherRows, zipSync({}));
  otherForm.append("digest", otherPreview.digest);
  otherForm.append("selected", "[0]");
  const otherBatch = ok(
    await call("/api/admin/reviews/import", {
      method: "POST",
      body: otherForm,
    }),
    201,
  );
  ok(
    await call("/api/admin/reviews/batches/" + batch.id, {
      method: "DELETE",
      body: JSON.stringify({ confirmCount: 4 }),
    }),
  );
  all = ok(await call("/api/admin/reviews"));
  assert.equal(all.length, 2);
  assert.ok(all.some((r) => r.id === manualReview.id));
  assert.ok(all.some((r) => r.batchId === otherBatch.id));
  product = ok(await call("/api/products/slug/p1", {}, false));
  assert.equal(product.reviewCount, 1);
  assert.equal(product.averageRating, 3);
  const tombstones = ok(await call("/api/admin/reviews/preview", { method: "POST", body: form() }));
  assert.ok(tombstones.rows.every((r) => r.errors.some((e) => e.includes("Duplicate"))));
  ok(
    await call("/api/admin/reviews/batches/" + batch.id + "/restore", {
      method: "POST",
    }),
  );
  all = ok(await call("/api/admin/reviews"));
  assert.equal(all.filter((r) => r.batchId === batch.id && r.status === "PENDING").length, 4);
  const audit = await prisma.auditLog.count({
    where: {
      action: {
        in: ["review_import", "review_batch_delete", "review_batch_restore"],
      },
    },
  });
  assert.ok(audit >= 4);
  console.log("PASS: isolated batch deletion, reserved references, restore as Pending and audit trail");

  await prisma.order.create({
    data: {
      id: "qa-order",
      orderNumber: "QA-ORDER",
      idempotencyKey: "qa-order",
      fullName: "QA Buyer",
      phone: "03001234567",
      city: "Karachi",
      address: "QA only",
      status: "DELIVERED",
      subtotal: 100,
      total: 100,
      test: true,
      items: {
        create: {
          productId: "p1",
          sku: "QA-BAG",
          title: "QA Bag",
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        },
      },
    },
  });
  const customerPayload = {
    productId: "p1",
    name: "QA Buyer",
    email: "customer-private@example.invalid",
    body: "QA ONLY customer review",
    rating: 5,
    orderNumber: "QA-ORDER",
    phone: "03001234567",
    reviewDate: "2099-01-01",
    verified: false,
  };
  assert.equal(
    (
      await call(
        "/api/reviews",
        {
          method: "POST",
          body: JSON.stringify({ ...customerPayload, phone: "03009999999" }),
        },
        false,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/reviews",
        {
          method: "POST",
          body: JSON.stringify({ ...customerPayload, rating: 3.5 }),
        },
        false,
      )
    ).status,
    400,
  );
  const photoTicket = ok(
    await call(
      "/api/reviews/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          ...customerPayload,
          filename: "photo.png",
          contentType: "image/png",
          size: png.length,
          field: "media",
        }),
      },
      false,
    ),
  );
  assert.equal(
    (
      await fetch(photoTicket.url, {
        method: "PUT",
        body: png,
        headers: { "content-type": photoTicket.contentType },
      })
    ).status,
    200,
  );
  const customerForm = JSON.stringify({
    ...customerPayload,
    uploadTokens: [photoTicket.token],
  });
  const customer = ok(await call("/api/reviews", { method: "POST", body: customerForm }, false), 201);
  assert.equal(customer.verified, true);
  const storedCustomer = await prisma.review.findUnique({
    where: { id: customer.id },
    include: { media: true },
  });
  assert.equal(storedCustomer.origin, "CUSTOMER");
  assert.equal(storedCustomer.status, "PENDING");
  assert.equal(storedCustomer.reviewDate, null);
  assert.equal(storedCustomer.media.length, 1);
  assert.ok(Math.abs(Date.now() - storedCustomer.createdAt.getTime()) < 10000);
  assert.equal(
    (await call("/api/reviews", { method: "POST", body: JSON.stringify(customerPayload) }, false)).status,
    409,
  );
  console.log(
    "PASS: real customer submission, delivered-order eligibility, server timestamp, media and duplicate protection",
  );
  const errorRows = [
    {
      ...rows[0],
      reviewRef: "QA-SKIP",
      mediaFiles: "missing/photo.png",
      avatarFile: "",
    },
    { ...rows[1], reviewRef: "QA-RETRY", mediaFiles: "", avatarFile: "" },
  ];
  const errorPreview = ok(
    await call("/api/admin/reviews/preview", {
      method: "POST",
      body: form(errorRows, zipSync({})),
    }),
  );
  assert.ok(errorPreview.rows[0].errors.length);
  const errorForm = form(errorRows, zipSync({}));
  errorForm.append("digest", errorPreview.digest);
  errorForm.append("selected", "[1]");
  const errorBatch = ok(
    await call("/api/admin/reviews/import", {
      method: "POST",
      body: errorForm,
    }),
    201,
  );
  assert.equal(errorBatch.skipped, 1);
  const errorCsv = await (
    await fetch("http://127.0.0.1:55441/api/admin/reviews/batches/" + errorBatch.id + "/errors", {
      headers: { authorization: "Bearer " + token },
    })
  ).text();
  assert.ok(errorCsv.includes("QA-SKIP"));
  assert.ok(errorCsv.includes("own reviewRef"));
  const retryRows = [{ ...errorRows[0], mediaFiles: "" }];
  const retryPreview = ok(
    await call("/api/admin/reviews/preview", {
      method: "POST",
      body: form(retryRows, zipSync({})),
    }),
  );
  assert.equal(retryPreview.rows[0].errors.length, 0);
  console.log("PASS: error CSV, skipped totals and corrected rows can be retried");
  const publicBeforeDemo = ok(await call("/api/products/slug/p1", {}, false));
  const demoForm = new FormData();
  for (const [key, value] of Object.entries({
    productId: "p1",
    name: "Demo reviewer",
    email: "",
    rating: "5",
    body: "DEMO ONLY. Not customer feedback.",
    reviewDate: "2025-03-08",
    status: "APPROVED",
    isTest: "true",
  }))
    demoForm.append(key, value);
  demoForm.append("media", new Blob([png], { type: "image/png" }), "photo.png");
  demoForm.append("avatar", new Blob([png], { type: "image/png" }), "avatar.png");
  const demoReview = ok(await call("/api/admin/reviews", { method: "POST", body: demoForm }), 201);
  assert.equal(demoReview.origin, "TEST");
  assert.equal(demoReview.status, "APPROVED");
  assert.equal(demoReview.media.length, 1);
  assert.ok(demoReview.avatarUrl);
  const publicWithDemo = ok(await call("/api/products/slug/p1", {}, false));
  assert.equal(publicWithDemo.reviewCount, publicBeforeDemo.reviewCount);
  assert.equal(publicWithDemo.averageRating, publicBeforeDemo.averageRating);
  assert.ok(!publicWithDemo.reviews.some((r) => r.id === demoReview.id));
  assert.equal(
    (
      await call("/api/admin/reviews/" + demoReview.id, {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED", isTest: false }),
      })
    ).status,
    400,
  );
  const editDemo = new FormData();
  for (const [key, value] of Object.entries({
    productId: "p2",
    name: "Edited demo reviewer",
    rating: "2",
    body: "EDITED DEMO ONLY.",
    reviewDate: "2024-04-10",
    status: "REJECTED",
    retainMediaIds: "[]",
    removeAvatar: "true",
  }))
    editDemo.append(key, value);
  editDemo.append(
    "media",
    new Blob([readFileSync(new URL("./fixtures/review-test.mp4", import.meta.url))], { type: "video/mp4" }),
    "new-video.mp4",
  );
  const editedDemo = ok(
    await call("/api/admin/reviews/" + demoReview.id, {
      method: "PATCH",
      body: editDemo,
    }),
  );
  assert.equal(editedDemo.name, "Edited demo reviewer");
  assert.equal(editedDemo.productId, "p2");
  assert.equal(editedDemo.rating, 2);
  assert.equal(editedDemo.status, "REJECTED");
  assert.equal(editedDemo.body, "EDITED DEMO ONLY.");
  assert.equal(editedDemo.reviewDate.slice(0, 10), "2024-04-10");
  assert.equal(editedDemo.avatarUrl, null);
  assert.equal(editedDemo.media.length, 1);
  assert.equal(editedDemo.media[0].type, "video");
  assert.equal(editedDemo.origin, "TEST");
  ok(
    await call("/api/admin/reviews/" + demoReview.id, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    }),
  );
  const publicOtherProduct = ok(await call("/api/products/slug/p2", {}, false));
  assert.ok(!publicOtherProduct.reviews.some((r) => r.id === demoReview.id));
  assert.equal(
    (
      await call("/api/admin/reviews/" + customer.id, {
        method: "PATCH",
        body: JSON.stringify({ status: "PENDING", productId: "p2" }),
      })
    ).status,
    400,
  );
  console.log(
    "PASS: demo approval stays private; edit name, product, stars, date, text and media/avatar; verified product stays locked",
  );
  const chunkBytes = Buffer.alloc(2 * 1024 * 1024 + 17, 42);
  const chunkTicket = ok(
    await call("/api/admin/reviews/upload-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "qa-chunk.zip",
        contentType: "application/zip",
        size: chunkBytes.length,
        field: "zip",
      }),
    }),
  );
  for (let part = 0; part < 2; part++) {
    const form = new FormData();
    form.append("uploadToken", chunkTicket.token);
    form.append("part", String(part));
    form.append(
      "chunk",
      new Blob([chunkBytes.subarray(part * 2 * 1024 * 1024, (part + 1) * 2 * 1024 * 1024)]),
      "chunk.bin",
    );
    ok(
      await call("/api/admin/reviews/upload-chunk", {
        method: "POST",
        body: form,
      }),
    );
  }
  ok(
    await call("/api/admin/reviews/upload-complete", {
      method: "POST",
      body: JSON.stringify({ uploadToken: chunkTicket.token }),
    }),
  );
  assert.deepEqual(objects.get(new URL(chunkTicket.url).pathname), chunkBytes);
  const badChunk = new FormData();
  badChunk.append("uploadToken", chunkTicket.token);
  badChunk.append("part", "99");
  badChunk.append("chunk", new Blob(["wrong"]), "chunk.bin");
  assert.equal(
    (
      await call("/api/admin/reviews/upload-chunk", {
        method: "POST",
        body: badChunk,
      })
    ).status,
    400,
  );
  const customerChunk = new FormData();
  for (const [key, value] of Object.entries(customerPayload)) customerChunk.append(key, String(value));
  customerChunk.append("uploadToken", photoTicket.token);
  customerChunk.append("part", "0");
  customerChunk.append("chunk", new Blob([png]), "chunk.bin");
  ok(await call("/api/reviews/upload-chunk", { method: "POST", body: customerChunk }, false));
  ok(
    await call(
      "/api/reviews/upload-complete",
      {
        method: "POST",
        body: JSON.stringify({
          ...customerPayload,
          uploadToken: photoTicket.token,
        }),
      },
      false,
    ),
  );
  console.log("PASS: authenticated 2 MB chunk upload, exact assembly, invalid part rejection and customer relay");
  console.log("ALL ISOLATED INTEGRATION CHECKS PASSED");
} finally {
  await prisma.$disconnect();
  await new Promise((r) => api.close(r));
  await new Promise((r) => storage.close(r));
  await socket.stop();
  await db.close();
}
process.exit(0);
