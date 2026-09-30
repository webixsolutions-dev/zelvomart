import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "zelvomart", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, service: "zelvomart" }, { status: 503 });
  }
}
