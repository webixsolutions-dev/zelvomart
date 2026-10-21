import "dotenv/config";
import crypto from "node:crypto";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import { readCatalogMeta, writeCatalogMeta } from "../src/lib/catalog-meta";
import { wooStock } from "../src/lib/wordpress-import";
import { isCloudStorageConfigured, uploadObject } from "../src/lib/storage";

const apply = process.argv.includes("--apply");
const source = (process.env.SOURCE_STORE_URL || "https://zelvomart.com").replace(/\/$/, "");
const consumerKey = process.env.WC_CONSUMER_KEY;
const consumerSecret = process.env.WC_CONSUMER_SECRET;

function stripHtml(value: string | undefined) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function api<T>(url: string): Promise<T> {
  const target = new URL(url);
  if (target.origin !== new URL(source).origin || target.protocol !== "https:")
    throw new Error("WooCommerce source must use the configured HTTPS origin.");
  target.searchParams.delete("consumer_key");
  target.searchParams.delete("consumer_secret");
  const response = await fetch(target, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "user-agent": "ZelvomartMigration/1.0",
      ...(consumerKey && consumerSecret
        ? { authorization: "Basic " + Buffer.from(consumerKey + ":" + consumerSecret).toString("base64") }
        : {}),
    },
  });
  if (!response.ok) throw new Error(`WooCommerce HTTP ${response.status} at ${target.pathname}`);
  return response.json() as Promise<T>;
}

function metaValue(row: any, keys: string[]) {
  const meta = Array.isArray(row?.meta_data) ? row.meta_data : [];
  for (const key of keys) {
    const hit = meta.find((item: any) => item?.key === key);
    if (hit?.value && typeof hit.value === "string") return stripHtml(hit.value);
    const direct = row?.meta?.[key] ?? row?.[key];
    if (typeof direct === "string" && direct.trim()) return stripHtml(direct);
  }
  return undefined;
}

function rankMathSeo(row: any) {
  return {
    title: metaValue(row, ["rank_math_title", "_rank_math_title", "rank_math_seo_title"]),
    description: metaValue(row, ["rank_math_description", "_rank_math_description", "rank_math_seo_description"]),
  };
}

function productVideoUrl(row: any) {
  return metaValue(row, [
    "product_video_url",
    "_product_video_url",
    "video_url",
    "_video_url",
    "youtube_url",
    "_youtube_url",
  ]);
}

