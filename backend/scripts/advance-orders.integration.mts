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
const { normalizeTid } = await import("../src/lib/payment-proof");

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
  assert.deepEqual(await names(row.id), [], "nothing at checkout: no email, no Purchase until a proof or COD");
  assert.ok((await names(cod.id)).includes("customer-order-email"), "COD unchanged: emails at checkout");
  console.log("ok - advance order on hold, Rs 200 off, payment link, nothing sent at checkout");
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
  // Neither a screenshot nor the TID + amount: refused on the server too.
  const neither = await sendProof(orderNumber, payToken, { method: "TILL", senderName: "Ali Raza" });
  assert.deepEqual([neither.status, neither.body.error], [400, "PROOF_SCREENSHOT_OR_DETAILS"]);
  assert.match(neither.body.message, /Upload your payment screenshot, or enter the TID and amount from your receipt\./);
  const tidOnly = await sendProof(orderNumber, payToken, { method: "TILL", tid: "41234567890" });
  assert.equal(tidOnly.body.error, "PROOF_SCREENSHOT_OR_DETAILS", "TID without amount and no screenshot");
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
  assert.match(proof.screenshotKey!, /^payment-proofs\/ZM-\d+\/[0-9a-f]{24}\.webp$/);
  const stored = readFileSync(path.join(proofDir, proof.screenshotKey!));
  const meta = await sharp(stored).metadata();
  assert.deepEqual([meta.format, meta.exif], ["webp", undefined]);
  assert.equal(stored.includes(Buffer.from("secret-phone-owner")), false, "EXIF removed");
  assert.match(proof.sha256!, /^[0-9a-f]{64}$/);
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

