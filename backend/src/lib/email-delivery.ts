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
