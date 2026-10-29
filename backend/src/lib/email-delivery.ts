import { Resend } from "resend";

export type EmailKind = "orders" | "offers" | "support";

export function emailIdentity(kind: EmailKind) {
  const fallback = `Zelvomart ${kind[0].toUpperCase() + kind.slice(1)} <${kind}@zelvomart.com>`;
  return {
    from:
      process.env[`${kind.toUpperCase()}_EMAIL_FROM`] ||
      (kind === "orders" ? process.env.EMAIL_FROM : undefined) ||
      fallback,
    replyTo: process.env.EMAIL_REPLY_TO || "support@zelvomart.com",
  };
}

/** "a@x.com, b@y.com" (or an array) → ["a@x.com", "b@y.com"]: trimmed, no blanks, no repeats. */
export function parseEmailList(value: unknown): string[] {
  const parts = Array.isArray(value) ? value.map(String) : String(value ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const email = part.trim();
    if (!email || !email.includes("@") || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push(email);
  }
  return out;
}

/**
 * Who gets the team order alert, the daily summary and failure alerts: Admin -> Settings
 * (notifications.orderRecipients), else ORDER_ALERT_RECIPIENTS, else support@zelvomart.com.
 */
export function orderAlertRecipients(setting: unknown, env = process.env.ORDER_ALERT_RECIPIENTS) {
  const fromSetting = parseEmailList(setting);
  if (fromSetting.length) return fromSetting;
  const fromEnv = parseEmailList(env);
  return fromEnv.length ? fromEnv : ["support@zelvomart.com"];
}

/** Contact form recipients: SUPPORT_EMAIL_TO (comma list) or support@zelvomart.com. */
export function supportRecipients(env = process.env.SUPPORT_EMAIL_TO) {
  const list = parseEmailList(env);
  return list.length ? list : ["support@zelvomart.com"];
}

/** Hidden copies of offer emails (OFFERS_COPY_TO, comma list). Empty means no copy. */
export function offerCopyRecipients(env = process.env.OFFERS_COPY_TO) {
  return parseEmailList(env);
}

/** `{ bcc: [...] }` for an offer email when OFFERS_COPY_TO is set, otherwise nothing. */
export function offerBcc(env = process.env.OFFERS_COPY_TO): { bcc?: string[] } {
  const copies = offerCopyRecipients(env);
  return copies.length ? { bcc: copies } : {};
}

/** "Zelvomart mailbox: orders@zelvomart.com · copy: zelvomart@gmail.com", built from the real recipient list. */
export function mailboxLine(recipients: string[]) {
  const own = recipients.filter((email) => /@zelvomart\.com$/i.test(email));
  const copies = recipients.filter((email) => !/@zelvomart\.com$/i.test(email));
  const main = own.length ? own : copies.splice(0, 1);
  return `Zelvomart mailbox: ${main.join(", ")}${copies.length ? ` · copy: ${copies.join(", ")}` : ""}`;
}

const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * An email for the team (never for a customer): the subject starts with [Orders] or [Support] and the body
 * opens with the mailbox line, so a copy in Gmail shows at a glance where it belongs.
 */
export function internalEmail(label: "Orders" | "Support", to: string[], subject: string, html: string) {
  const prefix = `[${label}] `;
  return {
    to,
    subject: subject.startsWith(prefix) ? subject : prefix + subject,
    html: `<p style="margin:0 0 14px;font-size:12px;color:#64748b">${escapeText(mailboxLine(to))}</p>${html}`,
  };
}

// Keep this transport shared so a provider rejection cannot silently complete a job.
export async function deliverEmail(payload: Parameters<Resend["emails"]["send"]>[0], idempotencyKey?: string) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
    payload,
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (result.error) throw new Error(`Email delivery rejected: ${result.error.message}`);
  if (!result.data?.id) throw new Error("Email provider did not acknowledge delivery");
  return result.data;
}

export function emailLayout(content: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f3f7fc;font-family:Arial,Helvetica,sans-serif;color:#142943"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px"><tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;font-size:24px;font-weight:700;color:#0877ee">ZELVOMART</td></tr><tr><td style="padding:24px 28px;font-size:15px;line-height:1.7;overflow-wrap:anywhere">${content}</td></tr><tr><td style="padding:20px 28px;background:#f8faff;font-size:12px;line-height:1.7;color:#64748b">Need help? Reply to this email or contact <a href="mailto:support@zelvomart.com" style="color:#0877ee">support@zelvomart.com</a>.<br>Zelvomart · Pakistan</td></tr></table></td></tr></table></body></html>`;
}
