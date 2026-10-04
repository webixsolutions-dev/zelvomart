import { Resend } from "resend";
import { prisma } from "./db";
import { money } from "./format";
import { getSetting } from "./settings";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

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

async function recipients() {
  return getSetting<string[]>(
    "notifications.orderRecipients",
    (process.env.ORDER_ALERT_RECIPIENTS || "zelvomart@gmail.com")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export async function sendOrderTeamEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Order not found");

  const resend = client();
  if (!resend) throw new Error("RESEND_API_KEY is not configured");

  const items = order.items
    .map((item) => `${escapeHtml(item.quantity)} × ${escapeHtml(item.title)} (${escapeHtml(item.sku)}) — ${escapeHtml(money(item.lineTotal))}`)
    .join("<br/>");

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com"}/admin/orders/${order.id}`;
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

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Zelvomart Orders <orders@zelvomart.com>",
    to: await recipients(),
    subject: `${order.orderNumber} • New COD order • ${money(order.total)}`,
    html,
  });
}

export async function sendCustomerOrderEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order?.email) return;

  const resend = client();
  if (!resend) throw new Error("RESEND_API_KEY is not configured");

  const items = order.items
    .map((item) => `<li>${escapeHtml(item.quantity)} × ${escapeHtml(item.title)} — ${escapeHtml(money(item.lineTotal))}</li>`)
    .join("");
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

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Zelvomart Orders <orders@zelvomart.com>",
    to: order.email,
    subject: `Order received • ${order.orderNumber}`,
    html,
  });
}

export async function sendFailureAlert(subject: string, details: string) {
  const resend = client();
  if (!resend) return;
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Zelvomart Alerts <orders@zelvomart.com>",
    to: await recipients(),
    subject,
    html: `<pre style="white-space:pre-wrap">${escapeHtml(details)}</pre>`,
  });
}

export async function sendContactTeamEmail(input: {
  name: string;
  email: string;
  phone: string;
  problem: string;
  sourceUrl?: string;
}) {
  const resend = client();
  if (!resend) throw new Error("RESEND_API_KEY is not configured");

  const html = `
    <h2>New Zelvomart contact request</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></p>
    <p><strong>Phone:</strong> <a href="tel:${escapeHtml(input.phone)}">${escapeHtml(input.phone)}</a></p>
    <p><strong>Problem / message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(input.problem)}</p>
    ${input.sourceUrl ? `<p><strong>Source:</strong> ${escapeHtml(input.sourceUrl)}</p>` : ""}
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Zelvomart Support <orders@zelvomart.com>",
    to: await recipients(),
    replyTo: input.email,
    subject: `Contact request • ${input.name}`,
    html,
  });
}

export async function sendCustomerStatusEmail(orderId: string, status: "CONFIRMED" | "BOOKED" | "DELIVERED") {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: { select: { slug: true } } } } } });
  if (!order?.email) return;
  const resend = client();
  if (!resend) throw new Error("RESEND_API_KEY is not configured");

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com").replace(/\/$/, "");
  const trackingUrl = order.postexTracking
    ? `${process.env.POSTEX_TRACKING_BASE_URL || "https://postex.pk/tracking"}/${encodeURIComponent(order.postexTracking)}`
    : `${base}/track-order`;
  const reviewSlug = order.items[0]?.product?.slug;
  const reviewUrl = reviewSlug ? `${base}/product/${encodeURIComponent(reviewSlug)}/` : base;

  const content = status === "CONFIRMED"
    ? { subject: `Order confirmed • ${order.orderNumber}`, html: `<h2>Your Zelvomart order is confirmed.</h2><p>Hi ${escapeHtml(order.fullName)}, we have confirmed <strong>${escapeHtml(order.orderNumber)}</strong>.</p><p>We will update you when it is booked with the courier.</p>` }
    : status === "BOOKED"
      ? { subject: `Your order has shipped • ${order.orderNumber}`, html: `<h2>Your order is on the way.</h2><p>Order <strong>${escapeHtml(order.orderNumber)}</strong> has been booked with the courier.</p><p><a href="${escapeHtml(trackingUrl)}">Track your parcel</a></p>` }
      : { subject: `Delivered • ${order.orderNumber}`, html: `<h2>We hope you enjoy your order.</h2><p>Order <strong>${escapeHtml(order.orderNumber)}</strong> is marked delivered.</p><p>If you have a moment, you can leave a review on the product page: <a href="${escapeHtml(reviewUrl)}">Review your purchase</a>.</p>` };

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Zelvomart Orders <orders@zelvomart.com>",
    to: order.email,
    subject: content.subject,
    html: content.html,
  });
}
