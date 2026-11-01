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

server.close();
await prisma.$disconnect();
await socket.stop();
await db.close();
console.log("All delivery tests passed.");
process.exit(0);
