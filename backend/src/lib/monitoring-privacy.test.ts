import { test } from "node:test";
import assert from "node:assert/strict";
import { monitoringEnabled, scrubMonitoringEvent } from "@zelvomart/monitoring";

test("monitoring stays disabled without a valid, explicit HTTPS DSN", () => {
  for (const value of [undefined, "", "not a DSN", "http://key@example.invalid/1", "https://example.invalid/1"])
    assert.equal(monitoringEnabled(value), false);
  assert.equal(monitoringEnabled("https://abc123@example.invalid/1"), true);
});
test("event allowlist removes auth, checkout, SQL, log, replay, custom context and attachment data", () => {
  const secret = "never-send-private-password";
  const email = "private@example.invalid",
    phone = "03001234567",
    address = "House 42 Private Road";
  const event = {
    event_id: "a".repeat(32),
    timestamp: 123,
    level: "error",
    platform: "node",
    release: "b".repeat(40),
    environment: "production",
    message: `${secret} ${address}`,
    user: { email, ip_address: "1.2.3.4" },
    request: {
      method: "POST",
      url: `https://shop.invalid/checkout?token=${secret}`,
      headers: { cookie: secret, authorization: secret },
      cookies: { auth: secret },
      data: { password: secret, phone, address },
    },
    breadcrumbs: [{ message: email, data: { phone, address } }],
    extra: { sql: `INSERT ${email} ${phone} ${address}` },
    contexts: {
      custom: { password: secret },
      trace: { trace_id: "c".repeat(32), span_id: "d".repeat(16), data: { phone, address } },
    },
    tags: { service: "backend", token: secret },
    fingerprint: [phone],
    logentry: { formatted: address },
    exception: {
      values: [
        {
          type: "TypeError",
          value: `${secret} ${email} ${phone} ${address}`,
          stacktrace: {
            frames: [
              {
                filename: `https://shop.invalid/_next/static/chunks/app.js?token=${secret}`,
                lineno: 42,
                colno: 3,
                vars: { email },
                context_line: address,
                pre_context: [phone],
              },
            ],
          },
        },
      ],
    },
  };
  const hint = { attachments: [{ data: secret }] };
  const clean = scrubMonitoringEvent(event, hint)!;
  const json = JSON.stringify(clean);
  for (const value of [secret, email, phone, address, "authorization", "cookie", "1.2.3.4"])
    assert.ok(!json.includes(value), value);
  assert.deepEqual(hint.attachments, []);
  assert.equal(clean.release, event.release);
  assert.equal(clean.exception.values[0].type, "TypeError");
  assert.equal(clean.exception.values[0].stacktrace.frames[0].filename, "/_next/static/chunks/app.js");
  assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno, 42);
  assert.equal(JSON.stringify(event).includes(secret), true, "does not mutate the application error");
});
test("performance/replay events and unknown metadata cannot be transmitted", () => {
  for (const type of ["transaction", "replay_event", "log"]) assert.equal(scrubMonitoringEvent({ type }), null);
  const clean = scrubMonitoringEvent({
    exception: {
      values: [
        {
          type: "Error",
          value: "phone 03001234567",
          stacktrace: { frames: [{ filename: "C:/Users/Private Person/src/order.ts?password=secret", lineno: 4 }] },
        },
      ],
    },
    unknown: { password: "secret" },
  })!;
  assert.equal(JSON.stringify(clean).includes("Private Person"), false);
  assert.equal(JSON.stringify(clean).includes("unknown"), false);
});
