import { prisma } from "./db";
import { deliverEmail, emailIdentity, emailLayout, internalEmail, orderAlertRecipients } from "./email-delivery";
import { getSetting } from "./settings";
import { money } from "./format";
import { SITE_ORIGIN } from "./site-url";
import { codToCollect, loadAdvanceSettings, paymentPath, paymentToken } from "./advance-payment";
import { REJECT_REASONS, type RejectReason } from "./payment-proof";

/** Background jobs for advance payment (cron-queue.ts sends them; job-processor.ts runs them). */
export const ADVANCE_JOB_NAMES = [
  "advance-proof-team-email",
  "advance-proof-customer-email",
  "advance-verified-email",
  "advance-issue-email",
  "advance-reminder-email",
] as const;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/** The guest payment-page link for an order (the token is derived again; only its hash is stored). */
export function paymentLink(orderNumber: string) {
  return `${SITE_ORIGIN.replace(/\/$/, "")}${paymentPath(orderNumber, paymentToken(orderNumber))}`;
}

const button = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#0877ee;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(label)}</a></p>`;

const SAFETY = `<p style="font-size:13px;color:#64748b">Zelvomart never asks for your PIN, OTP or password.</p>`;

/** The block the order-received email shows for an advance order (pay link, exact amount, the COD way out). */
export function advanceOrderEmailBlock(
  order: { orderNumber: string; total: { toString(): string } | number },
  expiryHours: number,
) {
  return [
    `<p><strong>Advance payment by Easypaisa / Raast:</strong> send exactly <strong>${escapeHtml(money(order.total))}</strong> within ${escapeHtml(expiryHours)} hours, then add your payment proof on the payment page.</p>`,
    button(paymentLink(order.orderNumber), "Pay now and add proof"),
    `<p style="font-size:13px">Changed your mind? On the same page you can choose Cash on Delivery instead (the advance discount is removed).</p>`,
    SAFETY,
  ].join("");
}

async function orderAndProof(orderId: string, proofId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      fullName: true,
      email: true,
      phone: true,
      total: true,
      paymentMethod: true,
      paymentStatus: true,
      advanceReceived: true,
      createdAt: true,
    },
  });
  if (!order) throw new Error("Order not found");
  const proof = proofId
    ? await prisma.paymentProof.findFirst({ where: { id: proofId, orderId } })
    : await prisma.paymentProof.findFirst({ where: { orderId }, orderBy: { createdAt: "desc" } });
  return { order, proof };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

