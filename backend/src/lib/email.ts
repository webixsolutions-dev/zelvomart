import {
  deliverEmail,
  emailIdentity,
  emailLayout,
  internalEmail,
  orderAlertRecipients,
  supportRecipients,
} from "./email-delivery";
import { prisma } from "./db";
import { money } from "./format";
import { getSetting } from "./settings";
import { SITE_ORIGIN } from "./site-url";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => values[key] ?? "");
}

/** Team order alert, daily summary and failure alerts all go to this list (see orderAlertRecipients). */
export async function orderRecipients() {
  return orderAlertRecipients(await getSetting<unknown>("notifications.orderRecipients", null));
}

export async function sendOrderTeamEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Order not found");

  const items =
    order.items
      .map(
        (item) =>
          `${escapeHtml(item.quantity)} × ${escapeHtml(item.title)} (${escapeHtml(item.sku)}) — ${escapeHtml(money(item.lineTotal))}`,
      )
      .join("<br/>") +
    (Number(order.couponDiscount) > 0
      ? `<br/>Coupon ${escapeHtml(order.couponCode)}: -${escapeHtml(money(order.couponDiscount))}`
      : "");

  const adminUrl = `${SITE_ORIGIN}/admin/orders/${order.id}`;
  const whatsappPhone = order.phone.replace(/\D/g, "");
  const defaultTemplate = `
    <h2>New order {{orderNumber}}</h2>
    <p><strong>{{customerName}}</strong> • <a href="tel:{{phone}}">{{phone}}</a> • <a href="https://wa.me/{{whatsappPhone}}">WhatsApp</a></p>
    <p>{{city}}<br/>{{address}}</p>
    <p>{{items}}</p>
    <p><strong>Total: {{total}}</strong></p>
    <p>Source: {{source}}</p>
    <p><a href="{{adminUrl}}">Open order in admin</a></p>
  `;
  const configuredTemplate = await getSetting<string>("notifications.teamOrderTemplate", defaultTemplate);
  const template = configuredTemplate.trim() ? configuredTemplate : defaultTemplate;
  const html = renderTemplate(template, {
    orderNumber: escapeHtml(order.orderNumber),
    customerName: escapeHtml(order.fullName),
    phone: escapeHtml(order.phone),
    whatsappPhone: escapeHtml(whatsappPhone),
    city: escapeHtml(order.city),
    address: escapeHtml(order.address),
    items,
    total: escapeHtml(money(order.total)),
    source: escapeHtml(order.source || "Direct"),
    adminUrl: escapeHtml(adminUrl),
  });

  const team = internalEmail(
    "Orders",
    await orderRecipients(),
    `${order.orderNumber} • New COD order • ${money(order.total)}`,
    html,
  );
  return deliverEmail(
    { ...emailIdentity("orders"), to: team.to, subject: team.subject, html: emailLayout(team.html) },
    `order-team-${order.id}`,
  );
}

export async function sendCustomerOrderEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Order not found");
  if (!order.email) return { skipped: "Customer did not provide an email address" };

  const items =
    order.items
      .map(
        (item) =>
          `<li>${escapeHtml(item.quantity)} × ${escapeHtml(item.title)} — ${escapeHtml(money(item.lineTotal))}</li>`,
      )
      .join("") +
    (Number(order.couponDiscount) > 0
      ? `<li>Coupon ${escapeHtml(order.couponCode)}: -${escapeHtml(money(order.couponDiscount))}</li>`
      : "");
  const defaultTemplate = `
    <h2>Thanks for your order, {{customerName}}.</h2>
    <p>Your order number is <strong>{{orderNumber}}</strong>.</p>
    <ul>{{items}}</ul>
    <p><strong>Total: {{total}}</strong></p>
    <p>Cash on Delivery: pay cash when your parcel arrives.</p>
    <p>What happens next: our team confirms your order by phone or WhatsApp, then dispatches it.</p>
  `;
  const configuredTemplate = await getSetting<string>("notifications.customerOrderTemplate", defaultTemplate);
  const template = configuredTemplate.trim() ? configuredTemplate : defaultTemplate;
  const html = renderTemplate(template, {
    customerName: escapeHtml(order.fullName),
    orderNumber: escapeHtml(order.orderNumber),
    items,
    total: escapeHtml(money(order.total)),
    city: escapeHtml(order.city),
    address: escapeHtml(order.address),
  });

  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: order.email,
      subject: `Order received • ${order.orderNumber}`,
      html: emailLayout(html),
    },
    `order-received-${order.id}`,
  );
}

