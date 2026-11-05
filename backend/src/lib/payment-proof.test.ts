import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  canSubmitProof,
  cleanProofImage,
  differenceHash,
  hammingDistance,
  NEAR_DUPLICATE_DISTANCE,
  normalizeTid,
  proofFieldsSchema,
  proofFlags,
  proofHasEnough,
} from "./payment-proof";

const flagBase = {
  expected: 1490,
  orderCreatedAt: new Date("2026-11-04T10:00:00Z"),
  now: new Date("2026-11-04T11:00:00Z"),
  paidAt: null,
  tidDuplicate: false,
  imageDuplicate: false,
};
import { isPaymentProofKey, paymentProofBucket } from "./payment-proof-storage";

const screenshot = (seed: number, width = 600, height = 1200) =>
  sharp({ create: { width, height, channels: 3, background: { r: seed % 255, g: 120, b: 200 } } }).composite([
    {
      input: Buffer.from(
        `<svg width="${width}" height="${height}"><rect x="40" y="${100 + seed * 7}" width="${300 + seed * 3}" height="160" fill="#111"/><circle cx="${150 + seed * 11}" cy="800" r="120" fill="#fff"/></svg>`,
      ),
    },
  ]);

test("TID: uppercase letters and digits only; 6 to 40 characters", () => {
  assert.equal(normalizeTid(" abc 123-456 "), "ABC123456");
  assert.equal(normalizeTid(null), "");
  const ok = proofFieldsSchema.safeParse({ tid: "41 2345 6789", amount: "1490", senderName: "Ali Raza" });
  assert.equal(ok.success, true);
  assert.equal(ok.data?.amount, 1490);
  assert.equal(ok.data?.method, "OTHER");
  assert.equal(ok.data?.senderLast4, null);
  for (const bad of [
    { tid: "12-3", amount: "1490", senderName: "Ali" },
    { tid: "41234567", amount: "0", senderName: "Ali" },
    { tid: "41234567", amount: "1490", senderName: "A" },
    { tid: "41234567", amount: "1490", senderName: "Ali", senderLast4: "123" },
  ])
    assert.equal(proofFieldsSchema.safeParse(bad).success, false, JSON.stringify(bad));
  const full = proofFieldsSchema.parse({
    method: "RAAST_QR",
    tid: "41234567",
    amount: "1490.456",
    senderName: "Ali",
    senderLast4: "03-21",
    paidAt: "2026-11-04T10:00:00Z",
  });
  assert.deepEqual(
    [full.method, full.amount, full.senderLast4, full.paidAt?.toISOString()],
    ["RAAST_QR", 1490.46, "0321", "2026-11-04T10:00:00.000Z"],
  );
});

test("screenshot OR details: blanks are 'not given'; either alone is enough", () => {
  const blank = proofFieldsSchema.parse({ tid: "", amount: "", senderName: "  " });
  assert.deepEqual([blank.tid, blank.amount, blank.senderName], [undefined, undefined, undefined]);
  assert.equal(proofHasEnough(true, blank), true, "screenshot only");
  assert.equal(proofHasEnough(false, { tid: "41234567", amount: 589 }), true, "details only");
  assert.equal(proofHasEnough(false, blank), false, "neither");
  assert.equal(proofHasEnough(false, { tid: "41234567" }), false, "TID without amount");
  assert.equal(proofHasEnough(false, { amount: 589 }), false, "amount without TID");
  assert.equal(proofFlags({ ...flagBase, amountSent: null }).amountMismatch, false, "no amount yet: no flag");
});

test("screenshot: re-encoded as WebP, metadata removed, rotation applied, never enlarged", async () => {
  const withExif = await screenshot(1)
    .withExif({ IFD0: { Copyright: "secret-device", Artist: "gps-owner" } })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif, "fixture has EXIF");
  const out = await cleanProofImage(withExif);
  const meta = await sharp(out.bytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
  assert.equal(out.bytes.includes(Buffer.from("secret-device")), false);
  assert.deepEqual([out.width, out.height], [600, 1200]);
  const big = await cleanProofImage(await screenshot(2, 3000, 5000).png().toBuffer());
  assert.deepEqual([big.width, big.height], [1440, 2400], "only shrunk past 2400 px, aspect kept, no crop");
});

test("screenshot: only real JPG, PNG or WebP pictures up to 5 MB", async () => {
  await assert.rejects(cleanProofImage(Buffer.from("not an image")), /picture/);
  await assert.rejects(cleanProofImage(await screenshot(3, 50, 50).gif().toBuffer()), /JPG, PNG or WebP/);
  await assert.rejects(cleanProofImage(Buffer.alloc(5 * 1024 * 1024 + 1)), /5 MB/);
  await assert.rejects(cleanProofImage(Buffer.alloc(0)), /5 MB/);
});

