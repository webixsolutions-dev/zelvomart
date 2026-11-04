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

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
const proofDir = mkdtempSync(path.join(tmpdir(), "zm-proofs-"));
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
// The partial unique index on live TIDs is written by hand in the migration (Prisma cannot express it).
await db.exec(
  `CREATE UNIQUE INDEX "PaymentProof_tidNormalized_live_key" ON "PaymentProof"("tidNormalized") WHERE "tidNormalized" IS NOT NULL AND "status" <> 'REJECTED';`,
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
  PAYMENT_PROOF_LOCAL_DIR: proofDir,
  STORE_PROXY_SECRET: "isolated-proxy-secret",
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

// Payment proof upload: real multipart through the route, private storage, metadata removed, flags, resubmission.
const { runAdvanceSweep } = await import("../src/lib/advance-sweep");
const shot = (seed: number) =>
  sharp({ create: { width: 500, height: 1000, channels: 3, background: { r: 30 + seed * 9, g: 140, b: 210 } } })
    .composite([
      {
        input: Buffer.from(
          `<svg width="500" height="1000"><rect x="30" y="${80 + seed * 13}" width="${260 + seed * 7}" height="140" fill="#000"/><circle cx="${120 + seed * 17}" cy="700" r="110" fill="#fff"/></svg>`,
        ),
      },
    ])
    .withExif({ IFD0: { Artist: "secret-phone-owner" } })
    .jpeg()
    .toBuffer();
async function sendProof(
  orderNumber: string,
  token: string,
  fields: Record<string, string>,
  file: Buffer | null = null,
  type = "image/jpeg",
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set("screenshot", new Blob([new Uint8Array(file)], { type }), "proof.jpg");
  const res = await fetch(`${base}/api/pay/${orderNumber}/proof?t=${encodeURIComponent(token)}`, {
    method: "POST",
    body: form,
    // As the storefront proxy sends it: a different shopper IP per call, so the per-IP limit is not the one tested.
    headers: {
      "x-zm-proxy-secret": "isolated-proxy-secret",
      "x-zm-client-ip": `10.9.${n}.${Math.floor(Math.random() * 250)}`,
    },
  });
  return { status: res.status, body: (await res.json()) as any };
}
const good = (amount: number, tid = "41000" + String(n).padStart(5, "0")) => ({
  method: "TILL",
  tid,
  amount: String(amount),
  senderName: "Ali Raza",
  senderLast4: "4321",
});
await setAdvance({});
{
  const r = await order("ADVANCE_EASYPAISA", 1);
  const { orderNumber, payToken, total } = r.body;
  const tid1 = good(total).tid;
  assert.equal((await sendProof(orderNumber, "wrong", good(total), await shot(1))).status, 404, "token");
  const missing = await sendProof(orderNumber, payToken, good(total));
  assert.deepEqual([missing.status, missing.body.error], [400, "PROOF_SCREENSHOT_REQUIRED"]);
  const badTid = await sendProof(orderNumber, payToken, { ...good(total), tid: "12" }, await shot(1));
  assert.deepEqual([badTid.status, badTid.body.error], [400, "PROOF_FIELDS_INVALID"]);
  const notImage = await sendProof(orderNumber, payToken, good(total), Buffer.from("hello"), "image/png");
  assert.deepEqual([notImage.status, notImage.body.error], [400, "PROOF_IMAGE_INVALID"]);
  const gif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#f00" } })
    .gif()
    .toBuffer();
  assert.equal((await sendProof(orderNumber, payToken, good(total), gif, "image/gif")).status, 400, "gif");
  const huge = await sendProof(orderNumber, payToken, good(total), Buffer.alloc(5 * 1024 * 1024 + 10));
  assert.deepEqual([huge.status, huge.body.error], [413, "PROOF_TOO_LARGE"]);
  assert.equal(await prisma.paymentProof.count({ where: { order: { orderNumber } } }), 0, "nothing saved");

  const sent = await sendProof(orderNumber, payToken, good(total), await shot(1));
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.deepEqual(
    [sent.body.paymentStatus, sent.body.proof.status, sent.body.proof.amountSent, sent.body.canSubmitProof],
    ["SUBMITTED", "SUBMITTED", total, false],
  );
  assert.equal(sent.body.canSwitchToCod, false, "no COD switch after a proof");
  const raw = JSON.stringify(sent.body);
  for (const secret of ["4321", "Ali Raza", "41000", "payment-proofs", "sha256"])
    assert.equal(raw.includes(secret), false, `no ${secret} in the public answer`);
  const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, include: { paymentProofs: true } });
  assert.deepEqual([row.status, row.paymentStatus], ["ON_HOLD", "SUBMITTED"], "never paid automatically");
  const proof = row.paymentProofs[0];
  assert.match(proof.screenshotKey, /^payment-proofs\/ZM-\d+\/[0-9a-f]{24}\.webp$/);
  const stored = readFileSync(path.join(proofDir, proof.screenshotKey));
  const meta = await sharp(stored).metadata();
  assert.deepEqual([meta.format, meta.exif], ["webp", undefined]);
  assert.equal(stored.includes(Buffer.from("secret-phone-owner")), false, "EXIF removed");
  assert.match(proof.sha256, /^[0-9a-f]{64}$/);
  assert.match(proof.dhash || "", /^[0-9a-f]{16}$/);
  assert.deepEqual(
    [proof.tidNormalized, proof.amountMismatch, proof.tidDuplicate, proof.imageDuplicate],
    [tid1, false, false, false],
  );
  const jobs = await prisma.job.findMany({ where: { orderId: row.id, name: { startsWith: "advance-proof" } } });
  assert.deepEqual(jobs.map((job) => job.name).sort(), ["advance-proof-customer-email", "advance-proof-team-email"]);
  assert.equal((await sendProof(orderNumber, payToken, good(total), await shot(2))).status, 409, "one proof");
  assert.equal(
    (await fetch(`${base}/api/pay/${orderNumber}/cod?t=${encodeURIComponent(payToken)}`, { method: "POST" })).status,
    409,
  );

  // Same TID and the same screenshot (re-saved smaller) on another order: both flagged, stored, still SUBMITTED.
  const other = await order("ADVANCE_EASYPAISA", 1);
  const resaved = await sharp(await shot(1))
    .resize(380)
    .jpeg({ quality: 60 })
    .toBuffer();
  const dup = await sendProof(other.body.orderNumber, other.body.payToken, good(total, tid1), resaved);
  assert.equal(dup.status, 201, JSON.stringify(dup.body));
  const dupRow = await prisma.paymentProof.findFirstOrThrow({
    where: { order: { orderNumber: other.body.orderNumber } },
  });
  assert.deepEqual(
    [dupRow.tidDuplicate, dupRow.tidNormalized, dupRow.imageDuplicate, dupRow.status],
    [true, null, true, "SUBMITTED"],
  );
  console.log("ok - proof upload: validation, private storage, metadata removed, flags, no public data");
}

