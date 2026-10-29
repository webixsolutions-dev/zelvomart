import { test } from "node:test";
import assert from "node:assert/strict";
import {
  internalEmail,
  mailboxLine,
  offerBcc,
  orderAlertRecipients,
  parseEmailList,
  supportRecipients,
} from "./email-delivery";

test("recipient lists are split, trimmed and de-duplicated", () => {
  assert.deepEqual(parseEmailList(" orders@zelvomart.com, zelvomart@gmail.com ,,ORDERS@zelvomart.com "), [
    "orders@zelvomart.com",
    "zelvomart@gmail.com",
  ]);
  assert.deepEqual(parseEmailList(["a@x.com", " b@y.com "]), ["a@x.com", "b@y.com"]);
  assert.deepEqual(parseEmailList(""), []);
  assert.deepEqual(parseEmailList(undefined), []);
  assert.deepEqual(parseEmailList("not-an-email"), []);
});

test("order alert: Admin setting first, then ORDER_ALERT_RECIPIENTS, then support@", () => {
  const env = "orders@zelvomart.com,zelvomart@gmail.com";
  assert.deepEqual(orderAlertRecipients(["zelvomart@gmail.com"], env), ["zelvomart@gmail.com"]);
  assert.deepEqual(orderAlertRecipients(null, env), ["orders@zelvomart.com", "zelvomart@gmail.com"]);
  assert.deepEqual(orderAlertRecipients([], env), ["orders@zelvomart.com", "zelvomart@gmail.com"]);
  assert.deepEqual(orderAlertRecipients(null, ""), ["support@zelvomart.com"]);
});

test("contact form: SUPPORT_EMAIL_TO accepts a comma list, default support@", () => {
  assert.deepEqual(supportRecipients(undefined), ["support@zelvomart.com"]);
  assert.deepEqual(supportRecipients("support@zelvomart.com, team@zelvomart.com"), [
    "support@zelvomart.com",
    "team@zelvomart.com",
  ]);
});

test("offer emails get a BCC only when OFFERS_COPY_TO is set", () => {
  assert.deepEqual(offerBcc(undefined), {});
  assert.deepEqual(offerBcc(""), {});
  assert.deepEqual(offerBcc("offers@zelvomart.com,zelvomart@gmail.com"), {
    bcc: ["offers@zelvomart.com", "zelvomart@gmail.com"],
  });
});

test("internal emails carry the [Orders]/[Support] prefix and the mailbox line", () => {
  const to = ["orders@zelvomart.com", "zelvomart@gmail.com"];
  assert.equal(mailboxLine(to), "Zelvomart mailbox: orders@zelvomart.com · copy: zelvomart@gmail.com");
  assert.equal(mailboxLine(["support@zelvomart.com"]), "Zelvomart mailbox: support@zelvomart.com");
  const alert = internalEmail("Orders", to, "ZM-10010 • New COD order • Rs 4,389", "<p>body</p>");
  assert.equal(alert.subject, "[Orders] ZM-10010 • New COD order • Rs 4,389");
  assert.match(
    alert.html,
    /^<p[^>]*>Zelvomart mailbox: orders@zelvomart\.com · copy: zelvomart@gmail\.com<\/p><p>body<\/p>$/,
  );
  assert.equal(internalEmail("Orders", to, "[Orders] Daily summary", "").subject, "[Orders] Daily summary");
  assert.equal(
    internalEmail("Support", ["support@zelvomart.com"], "Contact request • Ali", "").subject,
    "[Support] Contact request • Ali",
  );
});

test("customer emails are not labelled: only internalEmail adds a prefix", async () => {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  const sent: { to: unknown; subject: string; bcc?: unknown }[] = [];
  try {
    process.env.RESEND_API_KEY = "re_test_placeholder";
    process.env.SUPPORT_EMAIL_TO = "support@zelvomart.com";
    globalThis.fetch = async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "email-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const { sendContactTeamEmail } = await import("./email");
    await sendContactTeamEmail({ name: "Ali", email: "ali@example.com", phone: "03001234567", problem: "Hi" });
    assert.equal(sent[0].subject, "[Support] Contact request • Ali");
    assert.deepEqual(sent[0].to, ["support@zelvomart.com"]);
    assert.equal(sent[0].bcc, undefined, "no copy on the contact form (Hostinger forwards support@)");
  } finally {
    process.env = original;
    globalThis.fetch = originalFetch;
  }
});