export async function sendAdvanceProofTeamEmail(orderId: string, proofId: string) {
  const { order, proof } = await orderAndProof(orderId, proofId);
  if (!proof) return { skipped: "PROOF_NOT_FOUND" };
  const flags = [
    proof.amountMismatch &&
      `Amount differs: customer says ${money(proof.amountSent)}, order total ${money(order.total)}`,
    proof.tidDuplicate && "This TID was already used on another proof",
    proof.imageDuplicate && "The same (or a nearly identical) screenshot was already sent",
    proof.timeOutOfWindow && "The payment time is outside the order window",
  ].filter(Boolean) as string[];
  const rows: [string, string][] = [
    ["Order", order.orderNumber],
    ["Order total (send exactly)", money(order.total)],
    ["Customer says sent", money(proof.amountSent)],
    ["TID", proof.tid],
    ["Sender name", proof.senderName],
    ["Sender last 4", proof.senderLast4 || "–"],
    ["Paid via", proof.method === "RAAST_QR" ? "Raast QR" : proof.method === "TILL" ? "Till ID" : "Other"],
    ["Paid at (customer)", proof.paidAt ? proof.paidAt.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "–"],
  ];
  const html = `
    <h2>Advance payment proof • ${escapeHtml(order.orderNumber)}</h2>
    <p style="background:#fff7e6;border:1px solid #f5c26b;border-radius:8px;padding:10px 12px"><strong>A screenshot is never proof on its own.</strong> Open the Easypaisa merchant app, find this TID and amount, and only then verify. Do not dispatch before that.</p>
    ${flags.length ? `<p style="color:#b42318"><strong>Flags:</strong><br/>${flags.map(escapeHtml).join("<br/>")}</p>` : "<p>No flags.</p>"}
    <table cellpadding="6" style="border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#64748b">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`,
      )
      .join("")}</table>
    <p><a href="${escapeHtml(`${SITE_ORIGIN}/admin/orders/${order.id}`)}">Open the order in admin</a> (the screenshot is only in admin, never in email).</p>`;
  const team = internalEmail(
    "Orders",
    orderAlertRecipients(await getSetting<unknown>("notifications.orderRecipients", null)),
    `${order.orderNumber} • Advance payment proof • ${money(proof.amountSent)}${flags.length ? " • FLAGGED" : ""}`,
    html,
  );
  return deliverEmail(
    { ...emailIdentity("orders"), to: team.to, subject: team.subject, html: emailLayout(team.html) },
    `advance-proof-team-${proof.id}`,
  );
}

export async function sendAdvanceProofCustomerEmail(orderId: string, proofId: string) {
  const { order, proof } = await orderAndProof(orderId, proofId);
  if (!order.email) return { skipped: "Customer did not provide an email address" };
  if (!proof) return { skipped: "PROOF_NOT_FOUND" };
  const { verificationHours } = await loadAdvanceSettings();
  const html = `
    <h2>Order received – advance payment pending verification.</h2>
    <p>Hi ${escapeHtml(firstName(order.fullName))}, we received your payment proof for <strong>${escapeHtml(order.orderNumber)}</strong> (${escapeHtml(money(proof.amountSent))}, TID ${escapeHtml(proof.tid)}).</p>
    <p>We verify during ${escapeHtml(verificationHours)} and confirm on WhatsApp/email. Your order is safe.</p>
    ${
      proof.amountMismatch
        ? `<p style="color:#b42318">The amount you entered is different from your order total (${escapeHtml(money(order.total))}). We will check what arrived and contact you about any difference.</p>`
        : ""
    }
    ${SAFETY}`;
  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: order.email,
      subject: `Payment proof received • ${order.orderNumber}`,
      html: emailLayout(html),
    },
    `advance-proof-received-${proof.id}`,
  );
}

export async function sendAdvanceVerifiedEmail(orderId: string) {
  const { order } = await orderAndProof(orderId);
  if (!order.email) return { skipped: "Customer did not provide an email address" };
  if (order.paymentStatus !== "VERIFIED") return { skipped: "NOT_VERIFIED" };
  const html = `
    <h2>Payment confirmed – thank you.</h2>
    <p>Hi ${escapeHtml(firstName(order.fullName))}, we found your payment for <strong>${escapeHtml(order.orderNumber)}</strong> in our Easypaisa merchant account. Your order is now being prepared for dispatch.</p>
    <p>Nothing to pay on delivery (${escapeHtml(money(codToCollect(order)))}).</p>`;
  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: order.email,
      subject: `Payment confirmed • ${order.orderNumber}`,
      html: emailLayout(html),
    },
    `advance-verified-${order.id}`,
  );
}

export async function sendAdvanceIssueEmail(orderId: string, proofId: string) {
  const { order, proof } = await orderAndProof(orderId, proofId);
  if (!order.email) return { skipped: "Customer did not provide an email address" };
  if (!proof) return { skipped: "PROOF_NOT_FOUND" };
  const partial = order.paymentStatus === "MISMATCH" && Number(order.advanceReceived) > 0;
  const reason =
    proof.status === "REJECTED"
      ? REJECT_REASONS[(proof.rejectReason as RejectReason) || "OTHER"] || REJECT_REASONS.OTHER
      : partial
        ? `We received ${money(order.advanceReceived)}. The remaining ${money(codToCollect(order))} will be collected in cash on delivery.`
        : "The amount does not match your order total.";
  const html = `
    <h2>About your payment for ${escapeHtml(order.orderNumber)}</h2>
    <p>Hi ${escapeHtml(firstName(order.fullName))}, ${escapeHtml(reason)}</p>
    ${
      partial
        ? "<p>Your order goes ahead; no further action is needed.</p>"
        : `<p>You can send a corrected proof once from the payment page, or message us on WhatsApp.</p>${button(paymentLink(order.orderNumber), "Open payment page")}`
    }
    ${SAFETY}`;
  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: order.email,
      subject: `${partial ? "Payment received" : "Action needed: payment"} • ${order.orderNumber}`,
      html: emailLayout(html),
    },
    `advance-issue-${proof.id}-${proof.status}`,
  );
}

export async function sendAdvanceReminderEmail(orderId: string) {
  const { order } = await orderAndProof(orderId);
  if (!order.email) return { skipped: "Customer did not provide an email address" };
  if (order.paymentMethod !== "ADVANCE_EASYPAISA" || order.paymentStatus !== "AWAITING_PAYMENT")
    return { skipped: "NO_LONGER_AWAITING_PAYMENT" };
  const { expiryHours } = await loadAdvanceSettings();
  const html = `
    <h2>Your order is waiting for payment</h2>
    <p>Hi ${escapeHtml(firstName(order.fullName))}, order <strong>${escapeHtml(order.orderNumber)}</strong> is reserved for you. Send exactly <strong>${escapeHtml(money(order.total))}</strong> and add your proof, or choose Cash on Delivery instead on the same page.</p>
    ${button(paymentLink(order.orderNumber), "Pay now or switch to COD")}
    <p style="font-size:13px">The payment link stays open for ${escapeHtml(expiryHours)} hours after you ordered. Your order is not cancelled automatically.</p>
    ${SAFETY}`;
  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: order.email,
      subject: `Waiting for payment • ${order.orderNumber}`,
      html: emailLayout(html),
    },
    `advance-reminder-${order.id}`,
  );
}
