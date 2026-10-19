import { z } from "zod";
import { normalizePakistanPhone } from "./phone";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullish(),
  quantity: z.number().int().min(1).max(20),
  bundleSize: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(10).max(20),
    email: z.string().trim().email().optional().or(z.literal("")),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(8).max(500),
    postcode: z.string().trim().max(20).optional().or(z.literal("")),
    orderNotes: z.string().trim().max(1000).optional().or(z.literal("")),
    // Older clients may still send this. The checkout displays a terms notice, not a required checkbox.
    terms: z.boolean().optional(),
    paymentMethod: z.enum(["COD", "NAYAPAY"]).default("COD"),
    cart: z.array(cartItemSchema).min(1).max(50),
    honeypot: z.string().max(0).optional().or(z.literal("")),
    source: z.record(z.string(), z.unknown()).optional(),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
    ttp:z.string().max(500).optional(),
    ttclid:z.string().max(500).optional(),
    visitorId:z.string().uuid().optional(),
    replaySessionId: z.string().uuid().optional(),
    couponCode: z.string().trim().max(40).optional(),
  })
  .transform((value, ctx) => {
    const phone = normalizePakistanPhone(value.phone);
    if (!phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Pakistani mobile number." });
      return z.NEVER;
    }
    return { ...value, phone, email:value.email?.toLowerCase() };
  });
