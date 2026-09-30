import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "orders.export")) return new NextResponse("Forbidden", { status: 403 });

  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  const header = ["Order", "Date", "Status", "Name", "Phone", "City", "Total", "Source"].join(",");
  const rows = orders.map((order) => [order.orderNumber, order.createdAt.toISOString(), order.status, order.fullName, order.phone, order.city, order.total, order.source].map(csv).join(","));
  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="zelvomart-orders.csv"`,
    },
  });
}
