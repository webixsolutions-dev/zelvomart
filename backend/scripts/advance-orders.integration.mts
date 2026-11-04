// Advance payment orders through the real POST /api/orders on PGlite: COD unchanged, the advance discount computed on
// the server from the settings (never from the client), the minimum, the coupon/delivery rules kept, ON_HOLD +
// AWAITING_PAYMENT, the payment link, the production demo guard, and storefront numbers equal to the backend's.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
const require = createRequire(import.meta.url);
const delivery = require("@zelvomart/delivery");

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
const socket = new PGLiteSocketServer({ db, port: 55481, host: "127.0.0.1" });
await socket.start();
Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55481/postgres",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:55481/postgres",
  DATABASE_SSL: "false",
  DATABASE_POOL_MAX: "1",
  JWT_SECRET: "isolated-local-advance-test-secret-only",
  JOB_MODE: "cron",
  VERCEL: "1",
  REVALIDATION_SECRET: "",
  RESEND_API_KEY: "",
});
delete process.env.APP_ENV;
const { prisma } = await import("../src/lib/db");
const { app } = await import("../src/server");
const { forgetSettings } = await import("../src/lib/settings");
const { paymentToken, paymentTokenMatches } = await import("../src/lib/advance-payment");

const deliveryRule = { mode: "FREE_ABOVE", flatRate: 190, freeAbove: 7500 };
await prisma.setting.create({ data: { key: "store.delivery", value: deliveryRule } });
await prisma.city.create({ data: { name: "Lahore" } });
await prisma.coupon.create({ data: { code: "SAVE100", type: "FIXED", amount: 100, active: true } });
const product = await prisma.product.create({
  data: { title: "Steel Bottle", slug: "bottle", sku: "SB", price: 1500, status: "PUBLISHED", bundleEnabled: false },
});
async function setAdvance(value: Record<string, unknown>) {
  await prisma.setting.upsert({
    where: { key: "payments.advance" },
    update: { value: value as any },
    create: { key: "payments.advance", value: value as any },
  });
  forgetSettings();
}

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let n = 0;
async function order(paymentMethod: string, quantity: number, extra: Record<string, unknown> = {}) {
  n++;
  const response = await fetch(base + "/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      fullName: "Advance Test",
      phone: `0300${String(2000000 + n)}`,
      city: "Lahore",
      address: "House 12, Street 4, Model Town",
      paymentMethod,
      cart: [{ productId: product.id, quantity, bundleSize: 1 }],
      ...extra,
    }),
  });
  return { status: response.status, body: (await response.json()) as any };
}
// What the storefront checkout shows for the same cart (packages/delivery, as the storefront uses it).
function storefrontTotal(subtotal: number, coupon: number, advance: Record<string, unknown> | null) {
  const fee = delivery.deliveryForCart(
    [{ freeShipping: false }],
    subtotal,
    delivery.resolveDeliveryPolicy(deliveryRule),
  ).fee;
  const before = subtotal + fee - coupon;
  const off = advance ? delivery.advanceDiscountFor(subtotal, before, delivery.resolveAdvancePolicy(advance)) : 0;
  return { fee, off, total: before - off };
}

// COD: exactly as before.
{
  const r = await order("COD", 2);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual([r.body.total, r.body.advanceDiscount, r.body.payToken], [3190, 0, undefined]);
  const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } });
  assert.deepEqual([row.status, row.paymentStatus, row.paymentTokenHash], ["NEW", "NOT_REQUIRED", null]);
  console.log("ok - COD unchanged");
}

