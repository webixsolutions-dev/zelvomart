import { NextRequest, NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validators";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeIp } from "@/lib/security";
import { createOrder } from "@/lib/order";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.honeypot) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const ip = safeIp(request.headers);
    await Promise.all([
      enforceRateLimit(`checkout:ip:${ip}`, 12, 15 * 60 * 1000),
      enforceRateLimit(`checkout:phone:${parsed.data.phone}`, 6, 60 * 60 * 1000),
    ]);
  } catch {
    return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  try {
    const order = await createOrder({
      ...(parsed.data as any),
      clientIp: safeIp(request.headers),
      clientUserAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ orderNumber: order.orderNumber, orderId: order.id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ORDER_FAILED";
    const status = code === "OUT_OF_STOCK" ? 409 : code === "PRICE_FLOOR_VIOLATION" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
