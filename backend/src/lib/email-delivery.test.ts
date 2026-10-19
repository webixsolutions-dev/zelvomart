import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverEmail, emailIdentity, emailLayout } from "./email-delivery";

test("email routing, missing credentials and provider responses", async () => {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.EMAIL_FROM;
    delete process.env.ORDERS_EMAIL_FROM;
    delete process.env.OFFERS_EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
    delete process.env.RESEND_API_KEY;
    assert.match(emailIdentity("orders").from, /orders@zelvomart.com/);
    assert.match(emailIdentity("offers").from, /offers@zelvomart.com/);
    assert.equal(emailIdentity("orders").replyTo, "support@zelvomart.com");
    const payload = { ...emailIdentity("orders"), to: "customer@example.com", subject: "Test", html: "<p>Order received</p>" };
    await assert.rejects(deliverEmail(payload), /not configured/);
    process.env.RESEND_API_KEY = "re_test_placeholder";
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("idempotency-key"), "test-order-1");
      return new Response(JSON.stringify({ id: "email-123" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    assert.equal((await deliverEmail(payload, "test-order-1")).id, "email-123");
    globalThis.fetch = async () => new Response(JSON.stringify({ name: "validation_error", message: "Domain not verified" }), { status: 422, headers: { "content-type": "application/json" } });
    await assert.rejects(deliverEmail(payload), /Domain not verified/);
    globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
    await assert.rejects(deliverEmail(payload), /did not acknowledge/);
    assert.match(emailLayout("Order received"), /Order received/);
    assert.match(emailLayout("Order received"), /max-width:600px/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