// Amount mismatch, one resubmission, then closed.
{
  const r = await order("ADVANCE_EASYPAISA", 1);
  const { orderNumber, payToken, total } = r.body;
  const tid2 = good(total).tid;
  const off = await sendProof(orderNumber, payToken, good(total - 400, tid2), await shot(5));
  assert.deepEqual(
    [off.status, off.body.paymentStatus, off.body.canSubmitProof, off.body.proofsLeft],
    [201, "MISMATCH", true, 1],
  );
  // Correcting the amount with the same TID on the same order is not a duplicate.
  const again = await sendProof(orderNumber, payToken, good(total, tid2), await shot(6));
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.deepEqual(
    [again.body.paymentStatus, again.body.canSubmitProof, again.body.proofsLeft],
    ["SUBMITTED", false, 0],
  );
  const proofs = await prisma.paymentProof.findMany({
    where: { order: { orderNumber } },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    proofs.map((p) => [p.status, p.tidDuplicate]),
    [
      ["MISMATCH", false],
      ["SUBMITTED", false],
    ],
  );
  assert.equal((await sendProof(orderNumber, payToken, good(total), await shot(7))).status, 409, "no third proof");
  console.log("ok - mismatch and one resubmission");
}

// Reminder once after reminderHours, EXPIRED after expiryHours (never cancelled); a late proof is still accepted.
{
  await setAdvance({ reminderHours: 2, expiryHours: 24 });
  const r = await order("ADVANCE_EASYPAISA", 1, { email: "buyer@example.com" });
  const id = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } })).id;
  const at = (hours: number) =>
    prisma.order.update({ where: { id }, data: { createdAt: new Date(Date.now() - hours * 3_600_000) } });
  await at(1);
  await runAdvanceSweep();
  assert.equal(await prisma.job.count({ where: { orderId: id, name: "advance-reminder-email" } }), 0, "too early");
  await at(3);
  await runAdvanceSweep();
  await runAdvanceSweep();
  assert.equal(await prisma.job.count({ where: { orderId: id, name: "advance-reminder-email" } }), 1, "exactly one");
  await at(25);
  const swept = await runAdvanceSweep();
  assert.ok(swept.expired >= 1);
  const row = await prisma.order.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([row.status, row.paymentStatus], ["ON_HOLD", "EXPIRED"]);
  const late = await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total), await shot(9));
  assert.deepEqual([late.status, late.body.paymentStatus], [201, "SUBMITTED"]);
  console.log("ok - reminder once, expiry without cancelling, late proof");
}