// Screenshot OR details: either alone is enough (owner decision), on the server as in the form.
{
  // Screenshot only: saved with no TID/amount, flagged "details missing" until auto-read or staff fill them.
  const a = await order("ADVANCE_EASYPAISA", 1);
  const shotOnly = await sendProof(a.body.orderNumber, a.body.payToken, { method: "RAAST_QR" }, await shot(60));
  assert.equal(shotOnly.status, 201, JSON.stringify(shotOnly.body));
  const pa = await prisma.paymentProof.findFirstOrThrow({ where: { order: { orderNumber: a.body.orderNumber } } });
  assert.deepEqual(
    [pa.tid, pa.amountSent, pa.senderName, pa.detailsMissing, pa.amountMismatch, pa.status, !!pa.screenshotKey],
    [null, null, "", true, false, "SUBMITTED", true],
  );
  // Details only: no screenshot stored, nothing missing.
  const b = await order("ADVANCE_EASYPAISA", 1);
  const detailsOnly = await sendProof(b.body.orderNumber, b.body.payToken, {
    method: "TILL",
    tid: "DETAILSONLY" + n,
    amount: String(b.body.total),
  });
  assert.equal(detailsOnly.status, 201, JSON.stringify(detailsOnly.body));
  const pb = await prisma.paymentProof.findFirstOrThrow({ where: { order: { orderNumber: b.body.orderNumber } } });
  assert.deepEqual(
    [pb.screenshotKey, pb.sha256, pb.detailsMissing, pb.senderName, Number(pb.amountSent)],
    [null, null, false, "", b.body.total],
  );
  console.log("ok - screenshot only passes (details missing flag), details only pass, neither is refused");
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

// "Complete your payment" after firstReminderMinutes, the second reminder after reminderHours (each once), EXPIRED
// after expiryHours (never cancelled); a late proof is still accepted.
{
  await setAdvance({ firstReminderMinutes: 30, reminderHours: 2, expiryHours: 24 });
  const r = await order("ADVANCE_EASYPAISA", 1, { email: "buyer@example.com" });
  const id = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } })).id;
  const at = (hours: number) =>
    prisma.order.update({ where: { id }, data: { createdAt: new Date(Date.now() - hours * 3_600_000) } });
  const count = (name: string) => prisma.job.count({ where: { orderId: id, name } });
  await at(0.25);
  await runAdvanceSweep();
  assert.equal(await count("advance-first-reminder-email"), 0, "15 minutes: too early");
  await at(0.6);
  await runAdvanceSweep();
  await runAdvanceSweep();
  assert.equal(await count("advance-first-reminder-email"), 1, "30 minutes: exactly one first reminder");
  assert.equal(await count("advance-reminder-email"), 0, "second reminder not yet");
  await at(3);
  await runAdvanceSweep();
  await runAdvanceSweep();
  assert.deepEqual(
    [await count("advance-first-reminder-email"), await count("advance-reminder-email")],
    [1, 1],
    "2 hours: exactly one second reminder",
  );
  // An order the sweep first sees after 2 hours gets only the second reminder, not both at once.
  {
    const late = await order("ADVANCE_EASYPAISA", 1, { email: "late@example.com" });
    const lateId = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: late.body.orderNumber } })).id;
    await prisma.order.update({ where: { id: lateId }, data: { createdAt: new Date(Date.now() - 3 * 3_600_000) } });
    await runAdvanceSweep();
    assert.deepEqual(
      (await prisma.job.findMany({ where: { orderId: lateId }, select: { name: true } })).map((j) => j.name),
      ["advance-reminder-email"],
    );
  }
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
    sent.push({
      ...JSON.parse(String(init?.body || "{}")),
      idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
    });
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
    // Checkout: nothing. An order email queued by hand is still refused while the payment is unverified.
    assert.equal(await prisma.job.count({ where: { orderId: id } }), 0, "no email or event at checkout");
    const { enqueueOrderEmails } = await import("../src/lib/advance-jobs");
    await prisma.$transaction((tx) => enqueueOrderEmails(tx, id, "advance-paid"));
    await runAll("customer-order-email");
    await runAll("order-team-email");
    assert.equal(sent.length, 0, "no order confirmation before the payment is accepted");

    // 30 minutes: "Complete your payment" with the pay link and the COD way out.
    await prisma.job.create({ data: { name: "advance-first-reminder-email", orderId: id, payload: { orderId: id } } });
    await runAll("advance-first-reminder-email");
    const first = sent.find((m) => m.to === "buyer@example.com" || m.to?.[0] === "buyer@example.com");
    assert.match(first.subject, new RegExp(`Complete your payment • ${r.body.orderNumber}`));
    assert.ok(first.html.includes(`/pay/${r.body.orderNumber}/?t=${r.body.payToken}`), "pay link in the email");
    assert.match(first.html, /Cash on Delivery instead/);

    // Proof: team "Advance payment to verify", customer "Payment received – we are verifying", and the Purchase.
    // Orders placed outside the storefront are test orders (no Purchase); treat this one as a real order.
    await prisma.order.update({ where: { id }, data: { test: false } });
    const tid = "EMAILTID" + n;
    const proof = await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total, tid), await shot(14));
    assert.equal(proof.status, 201);
    sent.length = 0;
    await runAll("advance-proof-team-email");
    await runAll("advance-proof-customer-email");
    const team = sent.find((m) => String(m.subject).startsWith("[Orders]"));
    assert.match(team.subject, new RegExp(`${r.body.orderNumber} • Advance payment to verify`));
    assert.match(team.html, /A screenshot is never proof on its own/);
    assert.ok(team.html.includes(tid));
    assert.equal(/payment-proofs\/|\.webp/.test(team.html), false, "no screenshot link or key in email");
    const customer = sent.find((m) => !String(m.subject).startsWith("[Orders]"));
    assert.match(customer.subject, /Payment received – we are verifying/);
    assert.match(
      customer.html,
      /Payment received – we are verifying\.[\s\S]*We verify during 10am – 8pm and confirm on WhatsApp\/email\. Your order is safe\./,
    );
    const purchase = await prisma.job.findFirstOrThrow({ where: { orderId: id, name: "meta-purchase" } });
    assert.ok(Number((purchase.payload as any).eventTime) > 0, "Purchase timed at the proof");
    // A reminder that was due before the proof arrived is skipped, not sent.
    await prisma.job.create({ data: { name: "advance-reminder-email", orderId: id, payload: { orderId: id } } });
    sent.length = 0;
    await runAll("advance-reminder-email");
    assert.equal(sent.length, 0);

    // Verified: one confirmation ("paid in advance, nothing to pay on delivery") + team new order marked Advance paid.
    const total = r.body.total;
    await prisma.order.update({ where: { id }, data: { paymentStatus: "VERIFIED", advanceReceived: total } });
    await prisma.job.deleteMany({ where: { orderId: id, name: { in: ["customer-order-email", "order-team-email"] } } });
    await prisma.$transaction((tx) => enqueueOrderEmails(tx, id, "advance-paid", "Thanks for paying early!"));
    sent.length = 0;
    await runAll("customer-order-email");
    await runAll("order-team-email");
    const confirmed = sent.find((m) => !String(m.subject).startsWith("[Orders]"));
    assert.match(confirmed.subject, new RegExp(`Order confirmed – paid in advance • ${r.body.orderNumber}`));
    assert.match(confirmed.html, /Paid in advance – nothing to pay on delivery/);
    assert.match(confirmed.html, /Thanks for paying early!/);
    assert.equal(confirmed.html.includes("pay cash when your parcel arrives"), false);
    const teamPaid = sent.find((m) => String(m.subject).startsWith("[Orders]"));
    assert.match(teamPaid.subject, new RegExp(`${r.body.orderNumber} • New order • Advance paid`));
    // Sent once: a retried job carries the same idempotency key, so the provider delivers it only once.
    assert.equal(confirmed.idempotencyKey, `order-received-advance-${id}`);
    sent.length = 0;
    await runAll("customer-order-email");
    assert.ok(
      sent.every((m) => m.idempotencyKey === `order-received-advance-${id}`),
      "same key on retry",
    );

    // Switched to COD (no proof): the normal COD emails and the Purchase go out then.
    const c = await order("ADVANCE_EASYPAISA", 1, { email: "switch@example.com" });
    const cid = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: c.body.orderNumber } })).id;
    await prisma.order.update({ where: { id: cid }, data: { test: false } });
    const switched = await fetch(`${base}/api/pay/${c.body.orderNumber}/cod?t=${encodeURIComponent(c.body.payToken)}`, {
      method: "POST",
      headers: { "x-zm-proxy-secret": "isolated-proxy-secret", "x-zm-client-ip": `10.9.${n}.1` },
    });
    assert.equal(switched.status, 200);
    const cJobs = (await prisma.job.findMany({ where: { orderId: cid }, select: { name: true } }))
      .map((j) => j.name)
      .sort();
    assert.deepEqual(cJobs, ["customer-order-email", "meta-purchase", "order-team-email"]);
    sent.length = 0;
    for (const job of await prisma.job.findMany({ where: { orderId: cid, name: { not: "meta-purchase" } } })) {
      await prisma.job.update({ where: { id: job.id }, data: { status: "QUEUED", attempts: 0 } });
      await processJobRow(job.id);
    }
    const codMail = sent.find((m) => !String(m.subject).startsWith("[Orders]"));
    assert.match(codMail.subject, new RegExp(`Order received • ${c.body.orderNumber}`));
    assert.match(codMail.html, /pay cash when your parcel arrives/);
    assert.ok(sent.some((m) => /New COD order \(switched from advance payment\)/.test(m.subject)));
    console.log(
      "ok - emails: nothing at checkout, complete-your-payment, proof emails + Purchase, one confirmation on verify, " +
        "COD switch emails + Purchase, reminder skipped",
    );
  } finally {
    globalThis.fetch = realFetch;
    process.env.RESEND_API_KEY = "";
  }
}