export async function sendFailureAlert(subject: string, details: string) {
  if (!process.env.RESEND_API_KEY) return { skipped: "Email provider is not configured" };
  const alert = internalEmail(
    "Orders",
    await orderRecipients(),
    subject,
    `<pre style="white-space:pre-wrap">${escapeHtml(details)}</pre>`,
  );
  return deliverEmail({ ...emailIdentity("orders"), ...alert });
}

export async function sendContactTeamEmail(input: {
  name: string;
  email: string;
  phone: string;
  problem: string;
  sourceUrl?: string;
}) {
  const html = `
    <h2>New Zelvomart contact request</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></p>
    <p><strong>Phone:</strong> <a href="tel:${escapeHtml(input.phone)}">${escapeHtml(input.phone)}</a></p>
    <p><strong>Problem / message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(input.problem)}</p>
    ${input.sourceUrl ? `<p><strong>Source:</strong> ${escapeHtml(input.sourceUrl)}</p>` : ""}
  `;

  const support = internalEmail("Support", supportRecipients(), `Contact request • ${input.name}`, html);
  return deliverEmail({
    ...emailIdentity("support"),
    to: support.to,
    replyTo: input.email,
    subject: support.subject,
    html: emailLayout(support.html),
  });
}

export async function sendCustomerStatusEmail(orderId: string, status: "CONFIRMED" | "BOOKED" | "DELIVERED") {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { slug: true } } } } },
  });
  if (!order) throw new Error("Order not found");
  if (!order.email) return { skipped: "Customer did not provide an email address" };

  const base = SITE_ORIGIN;
  const trackingUrl = order.postexTracking
    ? `${process.env.POSTEX_TRACKING_BASE_URL || "https://postex.pk/tracking"}/${encodeURIComponent(order.postexTracking)}`
    : `${base}/track-your-order`;
  const reviewSlug = order.items[0]?.product?.slug;
  const reviewUrl = reviewSlug ? `${base}/product/${encodeURIComponent(reviewSlug)}/` : base;

  const content =
    status === "CONFIRMED"
      ? {
          subject: `Order confirmed • ${order.orderNumber}`,
          html: `<h2>Your Zelvomart order is confirmed.</h2><p>Hi ${escapeHtml(order.fullName)}, we have confirmed <strong>${escapeHtml(order.orderNumber)}</strong>.</p><p>We will update you when it is booked with the courier.</p>`,
        }
      : status === "BOOKED"
        ? {
            subject: `Your order has shipped • ${order.orderNumber}`,
            html: `<h2>Your order is on the way.</h2><p>Order <strong>${escapeHtml(order.orderNumber)}</strong> has been booked with the courier.</p><p><a href="${escapeHtml(trackingUrl)}">Track your parcel</a></p>`,
          }
        : {
            subject: `Delivered • ${order.orderNumber}`,
            html: `<h2>We hope you enjoy your order.</h2><p>Order <strong>${escapeHtml(order.orderNumber)}</strong> is marked delivered.</p><p>If you have a moment, you can leave a review on the product page: <a href="${escapeHtml(reviewUrl)}">Review your purchase</a>.</p>`,
          };

  return deliverEmail(
    {
      ...emailIdentity("orders"),
      to: order.email,
      subject: content.subject,
      html: emailLayout(content.html),
    },
    `order-status-${order.id}-${status}`,
  );
}
