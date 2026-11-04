import { test } from "node:test";
import assert from "node:assert/strict";
import { autoReader, geminiReader, parseAutoRead, prefillFrom, receiverDiffers } from "./proof-autoread";

const reply = (payload: unknown, status = 200) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });

test("off unless the setting is on and GEMINI_API_KEY is set", () => {
  assert.equal(autoReader({ autoRead: false }, { GEMINI_API_KEY: "k" }), null);
  assert.equal(autoReader({ autoRead: true }, {}), null);
  assert.equal(autoReader({ autoRead: true }, { GEMINI_API_KEY: "  " }), null);
  assert.ok(autoReader({ autoRead: true }, { GEMINI_API_KEY: "k" }));
});

test("Gemini call: key in a header, image inline, JSON schema; the answer is parsed safely", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const reader = geminiReader("test-key", "gemini-2.5-flash-lite", (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return reply({
      isPaymentReceipt: true,
      tid: " 41234567890 ",
      amount: 1490,
      dateTime: "2026-11-04T10:15:00+05:00",
      sender: "Ayesha Khan",
      receiver: "ZELVOMART",
      confidence: 0.92,
    });
  }) as typeof fetch);
  const result = await reader.read(Buffer.from("img"), "image/webp");
  assert.ok(seen);
  const call = seen as { url: string; init: RequestInit };
  assert.match(call.url, /models\/gemini-2\.5-flash-lite:generateContent$/);
  assert.equal((call.init.headers as Record<string, string>)["x-goog-api-key"], "test-key");
  assert.equal(call.url.includes("test-key"), false, "key never in the URL");
  const body = JSON.parse(String(call.init.body));
  assert.equal(body.contents[0].parts[1].inline_data.data, Buffer.from("img").toString("base64"));
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.ok(call.init.signal, "time-boxed");
  assert.deepEqual(
    [result?.tid, result?.amount, result?.dateTime?.toISOString(), result?.receiver, result?.confidence],
    ["41234567890", 1490, "2026-11-04T05:15:00.000Z", "ZELVOMART", 0.92],
  );
});

test("any failure means no hint, never an error: HTTP error, bad JSON, timeout", async () => {
  const fail = (impl: () => Promise<Response>) => geminiReader("k", "m", impl as unknown as typeof fetch);
  assert.equal(await fail(async () => reply({}, 429)).read(Buffer.from("x"), "image/webp"), null);
  assert.equal(
    await fail(async () => new Response("{not json", { status: 200 })).read(Buffer.from("x"), "image/webp"),
    null,
  );
  assert.equal(
    await fail(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }).read(Buffer.from("x"), "image/webp"),
    null,
  );
});

test("parse: malformed values become null; confidence is clamped", () => {
  const r = parseAutoRead({ isPaymentReceipt: "yes", tid: 42, amount: "lots", dateTime: "soon", confidence: 7 });
  assert.deepEqual(r, {
    isPaymentReceipt: false,
    tid: null,
    amount: null,
    dateTime: null,
    sender: null,
    receiver: null,
    confidence: 1,
  });
  assert.equal(parseAutoRead(null), null);
  assert.equal(parseAutoRead({ isPaymentReceipt: true, amount: -5, confidence: 0.4 })?.amount, null);
});

test("receiver check: only a clearly different name is flagged", () => {
  assert.equal(receiverDiffers("ZELVOMART", "Zelvomart"), false);
  assert.equal(receiverDiffers("Zelvomart (Pvt) Ltd", "Zelvomart"), false);
  assert.equal(receiverDiffers("Ali Electronics", "Zelvomart"), true);
  assert.equal(receiverDiffers(null, "Zelvomart"), false);
  assert.equal(receiverDiffers("12345", "Zelvomart"), false, "digits only: cannot tell");
});

test("prefill: only from a confident receipt read", () => {
  const base = {
    isPaymentReceipt: true,
    tid: "T123456",
    amount: 1490,
    dateTime: null,
    sender: "Ali",
    receiver: "Zelvomart",
    confidence: 0.9,
  };
  assert.deepEqual(prefillFrom(base), { tid: "T123456", amount: 1490, sender: "Ali" });
  assert.equal(prefillFrom({ ...base, confidence: 0.3 }), null);
  assert.equal(prefillFrom({ ...base, isPaymentReceipt: false }), null);
  assert.equal(prefillFrom(null), null);
});
