"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.restoreOrderStock = restoreOrderStock;
const client_1 = require("@prisma/client");
const db_1 = require("./db");
const settings_1 = require("./settings");
const jobs_1 = require("./jobs");
function decimal(value) {
    return new client_1.Prisma.Decimal(value.toFixed(2));
}
async function createOrder(input) {
    const existing = await db_1.prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true },
    });
    if (existing)
        return existing;
    const [minimumPrice, defaultBundleDiscount, deliveryRule, requiredFields, paymentMethods] = await Promise.all([
        (0, settings_1.getSetting)("store.minimumSellingPrice", 1000),
        (0, settings_1.getSetting)("store.bundleDefaultDiscountPercent", 5),
        (0, settings_1.getSetting)("store.delivery", { mode: "FREE", flatRate: 0, freeAbove: 0, codFee: 0 }),
        (0, settings_1.getSetting)("checkout.requiredFields", {
            fullName: true,
            phone: true,
            email: true,
            city: true,
            address: true,
            postcode: true,
            terms: true,
        }),
        (0, settings_1.getSetting)("payments.methods", ["COD"]),
    ]);
    if (!paymentMethods.includes(input.paymentMethod))
        throw new Error("PAYMENT_METHOD_DISABLED");
    if (requiredFields.email && !input.email)
        throw new Error("EMAIL_REQUIRED");
    if (requiredFields.postcode && !input.postcode)
        throw new Error("POSTCODE_REQUIRED");
    if (requiredFields.terms && !input.terms)
        throw new Error("TERMS_REQUIRED");
    const productIds = [...new Set(input.cart.map((item) => item.productId))];
    const products = await db_1.prisma.product.findMany({
        where: { id: { in: productIds }, status: "PUBLISHED" },
        include: { variants: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const prepared = [];
    for (const item of input.cart) {
        const product = productMap.get(item.productId);
        if (!product)
            throw new Error("PRODUCT_NOT_AVAILABLE");
        const variant = item.variantId ? product.variants.find((row) => row.id === item.variantId && row.active) : undefined;
        if (item.variantId && !variant)
            throw new Error("VARIANT_NOT_AVAILABLE");
        const base = Number(variant?.priceOverride ?? product.salePrice ?? product.price);
        if (base < minimumPrice)
            throw new Error("PRICE_FLOOR_VIOLATION");
        const bundleDiscountPercent = Number(product.bundleDiscountPercent ?? defaultBundleDiscount);
        if (item.bundleSize === 2 && product.bundleEnabled && base * (1 - bundleDiscountPercent / 100) < minimumPrice) {
            throw new Error("PRICE_FLOOR_VIOLATION");
        }
        const unitCount = item.quantity * item.bundleSize;
        const raw = base * unitCount;
        const discount = item.bundleSize === 2 && product.bundleEnabled ? raw * (bundleDiscountPercent / 100) : 0;
        const total = raw - discount;
        const stock = variant ? variant.stock : product.stock;
        if (stock < unitCount)
            throw new Error("OUT_OF_STOCK");
        const images = Array.isArray(product.images) ? product.images : [];
        prepared.push({
            productId: product.id,
            variantId: variant?.id,
            sku: variant?.sku || product.sku,
            title: product.title,
            variantLabel: variant?.name,
            quantity: unitCount,
            stockNeeded: unitCount,
            unitPrice: base,
            lineTotal: total,
            bundleDiscount: discount,
            imageUrl: variant?.imageUrl || images[0],
        });
    }
    const subtotal = prepared.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const bundleSaving = prepared.reduce((sum, item) => sum + item.bundleDiscount, 0);
    const discountedSubtotal = subtotal - bundleSaving;
    let deliveryFee = 0;
    if (deliveryRule.mode === "FLAT")
        deliveryFee = Number(deliveryRule.flatRate || 0);
    if (deliveryRule.mode === "FREE_ABOVE") {
        deliveryFee = discountedSubtotal >= Number(deliveryRule.freeAbove || 0) ? 0 : Number(deliveryRule.flatRate || 0);
    }
    const codFee = input.paymentMethod === "COD" ? Number(deliveryRule.codFee || 0) : 0;
    const total = discountedSubtotal + deliveryFee + codFee;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db_1.prisma.order.findMany({
        where: { phone: input.phone, createdAt: { gte: since } },
        include: { items: true },
        take: 20,
    });
    const signature = prepared
        .map((item) => `${item.sku}:${item.quantity}`)
        .sort()
        .join("|");
    const possibleDuplicate = recent.some((order) => order.items
        .map((item) => `${item.sku}:${item.quantity}`)
        .sort()
        .join("|") === signature);
    const existingCustomer = await db_1.prisma.customer.findUnique({ where: { phone: input.phone } });
    const blocklisted = Boolean(existingCustomer?.blocklisted);
    const cityKnown = await db_1.prisma.city.findUnique({ where: { name: input.city } });
    const initialStatus = blocklisted ? "ON_HOLD" : "NEW";
    const result = await db_1.prisma.$transaction(async (tx) => {
        await tx.sequence.upsert({
            where: { name: "order" },
            update: {},
            create: { name: "order", value: 10000 },
        });
        const seq = await tx.sequence.update({
            where: { name: "order" },
            data: { value: { increment: 1 } },
        });
        const orderNumber = `ZM-${seq.value}`;
        const customer = await tx.customer.upsert({
            where: { phone: input.phone },
            update: { name: input.fullName, email: input.email || undefined },
            create: { phone: input.phone, name: input.fullName, email: input.email || undefined },
        });
        for (const item of prepared) {
            if (item.variantId) {
                const changed = await tx.variant.updateMany({
                    where: { id: item.variantId, stock: { gte: item.stockNeeded } },
                    data: { stock: { decrement: item.stockNeeded } },
                });
                if (changed.count !== 1)
                    throw new Error("OUT_OF_STOCK");
            }
            else {
                const changed = await tx.product.updateMany({
                    where: { id: item.productId, stock: { gte: item.stockNeeded } },
                    data: { stock: { decrement: item.stockNeeded } },
                });
                if (changed.count !== 1)
                    throw new Error("OUT_OF_STOCK");
            }
        }
        const source = input.source || {};
        const firstTouch = source.firstTouch && typeof source.firstTouch === "object" ? source.firstTouch : {};
        const lastTouch = source.lastTouch && typeof source.lastTouch === "object" ? source.lastTouch : {};
        const rawSource = source.utm_source || lastTouch.utm_source || firstTouch.utm_source || "direct";
        const sourceName = (() => {
            const value = String(rawSource || "direct").trim().toLowerCase();
            if (["fb", "facebook"].includes(value) || value.includes("facebook"))
                return "facebook";
            if (["ig", "instagram"].includes(value) || value.includes("instagram"))
                return "instagram";
            if (value.includes("google"))
                return "google";
            if (value.includes("tiktok"))
                return "tiktok";
            return value || "direct";
        })();
        const order = await tx.order.create({
            data: {
                orderNumber,
                idempotencyKey: input.idempotencyKey,
                customerId: customer.id,
                fullName: input.fullName,
                phone: input.phone,
                email: input.email || null,
                city: input.city,
                address: input.address,
                postcode: input.postcode || null,
                notes: [input.orderNotes, !cityKnown ? "City entered as free text; review before booking." : null]
                    .filter(Boolean)
                    .join("\n") || null,
                status: initialStatus,
                paymentMethod: input.paymentMethod,
                subtotal: decimal(subtotal),
                bundleSaving: decimal(bundleSaving),
                deliveryFee: decimal(deliveryFee),
                codFee: decimal(codFee),
                total: decimal(total),
                source: sourceName,
                firstTouch: source.firstTouch || null,
                lastTouch: source.lastTouch || source,
                fbp: input.fbp,
                fbc: input.fbc,
                clarityId: input.clarityId,
                replaySessionId: input.replaySessionId || null,
                clientIp: input.clientIp || null,
                clientUserAgent: input.clientUserAgent || null,
                experiments: input.experiments,
                possibleDuplicate,
                blocklistedAtOrder: blocklisted,
                items: {
                    create: prepared.map((item) => ({
                        productId: item.productId,
                        variantId: item.variantId,
                        sku: item.sku,
                        title: item.title,
                        variantLabel: item.variantLabel,
                        quantity: item.quantity,
                        unitPrice: decimal(item.unitPrice),
                        lineTotal: decimal(item.lineTotal),
                        bundleDiscount: decimal(item.bundleDiscount),
                        imageUrl: item.imageUrl,
                    })),
                },
                statusHistory: {
                    create: {
                        to: initialStatus,
                        note: blocklisted ? "Order held because this customer is blocklisted." : "Order placed.",
                    },
                },
            },
            include: { items: true },
        });
        const jobs = await Promise.all([
            tx.job.create({ data: { name: "order-team-email", orderId: order.id, payload: { orderId: order.id } } }),
            tx.job.create({ data: { name: "customer-order-email", orderId: order.id, payload: { orderId: order.id } } }),
            ...(order.test || order.staffCreated
                ? []
                : [tx.job.create({ data: { name: "meta-purchase", orderId: order.id, payload: { orderId: order.id } } })]),
        ]);
        return { order, jobIds: jobs.map((job) => job.id) };
    });
    await Promise.allSettled(result.jobIds.map((id) => (0, jobs_1.dispatchJobRow)(id)));
    return result.order;
}
async function restoreOrderStock(orderId) {
    const order = await db_1.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order)
        return;
    await db_1.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
            if (item.variantId) {
                await tx.variant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
            }
            else if (item.productId) {
                await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
            }
        }
    });
}
