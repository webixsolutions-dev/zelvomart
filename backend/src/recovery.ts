import type { Express, Request } from "express";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { emailIdentity, offerBcc } from "./lib/email-delivery";
import { prisma } from "./lib/db";
import { requireAuth, type AuthedRequest } from "./lib/auth";
import { consumeRateLimit, requestIp } from "./lib/rate-limit";
import { getSetting, setSetting } from "./lib/settings";
import { normalizePakistanPhone } from "./lib/phone";
import { cartItemSchema } from "./lib/validators";
import { SITE_ORIGIN } from "./lib/site-url";
import { couponDiscount } from "./lib/coupons";
import { recoveryDiscountPercent } from "./lib/recovery-settings";
import { recoveryOfferCode, recoveryOfferExpiry } from "./lib/recovery-offer";
export const recoveryDefaults = {
  discountPercent: "5",
  enabled: "true",
  coupon: "",
  subject: "{name}, your cart is still waiting",
  email:
    "Hi {name},\nYou left {product} in your cart at Zelvomart. We have kept it for you.\nUse code {coupon} for {discount} off before {expiry}.\nComplete my order: {cart_link}\nQuestions? Reply to this email or message us on WhatsApp.\nTeam Zelvomart",
  whatsapp:
    "Assalam o Alaikum {name}, Zelvomart se baat kar rahe hain. Aap ka {product} cart mein reh gaya tha. Code {coupon} se {discount} off mil jaye ga, {expiry} tak. Order yahan se complete karein: {cart_link}",
};
export function recoveryStatus(cart: { convertedAt: Date | null; followedUpAt: Date | null; lostAt?: Date | null }) {
  return cart.convertedAt
    ? cart.followedUpAt && cart.followedUpAt < cart.convertedAt
      ? "Recovered"
      : "Ordered without follow-up"
    : cart.lostAt
      ? "Lost"
      : cart.followedUpAt
        ? "Contacted"
        : "New";
}
export function assertContactable(
  cart: { convertedAt: Date | null; updatedAt: Date; lostAt?: Date | null },
  now = Date.now(),
) {
  if (cart.convertedAt) throw new Error("This cart has already converted.");
  if (cart.lostAt) throw new Error("This cart is marked lost.");
  if (now - cart.updatedAt.getTime() < 3600000)
    throw new Error("Wait at least one hour after the shopper last updated this cart.");
}
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{([a-z_]+)\}/g, (_m, key) => values[key] || "");
export function registerRecovery(app: Express, findSession: (req: Request) => Promise<any>) {
  app.post("/api/checkout/abandoned", async (req, res) => {
    if (!(await consumeRateLimit("abandon:" + requestIp(req), 30, 60000)).allowed)
      return res.status(429).json({ error: "Too many requests." });
    const session = await findSession(req),
      phone = normalizePakistanPhone(String(req.body.phone || "")) || null,
      email = String(session?.user.email || req.body.email || "")
        .trim()
        .toLowerCase();
    if (!phone && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ ok: true });
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))
      return res.status(400).json({ error: "Invalid email." });
    const cart = cartItemSchema.array().min(1).max(50).safeParse(req.body.cart);
    if (!cart.success) return res.status(400).json({ error: "Invalid cart." });
    const key = email ? "email:" + email : "phone:" + phone;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
      const existing = await tx.abandonedCheckout.findFirst({
        where: { OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])], convertedAt: null },
        orderBy: { createdAt: "desc" },
      });
      const data = {
        phone,
        email: email || null,
        fullName: String(session?.user.name || req.body.fullName || "").slice(0, 100) || null,
        city: String(req.body.city || "").slice(0, 100) || null,
        address: String(req.body.address || "").slice(0, 500) || null,
        cart: cart.data,
        source: req.body.source && typeof req.body.source === "object" ? req.body.source : {},
      };
      if (existing) await tx.abandonedCheckout.update({ where: { id: existing.id }, data });
      else await tx.abandonedCheckout.create({ data: { ...data, restoreToken: randomBytes(32).toString("hex") } });
    });
    res.json({ ok: true });
  });
  app.get("/api/recovery/restore/:token", async (req, res) => {
    if (!(await consumeRateLimit("restore:" + requestIp(req), 30, 60000)).allowed)
      return res.status(429).json({ error: "Too many requests." });
    const token = String(req.params.token);
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ error: "Restore link not found." });
    const cart = await prisma.abandonedCheckout.findUnique({ where: { restoreToken: token } });
    if (!cart || cart.convertedAt || Date.now() - cart.createdAt.getTime() > 30 * 86400000)
      return res.status(410).json({ error: "This cart link has expired or the order was already placed." });
    const lines = cartItemSchema.array().parse(cart.cart),
      products = await prisma.product.findMany({
        where: { id: { in: lines.map((i) => i.productId) }, status: "PUBLISHED" },
        include: { variants: true },
      });
    const items = lines.flatMap((i) => {
      const p = products.find((p) => p.id === i.productId),
        v = p?.variants.find((v) => v.id === i.variantId && v.active);
      if (!p || (i.variantId && !v) || (!v && p.variants.some((v) => v.active))) return [];
      return [
        {
          ...i,
          sku: v?.sku || p.sku,
          slug: p.slug,
          name: p.title,
          price: Number(v?.priceOverride ?? p.salePrice ?? p.price),
          image: v?.imageUrl || (Array.isArray(p.images) ? p.images[0] : undefined),
          variantLabel: v?.name,
        },
      ];
    });
    if (!items.length) return res.status(410).json({ error: "These products are no longer available." });
    res.json({ items, unavailable: lines.length - items.length });
  });
  app.get("/api/recovery/unsubscribe", async (req, res) => {
    const token = String(req.query.token || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).send("Invalid unsubscribe link.");
    res
      .type("html")
      .send(
        `<html><body><h1>Stop cart offer emails</h1><form method="post"><input type="hidden" name="token" value="${token}"><button>Unsubscribe</button></form></body></html>`,
      );
  });
  app.post("/api/recovery/unsubscribe", async (req, res) => {
    const token = String(req.body.token || req.query.token || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).send("Invalid unsubscribe link.");
    const cart = await prisma.abandonedCheckout.findUnique({ where: { restoreToken: token } });
    if (!cart?.email) return res.status(404).send("Email not found.");
    await prisma.recoveryUnsubscribe.upsert({
      where: { email: cart.email.toLowerCase() },
      create: { email: cart.email.toLowerCase() },
      update: {},
    });
    res.send("You have been unsubscribed from cart offer emails.");
  });
  app.get("/api/admin/recovery/templates", requireAuth("customers.read"), async (_req, res) =>
    res.json({ ...recoveryDefaults, ...(await getSetting("recovery.templates", recoveryDefaults)) }),
  );
  app.put("/api/admin/recovery/templates", requireAuth("customers.write"), async (req: AuthedRequest, res) => {
    const data = Object.fromEntries(
      Object.keys(recoveryDefaults).map((key) => [
        key,
        String(req.body[key] ?? recoveryDefaults[key as keyof typeof recoveryDefaults]).slice(0, 6000),
      ]),
    );
    try {
      recoveryDiscountPercent(data.discountPercent);
    } catch {
      return res.status(400).json({ error: "Recovery discount must be between 1% and 100%." });
    }
    if (!["true", "false"].includes(data.enabled))
      return res.status(400).json({ error: "Invalid recovery offer status." });
    if (!data.subject || !data.email || !data.whatsapp)
      return res.status(400).json({ error: "Complete all message templates." });
    await setSetting("recovery.templates", data);
    await prisma.auditLog.create({ data: { userId: req.admin?.id, action: "update", entity: "RecoveryTemplates" } });
    res.json({ ok: true });
  });
  app.get("/api/admin/abandoned", requireAuth("customers.read"), async (_req, res) => {
    const rows = await prisma.abandonedCheckout.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    const ids = [
      ...new Set(rows.flatMap((r) => (Array.isArray(r.cart) ? (r.cart as any[]).map((i) => String(i.productId)) : []))),
    ];
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, images: true, price: true, salePrice: true },
    });
    res.json(
      rows.map((r) => ({
        ...r,
        status: recoveryStatus(r),
        cart: Array.isArray(r.cart)
          ? (r.cart as any[]).map((i) => ({ ...i, product: products.find((p) => p.id === i.productId) }))
          : [],
        cartValue: Array.isArray(r.cart)
          ? (r.cart as any[]).reduce(
              (n, i) =>
                n +
                Number(
                  products.find((p) => p.id === i.productId)?.salePrice ??
                    products.find((p) => p.id === i.productId)?.price ??
                    0,
                ) *
                  i.quantity *
                  (i.bundleSize || 1),
              0,
            )
          : 0,
      })),
    );
  });
  app.post("/api/admin/abandoned/:id/:action", requireAuth("customers.write"), async (req: AuthedRequest, res) => {
    const id = String(req.params.id),
      action = String(req.params.action);
    try {
      let cart = await prisma.abandonedCheckout.findUniqueOrThrow({ where: { id } });
      assertContactable(cart);
      if (action === "contacted" || action === "lost") {
        await prisma.abandonedCheckout.update({
          where: { id },
          data: {
            ...(action === "lost"
              ? { lostAt: new Date() }
              : { followedUpAt: cart.followedUpAt || new Date(), followedUpBy: req.admin?.id }),
            updatedAt: cart.updatedAt,
          },
        });
        return res.json({ ok: true });
      }
      if (!["message", "email"].includes(action)) return res.status(404).json({ error: "NOT_FOUND" });
      if (!cart.restoreToken)
        cart = await prisma.abandonedCheckout.update({
          where: { id },
          data: { restoreToken: randomBytes(32).toString("hex"), updatedAt: cart.updatedAt },
        });
      const templates = { ...recoveryDefaults, ...(await getSetting("recovery.templates", recoveryDefaults)) };
      if (templates.enabled === "false") throw new Error("Recovery offers are disabled in Settings.");
      const baseCoupon = templates.coupon
        ? await prisma.coupon.findUnique({ where: { code: templates.coupon.trim().toUpperCase() } })
        : {
            code: "DEFAULT",
            type: "PERCENT",
            amount: recoveryDiscountPercent(templates.discountPercent),
            active: true,
            expiresAt: null,
          };
      if (!baseCoupon) throw new Error("The selected recovery coupon no longer exists.");
      couponDiscount(baseCoupon, 100);
      if (baseCoupon.code.startsWith("RCV-"))
        throw new Error("Select a regular coupon as the template, not an existing single-use recovery code.");
      // One stable, single-use code per cart; retries never extend its original expiry.
      const offerCode = recoveryOfferCode(cart.restoreToken!);
      const coupon = await prisma.coupon.upsert({
        where: { code: offerCode },
        update: {},
        create: {
          code: offerCode,
          type: baseCoupon.type,
          amount: baseCoupon.amount,
          active: true,
          expiresAt: recoveryOfferExpiry(new Date(), baseCoupon.expiresAt),
        },
      });
      couponDiscount(coupon, 100);
      if (coupon.usedCount > 0) throw new Error("This recovery offer has already been used.");
      const lines = Array.isArray(cart.cart) ? (cart.cart as any[]) : [],
        product = lines[0] ? await prisma.product.findUnique({ where: { id: String(lines[0].productId) } }) : null;
      const values = {
        name: cart.fullName || "there",
        product: product?.title || "your items",
        coupon: coupon.code,
        discount: coupon.type === "PERCENT" ? `${coupon.amount}%` : `Rs ${coupon.amount}`,
        expiry: coupon.expiresAt
          ? coupon.expiresAt.toLocaleString("en-PK", {
              timeZone: "Asia/Karachi",
              dateStyle: "medium",
              timeStyle: "short",
            }) + " PKT"
          : "the offer ends",
        cart_link: `${SITE_ORIGIN}/cart?restore=${cart.restoreToken}&coupon=${encodeURIComponent(coupon.code)}`,
      };
      if (action === "message") return res.json({ message: fill(templates.whatsapp, values), link: values.cart_link });
      if (!cart.email) throw new Error("This cart has no email address.");
      if (cart.emailSentAt) throw new Error("An offer email was already sent for this cart.");
      if (await prisma.recoveryUnsubscribe.findUnique({ where: { email: cart.email.toLowerCase() } }))
        throw new Error("This email has unsubscribed.");
      if (!process.env.RESEND_API_KEY) throw new Error("Email delivery is not configured.");
      const claimed = await prisma.abandonedCheckout.updateMany({
        where: { id, emailSentAt: null, convertedAt: null, updatedAt: { lte: new Date(Date.now() - 3600000) } },
        data: { emailSentAt: new Date(), updatedAt: cart.updatedAt },
      });
      if (!claimed.count) throw new Error("This cart changed or was already contacted. Refresh and try again.");
      let rejected = false;
      try {
        const latest = await prisma.abandonedCheckout.findUniqueOrThrow({ where: { id } });
        if (latest.convertedAt) throw new Error("This cart has already converted.");
        const sent = await new Resend(process.env.RESEND_API_KEY).emails.send(
          {
            ...emailIdentity("offers"),
            to: cart.email,
            // Hidden copy for the team (OFFERS_COPY_TO); the customer's subject stays as it is.
            ...offerBcc(),
            subject: fill(templates.subject, values),
            text:
              fill(templates.email, values) +
              `\n\nUnsubscribe: ${SITE_ORIGIN}/api/store-proxy/api/recovery/unsubscribe?token=${cart.restoreToken}`,
          },
          { idempotencyKey: `cart-offer-${cart.id}` },
        );
        if (sent.error) {
          rejected = true;
          throw new Error(sent.error.message);
        }
        await prisma.abandonedCheckout.update({
          where: { id },
          data: {
            followedUpAt: cart.followedUpAt || new Date(),
            followedUpBy: req.admin?.id,
            updatedAt: cart.updatedAt,
          },
        });
      } catch (error) {
        if (rejected)
          await prisma.abandonedCheckout.update({
            where: { id },
            data: { emailSentAt: null, updatedAt: cart.updatedAt },
          });
        throw error;
      }
      // An uncertain network result keeps its reservation to avoid duplicate offers.
      await prisma.auditLog.create({
        data: { userId: req.admin?.id, action: "offer_email", entity: "AbandonedCheckout", entityId: id },
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Unable to update this cart." });
    }
  });
}
