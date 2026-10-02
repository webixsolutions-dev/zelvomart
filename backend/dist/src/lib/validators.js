"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutSchema = exports.cartItemSchema = void 0;
const zod_1 = require("zod");
const phone_1 = require("./phone");
exports.cartItemSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    variantId: zod_1.z.string().nullish(),
    quantity: zod_1.z.number().int().min(1).max(20),
    bundleSize: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2)]).default(1),
});
exports.checkoutSchema = zod_1.z
    .object({
    idempotencyKey: zod_1.z.string().uuid(),
    fullName: zod_1.z.string().trim().min(2).max(100),
    phone: zod_1.z.string().trim().min(10).max(20),
    email: zod_1.z.string().trim().email().optional().or(zod_1.z.literal("")),
    city: zod_1.z.string().trim().min(2).max(100),
    address: zod_1.z.string().trim().min(8).max(500),
    postcode: zod_1.z.string().trim().max(20).optional().or(zod_1.z.literal("")),
    orderNotes: zod_1.z.string().trim().max(1000).optional().or(zod_1.z.literal("")),
    terms: zod_1.z.boolean(),
    paymentMethod: zod_1.z.enum(["COD", "NAYAPAY"]).default("COD"),
    cart: zod_1.z.array(exports.cartItemSchema).min(1).max(50),
    honeypot: zod_1.z.string().max(0).optional().or(zod_1.z.literal("")),
    source: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    fbp: zod_1.z.string().optional(),
    fbc: zod_1.z.string().optional(),
    clarityId: zod_1.z.string().optional(),
    replaySessionId: zod_1.z.string().uuid().optional(),
    experiments: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
})
    .transform((value, ctx) => {
    const phone = (0, phone_1.normalizePakistanPhone)(value.phone);
    if (!phone) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Pakistani mobile number." });
        return zod_1.z.NEVER;
    }
    return { ...value, phone };
});
