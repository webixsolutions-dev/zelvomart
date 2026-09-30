import { NextRequest, NextResponse } from "next/server";
import { ProductStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function value(row: Record<string, unknown>, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (found && String(found[1] ?? "").trim()) return String(found[1]).trim();
  }
  return "";
}
function numberOrNull(input: string) {
  if (!input) return null;
  const parsed = Number(input.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function bool(input: string, fallback = false) {
  if (!input) return fallback;
  return ["1", "true", "yes", "y", "on", "featured", "published"].includes(input.toLowerCase());
}
function status(input: string) {
  const key = input.toUpperCase().replace(/\s+/g, "_");
  return Object.values(ProductStatus).includes(key as ProductStatus) ? key as ProductStatus : ProductStatus.DRAFT;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "products.write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { rows?: Record<string, unknown>[] } | null;
  const rows = Array.isArray(body?.rows) ? body!.rows!.slice(0, 1000) : [];
  if (!rows.length) return NextResponse.json({ error: "No CSV rows received." }, { status: 400 });

  const minPrice = await getSetting<number>("store.minimumSellingPrice", 1000);
  const categories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } });
  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    categoryMap.set(category.name.toLowerCase(), category.id);
    categoryMap.set(category.slug.toLowerCase(), category.id);
  }

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const title = value(row, "title", "name", "product name");
    const sku = value(row, "sku", "product sku");
    const regularPrice = numberOrNull(value(row, "price", "regular price"));
    if (!title || !sku || regularPrice === null || regularPrice < minPrice) {
      skipped += 1;
      errors.push(`Row ${index + 2}: title, SKU and price >= Rs ${minPrice} are required.`);
      continue;
    }

    const salePrice = numberOrNull(value(row, "salePrice", "sale price"));
    if (salePrice !== null && salePrice < minPrice) {
      skipped += 1; errors.push(`Row ${index + 2}: sale price is below Rs ${minPrice}.`); continue;
    }
    const categoryName = value(row, "category", "categoryName", "category slug");
    const images = value(row, "images", "image urls", "image").split(/\||\n|;/).map((v) => v.trim()).filter(Boolean);
    const requestedSlug = value(row, "slug") || title;
    const productData = {
      title,
      slug: slugify(requestedSlug),
      categoryId: categoryName ? categoryMap.get(categoryName.toLowerCase()) || categoryMap.get(slugify(categoryName)) || null : null,
      price: regularPrice,
      salePrice,
      costPrice: numberOrNull(value(row, "costPrice", "cost price")),
      stock: Math.max(0, Math.trunc(numberOrNull(value(row, "stock", "quantity")) ?? 0)),
      status: status(value(row, "status")),
      shortDescription: value(row, "shortDescription", "short description") || null,
      descriptionHtml: value(row, "descriptionHtml", "description", "main description") || null,
      images,
      videoUrl: value(row, "videoUrl", "video url") || null,
      featured: bool(value(row, "featured"), false),
      bundleEnabled: bool(value(row, "bundleEnabled", "bundle enabled"), true),
      bundleDiscountPercent: numberOrNull(value(row, "bundleDiscountPercent", "bundle discount", "bundle discount percent")),
      seoTitle: value(row, "seoTitle", "seo title") || null,
      seoDescription: value(row, "seoDescription", "seo description") || null,
    };

    try {
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data: productData });
        updated += 1;
      } else {
        let safeSlug = productData.slug;
        const slugOwner = await prisma.product.findUnique({ where: { slug: safeSlug }, select: { id: true } });
        if (slugOwner) safeSlug = `${safeSlug}-${sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        await prisma.product.create({ data: { ...productData, slug: safeSlug, sku } });
        created += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Could not import product"}`);
    }
  }

  await prisma.auditLog.create({ data: { userId: session.user.id, action: "csv_import", entity: "Product", details: { created, updated, skipped, errors: errors.slice(0, 25) } as any } });
  return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 25) });
}