// Production with no private bucket: the upload is refused (never written to the server's disk).
{
  const r = await order("ADVANCE_EASYPAISA", 1);
  process.env.APP_ENV = "production";
  const res = await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total), await shot(11));
  delete process.env.APP_ENV;
  assert.deepEqual([res.status, res.body.error], [503, "PROOF_STORAGE_NOT_CONFIGURED"]);
  console.log("ok - production needs the private bucket");
}

// Emails (Resend intercepted): order email carries the pay link; team proof email warns and has no screenshot;
// customer gets the exact "pending verification" message; the reminder is skipped once a proof is in.
{
  const sent: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url || input);
    if (!url.startsWith("https://api.resend.com")) return realFetch(input, init);
    sent.push(JSON.parse(String(init?.body || "{}")));
    return new Response(JSON.stringify({ id: `email-${sent.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  process.env.RESEND_API_KEY = "re_isolated_test";
  const { processJobRow } = await import("../src/lib/job-processor");
  try {
    await setAdvance({ verificationHours: "10am – 8pm" });
    const r = await order("ADVANCE_EASYPAISA", 1, { email: "buyer@example.com" });
    const id = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } })).id;
    const runAll = async (name: string) => {
      for (const job of await prisma.job.findMany({ where: { orderId: id, name } })) {
        await prisma.job.update({ where: { id: job.id }, data: { status: "QUEUED", attempts: 0 } });
        await processJobRow(job.id);
      }
    };
    await runAll("customer-order-email");
    await runAll("order-team-email");
    const orderMail = sent.find((m) => m.to === "buyer@example.com" || m.to?.[0] === "buyer@example.com");
    assert.ok(orderMail, "customer order email");
    assert.ok(orderMail.html.includes(`/pay/${r.body.orderNumber}/?t=${r.body.payToken}`), "pay link in the email");
    assert.match(orderMail.html, /Cash on Delivery instead/);
    assert.equal(orderMail.html.includes("pay cash when your parcel arrives"), false);
    const teamOrder = sent.find((m) => String(m.subject).includes("New order • advance payment pending"));
    assert.ok(teamOrder, "team order subject says not paid yet");

    const tid = "EMAILTID" + n;
    const proof = await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total, tid), await shot(14));
    assert.equal(proof.status, 201);
    sent.length = 0;
    await runAll("advance-proof-team-email");
    await runAll("advance-proof-customer-email");
    const team = sent.find((m) => String(m.subject).startsWith("[Orders]"));
    assert.match(team.subject, new RegExp(`${r.body.orderNumber} • Advance payment proof`));
    assert.match(team.html, /A screenshot is never proof on its own/);
    assert.ok(team.html.includes(tid));
    assert.equal(/payment-proofs\/|\.webp/.test(team.html), false, "no screenshot link or key in email");
    const customer = sent.find((m) => !String(m.subject).startsWith("[Orders]"));
    assert.match(customer.subject, /Payment proof received/);
    assert.match(
      customer.html,
      /Order received – advance payment pending verification\.[\s\S]*We verify during 10am – 8pm and confirm on WhatsApp\/email\. Your order is safe\./,
    );
    // A reminder that was due before the proof arrived is skipped, not sent.
    await prisma.job.create({ data: { name: "advance-reminder-email", orderId: id, payload: { orderId: id } } });
    sent.length = 0;
    await runAll("advance-reminder-email");
    assert.equal(sent.length, 0);
    console.log("ok - emails: pay link, team warning without screenshot, customer message, reminder skipped");
  } finally {
    globalThis.fetch = realFetch;
    process.env.RESEND_API_KEY = "";
  }
}
rmSync(proofDir, { recursive: true, force: true });

server.close();
await prisma.$disconnect();
await socket.stop();
await db.close();
console.log("All advance order tests passed.");
process.exit(0);
