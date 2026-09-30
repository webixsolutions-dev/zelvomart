import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePakistanPhone } from "@/lib/phone";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePakistanPhone(String(body.phone || ""));
  if (!phone || !Array.isArray(body.cart) || !body.cart.length) return NextResponse.json({ ok: false }, { status: 400 });

  const existing = await prisma.abandonedCheckout.findFirst({
    where: { phone, convertedAt: null, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.abandonedCheckout.update({
      where: { id: existing.id },
      data: {
        fullName: body.fullName || undefined,
        email: body.email || undefined,
        city: body.city || undefined,
        address: body.address || undefined,
        cart: body.cart,
        source: body.source || undefined,
      },
    });
  } else {
    await prisma.abandonedCheckout.create({
      data: {
        phone,
        fullName: body.fullName || null,
        email: body.email || null,
        city: body.city || null,
        address: body.address || null,
        cart: body.cart,
        source: body.source || undefined,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