// Advance with the defaults (off, demo values): available off production, Rs 200 off, no minimum.
{
  const r = await order("ADVANCE_EASYPAISA", 2);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const expected = storefrontTotal(3000, 0, {});
  assert.deepEqual([r.body.advanceDiscount, r.body.total], [200, expected.total]);
  assert.equal(r.body.total, 2990, "3000 + 190 delivery − 200");
  assert.equal(r.body.payToken, paymentToken(r.body.orderNumber));
  assert.equal(r.body.payPath, `/pay/${r.body.orderNumber}/?t=${encodeURIComponent(r.body.payToken)}`);
  const row = await prisma.order.findUniqueOrThrow({
    where: { orderNumber: r.body.orderNumber },
    include: { statusHistory: true },
  });
  assert.deepEqual([row.status, row.paymentStatus, Number(row.advanceDiscount)], ["ON_HOLD", "AWAITING_PAYMENT", 200]);
  assert.equal(row.statusHistory[0].note, "Waiting for advance payment.");
  assert.equal(paymentTokenMatches(r.body.payToken, row.paymentTokenHash), true);
  assert.notEqual(row.paymentTokenHash, r.body.payToken, "only the hash is stored");
  const names = async (id: string) =>
    (await prisma.job.findMany({ where: { orderId: id }, select: { name: true } })).map((j) => j.name).sort();
  const cod = await prisma.order.findFirstOrThrow({ where: { paymentMethod: "COD" } });
  assert.deepEqual(await names(row.id), await names(cod.id), "same emails and events as a COD order");
  console.log("ok - advance order on hold, Rs 200 off, payment link");
}

// Minimum subtotal, a coupon and the client cannot set the discount.
{
  const settings = { discount: 200, minSubtotal: 4000 };
  await setAdvance(settings);
  const below = await order("ADVANCE_EASYPAISA", 2, { advanceDiscount: 5000, total: 1 });
  assert.equal(below.status, 201);
  assert.deepEqual([below.body.advanceDiscount, below.body.total], [0, 3190], "below the minimum: no discount");
  const above = await order("ADVANCE_EASYPAISA", 3, { couponCode: "SAVE100" });
  const expected = storefrontTotal(4500, 100, settings);
  assert.deepEqual(
    [above.body.deliveryFee, above.body.discount, above.body.advanceDiscount, above.body.total],
    [expected.fee, 100, expected.off, expected.total],
    "storefront numbers = backend numbers",
  );
  assert.equal(above.body.total, 4500 + 190 - 100 - 200);
  console.log("ok - minimum, coupon, server-side discount, storefront = backend");
}

// Same checkout retried: same order and same payment link.
{
  const key = randomUUID();
  const body = (extra = {}) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: key,
      fullName: "Retry",
      phone: "03009999999",
      city: "Lahore",
      address: "House 12, Street 4, Model Town",
      paymentMethod: "ADVANCE_EASYPAISA",
      cart: [{ productId: product.id, quantity: 1, bundleSize: 1 }],
      ...extra,
    }),
  });
  const a = (await (await fetch(base + "/api/orders", body())).json()) as any;
  const b = (await (await fetch(base + "/api/orders", body())).json()) as any;
  assert.deepEqual([b.orderNumber, b.payToken], [a.orderNumber, a.payToken]);
  console.log("ok - a retried checkout gets the same order and link");
}

// Production: hidden while demo values or disabled, works once enabled with real values.
{
  process.env.APP_ENV = "production";
  await setAdvance({ enabled: true, tillId: "DEMO-TILL", qrImageUrl: "" });
  const demo = await order("ADVANCE_EASYPAISA", 1);
  assert.equal(demo.status, 400);
  assert.equal(demo.body.error, "ADVANCE_PAYMENT_UNAVAILABLE");
  await setAdvance({ enabled: false, tillId: "981234567", qrImageUrl: "https://media.zelvomart.com/qr.png" });
  assert.equal((await order("ADVANCE_EASYPAISA", 1)).body.error, "ADVANCE_PAYMENT_UNAVAILABLE", "disabled");
  await setAdvance({ enabled: true, tillId: "981234567", qrImageUrl: "https://media.zelvomart.com/qr.png" });
  const live = await order("ADVANCE_EASYPAISA", 1);
  assert.equal(live.status, 201, JSON.stringify(live.body));
  assert.equal((await order("COD", 1)).status, 201, "COD unaffected in production");
  delete process.env.APP_ENV;
  console.log("ok - production guard");
}

