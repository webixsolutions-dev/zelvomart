import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePakistanPhone } from "@/lib/phone";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeIp } from "@/lib/security";

const schema = z.object({
  productId: z.string().min(1),
  orderNumber: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  name: z.string().trim().min(2).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(2000),
  honeypot: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  if (parsed.data.honeypot) return NextResponse.json({ ok: true });

  try {
    await enforceRateLimit(`review:${safeIp(request.headers)}`, 5, 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });

  let orderId: string | undefined;
  let customerId: string | undefined;
  let verified = false;

  if (parsed.data.orderNumber && parsed.data.phone) {
    try {
      const phone = normalizePakistanPhone(parsed.data.phone);
      if (!phone) throw new Error("INVALID_PHONE");
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: parsed.data.orderNumber.toUpperCase(),
          phone,
          status: "DELIVERED",
          items: { some: { productId: parsed.data.productId } },
        },
        select: { id: true, customerId: true },
      });
      if (order) {
        orderId = order.id;
        customerId = order.customerId || undefined;
        verified = true;
      }
    } catch {
      verified = false;
    }
  }

  const review = await prisma.review.create({
    data: {
      productId: parsed.data.productId,
      orderId,
      customerId,
      name: parsed.data.name,
      rating: parsed.data.rating,
      body: parsed.data.body,
      verified,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, reviewId: review.id, message: "Review submitted for moderation." });
}
