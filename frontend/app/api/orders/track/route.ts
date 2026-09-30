import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePakistanPhone } from "@/lib/phone";
import { postexTrackingUrl } from "@/lib/postex";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const orderNumber = String(body.orderNumber || "").trim().toUpperCase();
  const phone = normalizePakistanPhone(String(body.phone || ""));
  if (!orderNumber || !phone) return NextResponse.json({ error: "Invalid details" }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { orderNumber, phone },
    select: {
      orderNumber: true,
      status: true,
      city: true,
      postexTracking: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({
    ...order,
    trackingUrl: order.postexTracking ? postexTrackingUrl(order.postexTracking) : null,
  });
}