// Admin → Payments: order agent can verify and reject; Verify needs the merchant reference; a marketer is refused;
// COD to collect is 0 after verify and the balance after a partial; every action is audited.
{
  const { signAdminToken, passwordStamp } = await import("../src/lib/auth");
  const staff = async (role: "ORDER_AGENT" | "MARKETER") => {
    const user = await prisma.user.create({
      data: { name: `${role} QA`, email: `${role.toLowerCase()}@example.invalid`, passwordHash: `hash-${role}`, role },
    });
    return signAdminToken({ id: user.id, name: user.name, email: user.email, role }, passwordStamp(user.passwordHash));
  };
  const agent = await staff("ORDER_AGENT");
  const marketer = await staff("MARKETER");
  const admin = (token: string) => async (path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };
  const asAgent = admin(agent);
  const asMarketer = admin(marketer);
  const withProof = async (amount?: number) => {
    const r = await order("ADVANCE_EASYPAISA", 1);
    const sent = await sendProof(
      r.body.orderNumber,
      r.body.payToken,
      good(amount ?? r.body.total, "ADM" + n + "X"),
      await shot(20 + n),
    );
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const proof = await prisma.paymentProof.findFirstOrThrow({ where: { order: { orderNumber: r.body.orderNumber } } });
    return { r, proof };
  };

  const { r: o1, proof: p1 } = await withProof();
  assert.equal((await asMarketer(`/api/admin/payments`)).status, 403, "marketer cannot see payments");
  const list = await asAgent(`/api/admin/payments?view=needs`);
  assert.equal(list.status, 200);
  assert.ok(list.body.rows.some((row: any) => row.id === p1.id));
  assert.ok(list.body.counts.needs >= 1);
  const detail = await asAgent(`/api/admin/payments/${p1.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.proof.tid, p1.tid);
  assert.equal(detail.body.expected.amount, o1.body.total);
  assert.equal(detail.body.proof.imageUrl, `/api/admin/payments/${p1.id}/image`, "local: same-origin image route");
  assert.equal(JSON.stringify(detail.body).includes("passwordHash"), false);
  assert.equal(JSON.stringify(detail.body).includes("screenshotKey"), false);
  const image = await fetch(`${base}/api/admin/payments/${p1.id}/image`, {
    headers: { authorization: `Bearer ${agent}` },
  });
  assert.deepEqual([image.status, image.headers.get("content-type")], [200, "image/webp"]);
  assert.equal((await fetch(`${base}/api/admin/payments/${p1.id}/image`)).status, 401, "image needs staff login");

  const patch = async (path: string, body: unknown) => {
    const res = await fetch(base + path, {
      method: "PATCH",
      headers: { authorization: `Bearer ${agent}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };
  const full = (amountReceived: number, extra: Record<string, unknown> = {}) => ({
    amountReceived,
    checked: true,
    ...extra,
  });

  // Unverified: the order cannot be confirmed or booked; the answer offers verify or COD.
  const blockedConfirm = await patch(`/api/admin/orders/${p1.orderId}/status`, { status: "CONFIRMED" });
  assert.equal(blockedConfirm.status, 409, JSON.stringify(blockedConfirm.body));
  assert.equal(blockedConfirm.body.error, "ADVANCE_PAYMENT_UNVERIFIED");
  assert.equal(blockedConfirm.body.proofId, p1.id);
  assert.equal(
    (await patch(`/api/admin/orders/${p1.orderId}/tracking`, { tracking: "2201234567" })).status,
    409,
    "no booking while unverified",
  );
  const bulkBlocked = await patch(`/api/admin/orders/bulk-status`, { ids: [p1.orderId], status: "CONFIRMED" });
  assert.deepEqual(
    [bulkBlocked.body?.updated, bulkBlocked.body?.blocked],
    [0, [o1.body.orderNumber]],
    JSON.stringify(bulkBlocked),
  );
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: p1.orderId } })).status, "ON_HOLD");

  assert.equal((await asAgent(`/api/admin/payments/${p1.id}/verify`, {})).status, 400, "amount required");
  const unchecked = await asAgent(`/api/admin/payments/${p1.id}/verify`, { amountReceived: o1.body.total });
  assert.equal(unchecked.status, 400, "the merchant-app checkbox is required");
  assert.match(unchecked.body.message, /Easypaisa merchant app/);
  assert.equal((await asMarketer(`/api/admin/payments/${p1.id}/verify`, full(o1.body.total))).status, 403);
  // No merchant reference typed: the customer's TID stays the reference.
  const verified = await asAgent(`/api/admin/payments/${p1.id}/verify`, full(o1.body.total));
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const v = await prisma.order.findUniqueOrThrow({ where: { orderNumber: o1.body.orderNumber } });
  assert.deepEqual([v.status, v.paymentStatus, Number(v.advanceReceived)], ["NEW", "VERIFIED", o1.body.total]);
  assert.ok(v.paymentVerifiedAt && v.paymentVerifiedById);
  const p1After = await prisma.paymentProof.findUniqueOrThrow({ where: { id: p1.id } });
  assert.deepEqual([p1After.status, Number(p1After.amountReceived)], ["VERIFIED", o1.body.total]);
  const orderDetail = await asAgent(`/api/admin/orders/${v.id}`);
  assert.equal(orderDetail.body.codToCollect, 0, "courier collects nothing after verify");
  assert.equal(orderDetail.body.paymentProofs[0].status, "VERIFIED");
  assert.equal((await asAgent(`/api/admin/payments/${p1.id}/verify`, full(o1.body.total))).status, 409, "once");
  // Verified: confirming is allowed now, and the confirmation email is not sent twice (verify already sent it).
  assert.equal((await patch(`/api/admin/orders/${v.id}/status`, { status: "CONFIRMED" })).status, 200);
  const { sendCustomerStatusEmail } = await import("../src/lib/email");
  assert.deepEqual(await sendCustomerStatusEmail(v.id, "CONFIRMED"), { skipped: "ADVANCE_CONFIRMED_ON_VERIFY" });

  // The same payment cannot verify a second order (the reference / TID is already used).
  {
    const { proof: dup } = await withProof();
    const again = await asAgent(`/api/admin/payments/${dup.id}/verify`, full(1000, { merchantReference: p1.tid }));
    assert.deepEqual([again.status, again.body.error], [409, "DUPLICATE_REFERENCE"]);
    assert.match(again.body.message, new RegExp(o1.body.orderNumber));
  }
  const verifyJobs = await prisma.job.findMany({
    where: { orderId: v.id, name: { in: ["customer-order-email", "order-team-email", "advance-verified-email"] } },
  });
  assert.deepEqual(
    verifyJobs.map((j) => [j.name, (j.payload as any).kind]).sort(),
    [
      ["customer-order-email", "advance-paid"],
      ["order-team-email", "advance-paid"],
    ],
    "verify sends the one confirmation and the team's new-order email",
  );
  const audit1 = await prisma.auditLog.findFirstOrThrow({ where: { entity: "PaymentProof", entityId: p1.id } });
  assert.equal(audit1.action, "payment_verify");

  // A second open proof on a verified order is closed automatically.
  {
    const r = await order("ADVANCE_EASYPAISA", 1);
    await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total - 300, "TWOA" + n), await shot(40));
    await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total, "TWOB" + n), await shot(41));
    const [first, second] = await prisma.paymentProof.findMany({
      where: { order: { orderNumber: r.body.orderNumber } },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(
      (await asAgent(`/api/admin/payments/${second.id}/verify`, full(r.body.total, { merchantReference: "EP-900100" })))
        .status,
      200,
    );
    const closed = await prisma.paymentProof.findUniqueOrThrow({ where: { id: first.id } });
    assert.deepEqual([closed.status, closed.notes?.startsWith("Closed automatically")], ["REJECTED", true]);
    assert.equal(
      await prisma.job.count({ where: { orderId: first.orderId, name: "advance-issue-email" } }),
      0,
      "no email",
    );
  }

  // Partial: Rs 1000 of the total arrived → order goes ahead, the rest on delivery; no further proof accepted.
  const { r: o2, proof: p2 } = await withProof(1000);
  assert.equal(
    (await asAgent(`/api/admin/payments/${p2.id}/partial`, full(o2.body.total, { merchantReference: "EP-1" }))).status,
    400,
    "full amount is not partial",
  );
  assert.equal(
    (await asAgent(`/api/admin/payments/${p2.id}/partial`, full(1000, { merchantReference: "EP-445566" }))).status,
    200,
  );
  const partialDetail = await asAgent(`/api/admin/orders/${p2.orderId}`);
  assert.deepEqual(
    [partialDetail.body.status, partialDetail.body.paymentStatus, partialDetail.body.codToCollect],
    ["NEW", "MISMATCH", o2.body.total - 1000],
  );
  const page2 = (await (await fetch(`${base}/api/pay/${o2.body.orderNumber}?t=${o2.body.payToken}`)).json()) as any;
  assert.equal(page2.canSubmitProof, false, "no resubmission after a partial was accepted");

  // Reject: order stays on hold, customer may send one corrected proof, the TID is freed.
  const { r: o3, proof: p3 } = await withProof();
  assert.equal((await asAgent(`/api/admin/payments/${p3.id}/reject`, { reason: "MADE_UP" })).status, 400);
  assert.equal(
    (
      await asAgent(`/api/admin/payments/${p3.id}/reject`, {
        reason: "NOT_RECEIVED",
        notes: "Checked twice, nothing in the app",
        customerMessage: "Please send the receipt again.",
      })
    ).status,
    200,
  );
  const rejectJob = await prisma.job.findFirstOrThrow({
    where: { orderId: p3.orderId, name: "advance-issue-email" },
  });
  assert.equal((rejectJob.payload as any).message, "Please send the receipt again.", "customer message goes out");
  assert.equal(JSON.stringify(rejectJob.payload).includes("Checked twice"), false, "staff note never does");
  const rejected = await prisma.order.findUniqueOrThrow({ where: { id: p3.orderId } });
  assert.deepEqual([rejected.status, rejected.paymentStatus], ["ON_HOLD", "REJECTED"]);
  const page3 = (await (await fetch(`${base}/api/pay/${o3.body.orderNumber}?t=${o3.body.payToken}`)).json()) as any;
  assert.deepEqual([page3.canSubmitProof, page3.proof.status], [true, "REJECTED"]);
  assert.match(page3.proof.rejectMessage, /could not find this payment/);
  assert.equal(await prisma.job.count({ where: { orderId: p3.orderId, name: "advance-issue-email" } }), 1);

  // Refund recorded only on a verified proof, with a reason, never above what was received.
  assert.equal((await asAgent(`/api/admin/payments/${p3.id}/refund`, { amount: 100, reason: "OTHER" })).status, 409);
  assert.equal((await asAgent(`/api/admin/payments/${p1.id}/refund`, { amount: 100 })).status, 400, "reason required");
  const tooMuch = await asAgent(`/api/admin/payments/${p1.id}/refund`, {
    amount: o1.body.total + 1,
    reason: "COULD_NOT_SHIP",
  });
  assert.deepEqual([tooMuch.status, tooMuch.body.error], [400, "REFUND_TOO_HIGH"]);
  const refundDetail = await asAgent(`/api/admin/payments/${p1.id}`);
  assert.equal(refundDetail.body.order.refundable, o1.body.total);
  assert.equal(
    refundDetail.body.refundSuggestions.CUSTOMER_CANCELLED,
    o1.body.total - Number(v.deliveryFee),
    "prefill: paid − delivery charges",
  );
  // Refunded and cancelled (the default): no booking, nothing collected, one refund email.
  assert.equal(
    (
      await asAgent(`/api/admin/payments/${p1.id}/refund`, {
        amount: o1.body.total,
        reason: "COULD_NOT_SHIP",
        reference: "RF-9001",
      })
    ).status,
    200,
  );
  const refunded = await prisma.order.findUniqueOrThrow({ where: { id: p1.orderId } });
  assert.deepEqual(
    [refunded.paymentStatus, refunded.status, Number(refunded.advanceRefunded)],
    ["REFUNDED", "CANCELLED", o1.body.total],
  );
  assert.equal((await asAgent(`/api/admin/orders/${p1.orderId}`)).body.codToCollect, 0, "cancelled: no booking");
  const refundJob = await prisma.job.findFirstOrThrow({ where: { orderId: p1.orderId, name: "advance-refund-email" } });
  assert.equal((refundJob.payload as any).amount, o1.body.total);
  assert.equal((await prisma.paymentProof.findUniqueOrThrow({ where: { id: p1.id } })).refundReason, "COULD_NOT_SHIP");
  const nothingLeft = await asAgent(`/api/admin/payments/${p1.id}/refund`, { amount: 1, reason: "OTHER" });
  assert.deepEqual([nothingLeft.status, nothingLeft.body.error], [400, "REFUND_TOO_HIGH"]);

  // ZM-10018: the customer sent Rs 9 instead of the total. Verify with the amount that arrived → partial; the
  // courier collects the rest. Refund the Rs 9 and keep the order → the courier collects the full total again.
  {
    const { r, proof } = await withProof();
    const total = r.body.total;
    assert.equal((await asAgent(`/api/admin/payments/${proof.id}/verify`, full(9))).status, 200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: proof.orderId } });
    assert.deepEqual([after.status, after.paymentStatus, Number(after.advanceReceived)], ["NEW", "MISMATCH", 9]);
    assert.deepEqual(
      [(await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })).status],
      ["PARTIAL"],
      "auto-partial below the amount due",
    );
    assert.equal((await asAgent(`/api/admin/orders/${proof.orderId}`)).body.codToCollect, total - 9);
    assert.equal(
      await prisma.job.count({ where: { orderId: proof.orderId, name: "customer-order-email" } }),
      1,
      "partial: the confirmation with the balance to pay on delivery",
    );
    assert.equal(await prisma.job.count({ where: { orderId: proof.orderId, name: "advance-issue-email" } }), 0);
    assert.equal(
      (await patch(`/api/admin/orders/${proof.orderId}/status`, { status: "CONFIRMED" })).status,
      200,
      "an accepted partial can be confirmed",
    );
    assert.equal(
      (await asAgent(`/api/admin/payments/${proof.id}/refund`, { amount: 10, reason: "OTHER" })).status,
      400,
      "never more than received",
    );
    assert.equal(
      (
        await asAgent(`/api/admin/payments/${proof.id}/refund`, {
          amount: 9,
          reason: "OTHER",
          cancelOrder: false,
          customerMessage: "We sent your Rs 9 back.",
        })
      ).status,
      200,
    );
    const kept = await asAgent(`/api/admin/orders/${proof.orderId}`);
    assert.deepEqual(
      [kept.body.status, kept.body.paymentStatus, kept.body.advanceRefunded, kept.body.codToCollect],
      ["CONFIRMED", "REFUNDED", 9, total],
      "refunded and kept: the full amount again",
    );
  }

  // Staff convert an unpaid advance order to COD: the discount is removed and the normal flow follows.
  {
    const r = await order("ADVANCE_EASYPAISA", 1);
    const before = await prisma.order.update({ where: { orderNumber: r.body.orderNumber }, data: { test: false } });
    const guard = await patch(`/api/admin/orders/${before.id}/status`, { status: "CONFIRMED" });
    assert.deepEqual(
      [guard.status, guard.body.proofId, guard.body.codTotal],
      [409, null, Math.round(Number(before.total) + Number(before.advanceDiscount))],
    );
    assert.equal((await asAgent(`/api/admin/orders/${before.id}/convert-to-cod`, {})).status, 200);
    assert.deepEqual(
      (await prisma.job.findMany({ where: { orderId: before.id }, select: { name: true } })).map((j) => j.name).sort(),
      ["customer-order-email", "meta-purchase", "order-team-email"],
      "staff COD switch: the COD emails and the Purchase",
    );
    const cod = await prisma.order.findUniqueOrThrow({ where: { id: before.id } });
    assert.deepEqual(
      [cod.paymentMethod, cod.paymentStatus, Number(cod.advanceDiscount), Number(cod.total), cod.status],
      ["COD", "NOT_REQUIRED", 0, Number(before.total) + Number(before.advanceDiscount), "NEW"],
    );
    assert.equal((await patch(`/api/admin/orders/${before.id}/status`, { status: "CONFIRMED" })).status, 200);
    assert.equal(
      (await asAgent(`/api/admin/orders/${before.id}/convert-to-cod`, {})).status,
      409,
      "only advance orders",
    );
    assert.equal(
      (await asAgent(`/api/admin/orders/${p2.orderId}/convert-to-cod`, {})).status,
      409,
      "not once money was accepted",
    );
  }

  // Orders filter "Advance payment – needs verification".
  const { proof: p4 } = await withProof();
  const filtered = await asAgent(`/api/admin/orders?payment=needs-verification`);
  assert.equal(filtered.status, 200, JSON.stringify(filtered.body).slice(0, 300));
  const ids = (filtered.body.orders || filtered.body.rows || filtered.body.data || filtered.body).map((o: any) => o.id);
  assert.ok(ids.includes(p4.orderId));
  assert.equal(ids.includes(p1.orderId), false);
  console.log(
    "ok - admin payments: status guard, verify amount + checkbox, duplicate reference, auto-partial (ZM-10018), " +
      "reject message, refund limits/cancel/keep, convert to COD, COD to collect, filter",
  );
}