test("dHash: the same screenshot re-saved matches; a different one does not", async () => {
  const original = await screenshot(4).png().toBuffer();
  const resaved = await sharp(original).resize(450).jpeg({ quality: 55 }).toBuffer();
  const other = await screenshot(19).png().toBuffer();
  const [a, b, c] = await Promise.all([differenceHash(original), differenceHash(resaved), differenceHash(other)]);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.ok(hammingDistance(a, b) <= NEAR_DUPLICATE_DISTANCE, `re-saved distance ${hammingDistance(a, b)}`);
  assert.ok(hammingDistance(a, c) > NEAR_DUPLICATE_DISTANCE, `different distance ${hammingDistance(a, c)}`);
  assert.equal(hammingDistance("zz", a), 64);
  assert.equal(hammingDistance(a, a), 0);
});

test("flags: amount off by Rs 1 or more is a mismatch; time outside the order window; never verified", () => {
  const base = {
    expected: 1490,
    orderCreatedAt: new Date("2026-11-04T10:00:00Z"),
    now: new Date("2026-11-04T11:00:00Z"),
    paidAt: null,
    tidDuplicate: false,
    imageDuplicate: false,
  };
  assert.equal(proofFlags({ ...base, amountSent: 1490 }).status, "SUBMITTED");
  assert.equal(proofFlags({ ...base, amountSent: 1490.5 }).status, "SUBMITTED");
  const off = proofFlags({ ...base, amountSent: 1400 });
  assert.deepEqual([off.amountMismatch, off.status], [true, "MISMATCH"]);
  const dup = proofFlags({ ...base, amountSent: 1490, tidDuplicate: true, imageDuplicate: true });
  assert.deepEqual([dup.tidDuplicate, dup.imageDuplicate, dup.status], [true, true, "SUBMITTED"]);
  const early = proofFlags({ ...base, amountSent: 1490, paidAt: new Date("2026-11-04T09:00:00Z") });
  const fine = proofFlags({ ...base, amountSent: 1490, paidAt: new Date("2026-11-04T09:45:00Z") });
  const future = proofFlags({ ...base, amountSent: 1490, paidAt: new Date("2026-11-04T12:00:00Z") });
  assert.deepEqual([early.timeOutOfWindow, fine.timeOutOfWindow, future.timeOutOfWindow], [true, false, true]);
});

test("submit rule: one proof, plus one more only after a mismatch or rejection", () => {
  const adv = (paymentStatus: string) => ({ paymentMethod: "ADVANCE_EASYPAISA", paymentStatus });
  assert.equal(canSubmitProof(adv("AWAITING_PAYMENT"), 0), true);
  assert.equal(canSubmitProof(adv("EXPIRED"), 0), true, "late payment still accepted");
  assert.equal(canSubmitProof(adv("SUBMITTED"), 1), false);
  assert.equal(canSubmitProof(adv("MISMATCH"), 1), true);
  assert.equal(canSubmitProof(adv("REJECTED"), 1), true);
  assert.equal(canSubmitProof(adv("REJECTED"), 2), false, "only one resubmission");
  assert.equal(canSubmitProof(adv("VERIFIED"), 1), false);
  assert.equal(canSubmitProof({ paymentMethod: "COD", paymentStatus: "NOT_REQUIRED" }, 0), false);
  assert.equal(canSubmitProof({ ...adv("MISMATCH"), advanceReceived: "1000.00" }, 1), false, "partial accepted");
});

test("storage: private bucket only, never the public media bucket; strict keys", () => {
  const keep = { ...process.env };
  try {
    Object.assign(process.env, { S3_ENDPOINT: "https://r2", S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "s" });
    process.env.S3_BUCKET = "zelvomart-media";
    process.env.REPLAY_S3_BUCKET = "zelvomart-replays";
    delete process.env.PAYMENT_PROOF_S3_BUCKET;
    assert.equal(paymentProofBucket(), "zelvomart-replays");
    process.env.PAYMENT_PROOF_S3_BUCKET = "zelvomart-proofs";
    assert.equal(paymentProofBucket(), "zelvomart-proofs");
    process.env.PAYMENT_PROOF_S3_BUCKET = "zelvomart-media";
    assert.equal(paymentProofBucket(), "", "public bucket refused");
  } finally {
    process.env = keep;
  }
  assert.equal(isPaymentProofKey("payment-proofs/ZM-10020/0123456789abcdef01234567.webp"), true);
  for (const bad of ["replays/x", "payment-proofs/ZM-1/../../x.webp", "payment-proofs/ZM-10020/abc.png"])
    assert.equal(isPaymentProofKey(bad), false, bad);
});
