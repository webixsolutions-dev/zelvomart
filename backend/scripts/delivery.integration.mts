// The delivery fee saved by the real order endpoint (POST /api/orders) equals the storefront's amount for every
// shared case in packages/delivery/cases.json (frontend/scripts/delivery.test.ts checks the storefront side).
// In-process PostgreSQL (PGlite); nothing leaves this machine.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
const require = createRequire(import.meta.url);
const { policy, products, cases } = require("@zelvomart/delivery/cases.json") as {
  policy: { flatRate: number; freeAbove: number };
  products: Record<string, { price: number; freeShipping: boolean }>;
  cases: { name: string; lines: [string, number][]; coupon?: string; fee: number }[];
};

const db = await PGlite.create();
await db.exec(
  execFileSync(
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
  ),
);
const socket = new PGLiteSocketServer({ db, port: 55471, host: "127.0.0.1" });
await socket.start();
Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55471/postgres",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:55471/postgres",
  DATABASE_SSL: "false",
  DATABASE_POOL_MAX: "1",
  JWT_SECRET: "isolated-local-delivery-test-secret-only",
  JOB_MODE: "cron",
  VERCEL: "1",
  REVALIDATION_SECRET: "",
  RESEND_API_KEY: "",
});
const { prisma } = await import("../src/lib/db");
const { app } = await import("../src/server");

await prisma.setting.create({
  data: {
    key: "store.delivery",
    value: { mode: "FREE_ABOVE", flatRate: policy.flatRate, freeAbove: policy.freeAbove },
  },
});
await prisma.city.create({ data: { name: "Lahore" } });
await prisma.coupon.create({ data: { code: "SAVE500", type: "FIXED", amount: 500, active: true } });
const ids: Record<string, string> = {};
for (const [key, p] of Object.entries(products)) {
  const row = await prisma.product.create({
    data: {
      title: `Product ${key}`,
      slug: key.toLowerCase(),
      sku: key.toUpperCase(),
      price: p.price,
      status: "PUBLISHED",
      bundleEnabled: false,
      sourceUrl: JSON.stringify({ zvmCatalog: { freeShipping: p.freeShipping } }),
    },
  });
  ids[key] = row.id;
}

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let n = 0;
for (const c of cases) {
  n++;
  const response = await fetch(base + "/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      fullName: "Delivery Test",
      phone: `0300${String(1000000 + n)}`,
      city: "Lahore",
      address: "House 12, Street 4, Model Town",
      paymentMethod: "COD",
      ...(c.coupon ? { couponCode: c.coupon } : {}),
      cart: c.lines.map(([key, quantity]) => ({ productId: ids[key], quantity, bundleSize: 1 })),
    }),
  });
  const body = (await response.json()) as { deliveryFee?: number; total?: number; subtotal?: number; error?: string };
  assert.equal(response.status, 201, `${c.name}: ${JSON.stringify(body)}`);
  assert.equal(body.deliveryFee, c.fee, c.name);
  const subtotal = c.lines.reduce((sum, [key, qty]) => sum + products[key].price * qty, 0);
  assert.equal(body.subtotal, subtotal, `${c.name}: subtotal`);
  console.log(`PASS: ${c.name} → delivery Rs ${body.deliveryFee}, total Rs ${body.total}`);
}

// Concurrent requests and a retry after the last stock item was sold must recover the one saved order.
{
  const product = await prisma.product.create({
    data: {
      title: "Retry stock",
      slug: "retry-stock",
      sku: "RETRY-STOCK",
      price: 1200,
      status: "PUBLISHED",
      stock: 1,
      trackStock: true,
    },
  });
  await prisma.coupon.create({ data: { code: "RETRY100", type: "FIXED", amount: 100, active: true } });
  const payload = {
    idempotencyKey: randomUUID(),
    fullName: "Retry Customer",
    phone: "03007771234",
    city: "Unlisted Test Town",
    address: "House 15, Street 4",
    orderNotes: "Please call",
    paymentMethod: "COD",
    couponCode: "RETRY100",
    cart: [{ productId: product.id, quantity: 1, bundleSize: 1 }],
  };
  const post = (body = payload) =>
    fetch(base + "/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const responses = await Promise.all([post(), post()]);
  const bodies = (await Promise.all(responses.map((response) => response.json()))) as any[];
  assert.deepEqual(
    responses.map((response) => response.status),
    [201, 201],
    JSON.stringify(bodies),
  );
  assert.equal(bodies[0].id, bodies[1].id);
  assert.equal(await prisma.order.count({ where: { idempotencyKey: payload.idempotencyKey } }), 1);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 0);
  assert.equal((await prisma.coupon.findUniqueOrThrow({ where: { code: "RETRY100" } })).usedCount, 1);
  assert.equal(await prisma.job.count({ where: { orderId: bodies[0].id, name: "customer-order-email" } }), 1);
  assert.equal((await post()).status, 201, "retry works even though stock is now zero");
  const mismatch = await post({ ...payload, address: "A different delivery address" });
  assert.equal(mismatch.status, 400);
  assert.equal(((await mismatch.json()) as any).error, "CHECKOUT_KEY_REUSED");
  const original = prisma.order.findUnique;
  prisma.order.findUnique = async () => {
    throw new Error("prisma private/path INTERNAL_QUERY");
  };
  try {
    const failed = await post();
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { error: "ORDER_TEMPORARILY_UNAVAILABLE" });
  } finally {
    prisma.order.findUnique = original;
  }
  console.log("PASS: simultaneous checkout, stock, coupon and jobs are idempotent; database errors stay private");
}

// The scheduled recording switch also stops already-open clients from uploading more snapshots.
{
  const { setSetting } = await import("../src/lib/settings");
  await setSetting("tracking.sessionReplayEnabled", false);
  for (const route of ["start", "chunk"]) {
    const result = await fetch(`${base}/api/session-replays/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(result.status, 403);
    assert.deepEqual(await result.json(), { error: "REPLAY_DISABLED" });
  }
  console.log("PASS: disabled recording rejects new sessions and chunks");
}

{
  const eventId = randomUUID();
  const result = await fetch(`${base}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 browser fixture" },
    body: JSON.stringify({
      eventName: "PageView",
      eventId,
      sourceUrl: "https://www.zelvomart.com/pay/ZM-1/?t=PRIVATE_PAYMENT&key=CONFIRM_SECRET&utm_source=test",
      params: { href: "/pay/ZM-1/?t=PRIVATE_PAYMENT" },
    }),
  });
  assert.equal(result.status, 200);
  const event = await prisma.eventLog.findFirstOrThrow({ where: { eventId } });
  for (const secret of ["PRIVATE_PAYMENT", "CONFIRM_SECRET"])
    assert.equal(JSON.stringify(event).includes(secret), false);
  assert.ok(event.sourceUrl?.includes("utm_source=test"));
  console.log("PASS: stored event metadata and raw payload both redact private payment credentials");
}

server.close();
await prisma.$disconnect();
await socket.stop();
await db.close();
console.log("All delivery tests passed.");
process.exit(0);