// The confirmation page (key holder) gets the payment link but never the token hash.
{
  const r = await order("ADVANCE_EASYPAISA", 1);
  const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } });
  const c = (await (await fetch(`${base}/api/orders/confirmation/${row.orderNumber}?key=${row.id}`)).json()) as any;
  assert.equal(c.payPath, r.body.payPath);
  assert.equal("paymentTokenHash" in c, false);
  console.log("ok - confirmation carries the link, not the hash");
}

// Checkout offer: demo off production; hidden in production on demo values.
{
  await setAdvance({});
  const offer = (await (await fetch(`${base}/api/payments/advance`)).json()) as any;
  assert.deepEqual(offer, { available: true, demo: true, accountName: "Zelvomart", discount: 200, minSubtotal: 0 });
  process.env.APP_ENV = "production";
  assert.deepEqual(await (await fetch(`${base}/api/payments/advance`)).json(), { available: false });
  delete process.env.APP_ENV;
  console.log("ok - checkout offer and production demo guard");
}

// Payment page: token required, first name only, switch to COD before any proof.
{
  const r = await order("ADVANCE_EASYPAISA", 2);
  const url = (t: string, extra = "") => `${base}/api/pay/${r.body.orderNumber}${extra}?t=${encodeURIComponent(t)}`;
  for (const bad of ["", "wrong", paymentToken("ZM-1")])
    assert.equal((await fetch(url(bad))).status, 404, `bad token ${JSON.stringify(bad)}`);
  assert.equal((await fetch(`${base}/api/pay/${r.body.orderNumber}`)).status, 404, "missing token");
  assert.equal((await fetch(`${base}/api/pay/ZM-999999?t=${r.body.payToken}`)).status, 404, "other order");
  const page = (await (await fetch(url(r.body.payToken))).json()) as any;
  assert.deepEqual(
    [page.firstName, page.total, page.advanceDiscount, page.paymentStatus, page.tillId, page.demo, page.canSwitchToCod],
    ["Advance", 2990, 200, "AWAITING_PAYMENT", "DEMO-TILL", true, true],
  );
  assert.equal(page.qrUrl, "/images/payments/demo-raast-qr.png");
  const raw = JSON.stringify(page);
  for (const secret of ["0300", "Model Town", "Advance Test", "paymentTokenHash"])
    assert.equal(raw.includes(secret), false, `no ${secret} on the payment page`);

  const switched = await fetch(url(r.body.payToken, "/cod"), { method: "POST" });
  assert.equal(switched.status, 200);
  const after = (await switched.json()) as any;
  assert.deepEqual(
    [after.paymentMethod, after.paymentStatus, after.total, after.advanceDiscount, after.canSwitchToCod],
    ["COD", "NOT_REQUIRED", 3190, 0, false],
  );
  const row = await prisma.order.findUniqueOrThrow({
    where: { orderNumber: r.body.orderNumber },
    include: { statusHistory: { orderBy: { createdAt: "desc" } } },
  });
  assert.deepEqual([row.status, Number(row.total), row.paymentMethod], ["NEW", 3190, "COD"]);
  assert.match(row.statusHistory[0].note || "", /Cash on Delivery/);
  assert.equal((await fetch(url(r.body.payToken, "/cod"), { method: "POST" })).status, 409, "only once");
  console.log("ok - payment page token, privacy, switch to COD");
}

// A proof already sent blocks the switch.
{
  const r = await order("ADVANCE_EASYPAISA", 1);
  const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } });
  await prisma.paymentProof.create({
    data: { orderId: row.id, tid: "T1", amountSent: 1490, senderName: "X", screenshotKey: "k", sha256: "s" },
  });
  const res = await fetch(`${base}/api/pay/${r.body.orderNumber}/cod?t=${encodeURIComponent(r.body.payToken)}`, {
    method: "POST",
  });
  assert.equal(res.status, 409);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: row.id } })).paymentMethod, "ADVANCE_EASYPAISA");
  console.log("ok - no switch after a proof");
}

server.close();
await prisma.$disconnect();
await socket.stop();
await db.close();
console.log("All advance order tests passed.");
process.exit(0);
