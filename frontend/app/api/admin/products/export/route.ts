import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

function csv(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "products.write")) return new NextResponse("Forbidden", { status: 403 });
  const products = await prisma.product.findMany({ include: { category: true }, orderBy: { updatedAt: "desc" }, take: 10000 });
  const headers = ["title","slug","sku","category","price","salePrice","costPrice","stock","status","shortDescription","descriptionHtml","images","videoUrl","featured","bundleEnabled","bundleDiscountPercent","seoTitle","seoDescription"];
  const rows = products.map((p) => [p.title,p.slug,p.sku,p.category?.name || "",p.price,p.salePrice ?? "",p.costPrice ?? "",p.stock,p.status,p.shortDescription ?? "",p.descriptionHtml ?? "",Array.isArray(p.images) ? p.images.join("|") : "",p.videoUrl ?? "",p.featured,p.bundleEnabled,p.bundleDiscountPercent ?? "",p.seoTitle ?? "",p.seoDescription ?? ""].map(csv).join(","));
  return new NextResponse([headers.join(","), ...rows].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="zelvomart-products.csv"' } });
}