async function maybeRehost(url: string) {
  if (!isCloudStorageConfigured()) return url;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(`Image import failed (HTTP ${response.status}). No source image fallback is allowed for launch.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/") || bytes.length > 20 * 1024 * 1024)
    throw new Error("Source image must be an image under 20 MB.");
  const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const key = `products/${crypto.createHash("sha1").update(url).digest("hex")}.${extension}`;
  return uploadObject(key, bytes, type);
}

async function importCategoriesAuthenticated() {
  let page = 1;
  while (true) {
    const url = new URL(`${source}/wp-json/wc/v3/products/categories`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("consumer_key", consumerKey!);
    url.searchParams.set("consumer_secret", consumerSecret!);
    const rows = await api<any[]>(url.toString());
    if (!rows.length) break;

    for (const row of rows) {
      const imageUrl = row.image?.src ? await maybeRehost(row.image.src) : null;
      const seo = rankMathSeo(row);
      await prisma.category.upsert({
        where: { slug: row.slug },
        update: {
          name: row.name,
          description: row.description || null,
          imageUrl,
          seoTitle: seo.title || stripHtml(row.name),
          seoDescription: seo.description || stripHtml(row.description),
        },
        create: {
          name: row.name,
          slug: row.slug,
          description: row.description || null,
          imageUrl,
          seoTitle: seo.title || stripHtml(row.name),
          seoDescription: seo.description || stripHtml(row.description),
        },
      });
    }
    if (rows.length < 100) break;
    page += 1;
  }
}

async function importProductsAuthenticated() {
  for (let page = 1; ; page++) {
    const rows = await api<any[]>(`${source}/wp-json/wc/v3/products?per_page=100&page=${page}&status=any`);
    for (const row of rows) {
      if (!["simple", "variable"].includes(row.type))
        throw new Error(`Unsupported WooCommerce product type for ${row.slug}: ${row.type}`);
      const sku = row.sku || `WP-${row.id}`,
        images: string[] = [],
        prepared: any[] = [];
      for (const image of row.images || []) if (image.src) images.push(await maybeRehost(image.src));
      for (const variationId of row.variations || []) {
        const v = await api<any>(`${source}/wp-json/wc/v3/products/${row.id}/variations/${variationId}`);
        prepared.push({
          sku: v.sku || `${sku}-${variationId}`,
          name:
            (v.attributes || [])
              .map((a: any) => a.option)
              .filter(Boolean)
              .join(" / ") || `Variant ${variationId}`,
          attributes: Object.fromEntries((v.attributes || []).map((a: any) => [String(a.name), String(a.option)])),
          priceOverride: v.price !== "" && v.price != null ? Number(v.price) : null,
          ...wooStock(v, row),
          imageUrl: v.image?.src ? await maybeRehost(v.image.src) : null,
          active: v.status === "publish",
          regularPrice: Number(v.regular_price || v.price || 0),
        });
      }
      if (new Set(prepared.map((v) => v.sku)).size !== prepared.length)
        throw new Error(`Duplicate variation SKU for ${row.slug}`);
      const seo = rankMathSeo(row),
        categorySlug = row.categories?.[0]?.slug;
      const category = categorySlug ? await prisma.category.findUnique({ where: { slug: categorySlug } }) : null;
      // Network and image uploads finish before the transaction. A failed variation
      // cannot leave a half-imported product or remove IDs used by existing carts/orders.
      await prisma.$transaction(
        async (tx) => {
          const previous = await tx.product.findUnique({ where: { slug: row.slug } });
          const meta = readCatalogMeta(previous?.sourceUrl) || {};
          const data = {
            title: row.name,
            sku,
            shortDescription: stripHtml(row.short_description),
            descriptionHtml: row.description || null,
            images,
            videoUrl: productVideoUrl(row) || null,
            categoryId: category?.id,
            price: Number(row.regular_price || row.price || 0),
            salePrice: row.sale_price ? Number(row.sale_price) : null,
            ...wooStock(row),
            status: (row.status === "publish" ? "PUBLISHED" : "DRAFT") as "PUBLISHED" | "DRAFT",
            featured: Boolean(row.featured),
            seoTitle: seo.title || stripHtml(row.name),
            seoDescription: seo.description || stripHtml(row.short_description),
            canonicalUrl: row.permalink,
            sourceId: String(row.id),
            sourceUrl: writeCatalogMeta({
              ...meta,
              legacySourceUrl: row.permalink,
              attributes: (row.attributes || []).map((a: any) => ({
                name: a.name,
                valuesText: (a.options || []).join(" | "),
                visible: a.visible,
                forVariations: a.variation,
              })),
              variations: prepared.map((v) => ({ sku: v.sku, name: v.name, regularPrice: v.regularPrice })),
            }),
          };
          const product = await tx.product.upsert({
            where: { slug: row.slug },
            update: data,
            create: {
              ...data,
              slug: row.slug,
              ...(row.date_created_gmt ? { createdAt: new Date(row.date_created_gmt + "Z") } : {}),
            },
          });
          for (const item of prepared) {
            const { regularPrice, ...variant } = item;
            const existing = await tx.variant.findUnique({ where: { sku: item.sku } });
            if (existing && existing.productId !== product.id)
              throw new Error(`Variation SKU conflict for ${item.sku}`);
            await tx.variant.upsert({
              where: { sku: item.sku },
              create: { ...variant, productId: product.id },
              update: variant,
            });
          }
          await tx.variant.updateMany({
            where: { productId: product.id, sku: { notIn: prepared.map((v) => v.sku) } },
            data: { active: false },
          });
        },
        { maxWait: 15000, timeout: 90000 },
      );
    }
    console.log(`Imported product page ${page} (${rows.length})`);
    if (rows.length < 100) break;
  }
}

async function importReviewsAuthenticated() {
  let page = 1;
  while (true) {
    const url = new URL(`${source}/wp-json/wc/v3/products/reviews`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("consumer_key", consumerKey!);
    url.searchParams.set("consumer_secret", consumerSecret!);
    const rows = await api<any[]>(url.toString());
    if (!rows.length) break;

    for (const row of rows) {
      const product = await prisma.product.findFirst({ where: { sourceId: String(row.product_id) } });
      if (!product) continue;
      const legacyId = `wc-review-${row.id}`;
      const existing = await prisma.review.findFirst({
        where: {
          productId: product.id,
          body: stripHtml(row.review) || `Imported review wc-review-${row.id}`,
          name: row.reviewer || "Customer",
        },
      });
      if (existing) continue;
      await prisma.review.create({
        data: {
          productId: product.id,
          name: row.reviewer || "Customer",
          rating: Math.min(5, Math.max(1, Number(row.rating || 5))),
          body: stripHtml(row.review) || `Imported review ${legacyId}`,
          verified: Boolean(row.verified),
          status: row.status === "approved" ? "APPROVED" : "PENDING",
          createdAt: row.date_created ? new Date(row.date_created) : undefined,
        },
      });
    }
    if (rows.length < 100) break;
    page += 1;
  }
}

async function importPastOrdersAndCustomers() {
  if (process.env.MIGRATE_PAST_ORDERS !== "true" || !consumerKey || !consumerSecret) return;
  let page = 1;
  while (true) {
    const url = new URL(`${source}/wp-json/wc/v3/orders`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("status", "any");
    url.searchParams.set("consumer_key", consumerKey);
    url.searchParams.set("consumer_secret", consumerSecret);
    const rows = await api<any[]>(url.toString());
    if (!rows.length) break;

    for (const row of rows) {
      const rawPhone = String(row.billing?.phone || "").replace(/\D/g, "");
      if (!rawPhone) continue;
      const phone = rawPhone.startsWith("92")
        ? `+${rawPhone}`
        : rawPhone.startsWith("0")
          ? `+92${rawPhone.slice(1)}`
          : `+92${rawPhone}`;
      const fullName = [row.billing?.first_name, row.billing?.last_name].filter(Boolean).join(" ") || "Legacy customer";
      const customer = await prisma.customer.upsert({
        where: { phone },
        update: { name: fullName, email: row.billing?.email || undefined },
        create: { phone, name: fullName, email: row.billing?.email || undefined },
      });

      const legacyKey = `legacy-wc-${row.id}`;
      const exists = await prisma.order.findUnique({ where: { idempotencyKey: legacyKey } });
      if (exists) continue;
      const statusMap: Record<string, any> = {
        pending: "NEW",
        processing: "CONFIRMED",
        "on-hold": "ON_HOLD",
        completed: "DELIVERED",
        cancelled: "CANCELLED",
        refunded: "RETURNED",
        failed: "CANCELLED",
      };
      const orderNumber = `WP-${row.id}`;
      const order = await prisma.order.create({
        data: {
          orderNumber,
          idempotencyKey: legacyKey,
          customerId: customer.id,
          fullName,
          phone,
          email: row.billing?.email || null,
          city: row.billing?.city || "Unknown",
          address: [row.billing?.address_1, row.billing?.address_2].filter(Boolean).join(" ") || "Legacy order",
          postcode: row.billing?.postcode || null,
          status: statusMap[row.status] || "NEW",
          paymentMethod: "COD",
          subtotal: Number(row.total || 0),
          total: Number(row.total || 0),
          source: "wordpress-migration",
          test: true,
          notes: `Imported WooCommerce order ${row.id}; excluded from website Purchase tracking.`,
          items: {
            create: (row.line_items || []).map((item: any) => ({
              productId: undefined,
              sku: item.sku || `LEGACY-${item.product_id}`,
              title: item.name || "Legacy item",
              quantity: Number(item.quantity || 1),
              unitPrice: Number(item.price || 0),
              lineTotal: Number(item.total || 0),
              bundleDiscount: 0,
            })),
          },
          statusHistory: { create: { to: statusMap[row.status] || "NEW", note: "Imported from WooCommerce history." } },
          createdAt: row.date_created ? new Date(row.date_created) : undefined,
        },
      });
      void order;
    }
    if (rows.length < 100) break;
    page += 1;
  }
}

async function main() {
  if (!consumerKey || !consumerSecret)
    throw new Error(
      "Set WC_CONSUMER_KEY and WC_CONSUMER_SECRET in backend/.env. Use a read-only WooCommerce key. No products have been changed.",
    );
  if (!apply) {
    let page = 1,
      total = 0,
      variations = 0;
    while (true) {
      const rows = await api<any[]>(`${source}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`);
      total += rows.length;
      variations += rows.reduce((n, r) => n + (r.variations?.length || 0), 0);
      console.log(
        JSON.stringify({
          page,
          products: rows.map((r) => ({
            sourceId: r.id,
            slug: r.slug,
            sku: r.sku,
            type: r.type,
            images: r.images?.length || 0,
            stock: wooStock(r),
          })),
        }),
      );
      if (rows.length < 100) break;
      page++;
    }
    console.log(
      JSON.stringify({
        dryRun: true,
        total,
        variations,
        next: "Review this inventory, then run with --apply. Existing orders/customers are unchanged unless MIGRATE_PAST_ORDERS=true.",
      }),
    );
    return;
  }
  if (!isCloudStorageConfigured())
    throw new Error(
      "Configure R2 product image storage before importing. Source images must remain available after WordPress is retired.",
    );
  console.log(`Migrating from ${new URL(source).origin}`);
  await importCategoriesAuthenticated();
  await importProductsAuthenticated();
  await importReviewsAuthenticated();
  await importPastOrdersAndCustomers();
  console.log("Migration complete. Re-run immediately before cutover as required by the specification.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