// Auto-read (Gemini intercepted, no real call): off by default; with the switch and a key it prefills the form and
// fills the staff comparison, flags a different receiver, and never changes a proof's status.
{
  const { processJobRow } = await import("../src/lib/job-processor");
  const calls: any[] = [];
  let answer: Record<string, unknown> = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url || input);
    if (!url.startsWith("https://generativelanguage.googleapis.com")) return realFetch(input, init);
    calls.push({ url, headers: init?.headers, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const read = async (orderNumber: string, token: string, file: Buffer) => {
    const form = new FormData();
    form.set("screenshot", new Blob([new Uint8Array(file)], { type: "image/jpeg" }), "s.jpg");
    const res = await fetch(`${base}/api/pay/${orderNumber}/proof/read?t=${encodeURIComponent(token)}`, {
      method: "POST",
      body: form,
      headers: { "x-zm-proxy-secret": "isolated-proxy-secret", "x-zm-client-ip": `10.7.${n}.1` },
    });
    return (await res.json()) as any;
  };
  try {
    // Off (default): no call, no job, no prefill.
    await setAdvance({});
    process.env.GEMINI_API_KEY = "isolated-gemini-key";
    const off = await order("ADVANCE_EASYPAISA", 1);
    const offPage = (await (
      await fetch(`${base}/api/pay/${off.body.orderNumber}?t=${off.body.payToken}`)
    ).json()) as any;
    assert.equal(offPage.autoRead, false);
    assert.deepEqual(await read(off.body.orderNumber, off.body.payToken, await shot(50)), { prefill: null });
    await sendProof(off.body.orderNumber, off.body.payToken, good(off.body.total, "OFFREAD" + n), await shot(51));
    const offId = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: off.body.orderNumber } })).id;
    assert.equal(await prisma.job.count({ where: { orderId: offId, name: "advance-proof-autoread" } }), 0);
    assert.equal(calls.length, 0, "no Gemini call while off");

    // On.
    await setAdvance({ autoRead: true });
    const r = await order("ADVANCE_EASYPAISA", 1);
    const page = (await (await fetch(`${base}/api/pay/${r.body.orderNumber}?t=${r.body.payToken}`)).json()) as any;
    assert.equal(page.autoRead, true);
    answer = {
      isPaymentReceipt: true,
      tid: "READ12345",
      amount: r.body.total,
      sender: "Ali Raza",
      receiver: "Other Shop",
      confidence: 0.9,
    };
    const pre = await read(r.body.orderNumber, r.body.payToken, await shot(52));
    assert.deepEqual(pre.prefill, { tid: "READ12345", amount: r.body.total, sender: "Ali Raza" });
    assert.equal(calls[0].headers["x-goog-api-key"], "isolated-gemini-key");
    assert.equal(calls[0].url.includes("isolated-gemini-key"), false);
    const sent = Buffer.from(calls[0].body.contents[0].parts[1].inline_data.data, "base64");
    assert.equal((await sharp(sent).metadata()).exif, undefined, "metadata removed before sending");
    assert.equal(sent.includes(Buffer.from("secret-phone-owner")), false);
    assert.equal(
      await prisma.paymentProof.count({ where: { order: { orderNumber: r.body.orderNumber } } }),
      0,
      "prefill stores nothing",
    );

    await sendProof(r.body.orderNumber, r.body.payToken, good(r.body.total, "READ12345"), await shot(52));
    const id = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.body.orderNumber } })).id;
    const job = await prisma.job.findFirstOrThrow({ where: { orderId: id, name: "advance-proof-autoread" } });
    await prisma.job.update({ where: { id: job.id }, data: { status: "QUEUED", attempts: 0 } });
    await processJobRow(job.id);
    const proof = await prisma.paymentProof.findFirstOrThrow({ where: { orderId: id } });
    assert.deepEqual(
      [proof.ocrTid, Number(proof.ocrAmount), proof.ocrReceiver, proof.receiverMismatch, proof.status],
      ["READ12345", r.body.total, "Other Shop", true, "SUBMITTED"],
    );
    const o = await prisma.order.findUniqueOrThrow({ where: { id } });
    assert.deepEqual([o.status, o.paymentStatus], ["ON_HOLD", "SUBMITTED"], "auto-read never verifies");

    // Screenshot only: the read TID and amount become the proof's values (marked auto-read), and the amount check
    // runs on them (ZM-10018: Rs 9 read on a bigger order → amount issue). Typed values always win.
    {
      const s = await order("ADVANCE_EASYPAISA", 1);
      await sendProof(s.body.orderNumber, s.body.payToken, { method: "RAAST_QR" }, await shot(54));
      const sid = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: s.body.orderNumber } })).id;
      answer = { isPaymentReceipt: true, tid: "AUTO" + n + "TID9", amount: 9, sender: "Ali Raza", confidence: 0.92 };
      const sjob = await prisma.job.findFirstOrThrow({ where: { orderId: sid, name: "advance-proof-autoread" } });
      await prisma.job.update({ where: { id: sjob.id }, data: { status: "QUEUED", attempts: 0 } });
      await processJobRow(sjob.id);
      const sp = await prisma.paymentProof.findFirstOrThrow({ where: { orderId: sid } });
      assert.deepEqual(
        [sp.tid, Number(sp.amountSent), sp.senderName, sp.detailsFromAutoRead, sp.detailsMissing],
        ["AUTO" + n + "TID9", 9, "Ali Raza", true, false],
      );
      assert.deepEqual([sp.amountMismatch, sp.status], [true, "MISMATCH"], "amount check runs on the read amount");
      assert.equal(sp.tidNormalized, normalizeTid("AUTO" + n + "TID9"), "duplicate-TID check covers it");
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: sid } })).paymentStatus, "MISMATCH");

      // Nothing usable read: the proof stays "details missing".
      const m = await order("ADVANCE_EASYPAISA", 1);
      await sendProof(m.body.orderNumber, m.body.payToken, { method: "RAAST_QR" }, await shot(55));
      const mid = (await prisma.order.findUniqueOrThrow({ where: { orderNumber: m.body.orderNumber } })).id;
      answer = { isPaymentReceipt: false, confidence: 0.2 };
      const mjob = await prisma.job.findFirstOrThrow({ where: { orderId: mid, name: "advance-proof-autoread" } });
      await prisma.job.update({ where: { id: mjob.id }, data: { status: "QUEUED", attempts: 0 } });
      await processJobRow(mjob.id);
      const mp = await prisma.paymentProof.findFirstOrThrow({ where: { orderId: mid } });
      assert.deepEqual([mp.tid, mp.detailsFromAutoRead, mp.detailsMissing], [null, false, true]);
    }

    // A confident read of a non-receipt prefills nothing.
    answer = { isPaymentReceipt: false, tid: "X", amount: 5, confidence: 0.99 };
    const r2 = await order("ADVANCE_EASYPAISA", 1);
    assert.deepEqual(await read(r2.body.orderNumber, r2.body.payToken, await shot(53)), { prefill: null });
    console.log(
      "ok - auto-read: off by default, prefill, staff hints, receiver flag, never verifies, metadata removed",
    );
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
    await setAdvance({});
  }
}
rmSync(proofDir, { recursive: true, force: true });

server.close();
await prisma.$disconnect();
await socket.stop();
await db.close();
console.log("All advance order tests passed.");
process.exit(0);
