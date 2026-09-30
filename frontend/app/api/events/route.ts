import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { safeIp } from "@/lib/security";
import { sendMetaServerEvent } from "@/lib/meta";

const schema = z.object({
  eventName: z.enum(["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "Purchase", "Contact"]),
  eventId: z.string().min(6).max(120),
  sourceUrl: z.string().url().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
});

function isBot(userAgent: string) {
  return /bot|crawler|spider|slurp|bingpreview|facebookexternalhit/i.test(userAgent);
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  if (isBot(userAgent)) return NextResponse.json({ ok: true, ignored: "bot" });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  const data = parsed.data;

  // Browser Purchase must fire once per order/event ID even if the confirmation
  // page is refreshed or reopened. The server Purchase remains authoritative.
  if (data.eventName === "Purchase") {
    const prior = await prisma.eventLog.findFirst({
      where: { eventName: "Purchase", eventId: data.eventId, channel: "browser" },
      select: { id: true },
    });
    if (prior) return NextResponse.json({ ok: true, deduplicated: true });
  }

  await prisma.eventLog.create({
    data: {
      eventName: data.eventName,
      eventId: data.eventId,
      channel: "browser",
      sourceUrl: data.sourceUrl,
      payload: data.params as any,
    },
  });

  // Purchase server delivery is owned by the order-creation job. The browser event is
  // still recorded and Pixel fires with the same order-number event ID.
  if (data.eventName !== "Purchase") {
    try {
      await sendMetaServerEvent({
        eventName: data.eventName,
        eventId: data.eventId,
        sourceUrl: data.sourceUrl,
        userAgent,
        ip: safeIp(request.headers),
        fbp: data.fbp,
        fbc: data.fbc,
        customData: data.params,
      });
    } catch (error) {
      return NextResponse.json({ ok: false, forwarded: false }, { status: 202 });
    }
  }

  return NextResponse.json({ ok: true });
}
