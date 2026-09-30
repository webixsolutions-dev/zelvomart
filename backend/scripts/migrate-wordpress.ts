import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { uploadObject } from "../../frontend/lib/storage";

const prisma = new PrismaClient();
const source = (process.env.SOURCE_STORE_URL || "https://zelvomart.com").replace(/\/$/, "");
const consumerKey = process.env.WC_CONSUMER_KEY;
const consumerSecret = process.env.WC_CONSUMER_SECRET;

function stripHtml(value: string | undefined) {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "user-agent": "ZelvomartMigration/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
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
  return metaValue(row, ["product_video_url", "_product_video_url", "video_url", "_video_url", "youtube_url", "_youtube_url"]);
}

async function maybeRehost(url: string) {
  if (!process.env.S3_BUCKET || !process.env.S3_PUBLIC_BASE_URL) return url;
  const response = await fetch(url);
  if (!response.ok) return url;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = response.headers.get("content-type") || "image/jpeg";
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
  let page = 1;
  while (true) {
    const url = new URL(`${source}/wp-json/wc/v3/products`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("status", "any");
    url.searchParams.set("consumer_key", consumerKey!);
    url.searchParams.set("consumer_secret", consumerSecret!);
    const rows = await api<any[]>(url.toString());
    if (!rows.length) break;

    for (const row of rows) {
      const categorySlug = row.categories?.[0]?.slug;
      const category = categorySlug ? await prisma.category.findUnique({ where: { slug: categorySlug } }) : null;
      const images = [] as string[];
      for (const image of row.images || []) {
        if (image.src) images.push(await maybeRehost(image.src));
      }

      const seo = rankMathSeo(row);
      const product = await prisma.product.upsert({
        where: { slug: row.slug },
        update: {
          title: row.name,
          sku: row.sku || `WP-${row.id}`,
          shortDescription: stripHtml(row.short_description),
          descriptionHtml: row.description || null,
          images,
          videoUrl: productVideoUrl(row) || null,
          categoryId: category?.id,
          price: Number(row.regular_price || row.price || 0),
          salePrice: row.sale_price ? Number(row.sale_price) : null,
          stock: row.manage_stock ? Number(row.stock_quantity || 0) : row.stock_status === "instock" ? 9999 : 0,
          status: row.status === "publish" ? "PUBLISHED" : "DRAFT",
          featured: Boolean(row.featured),
          seoTitle: seo.title || stripHtml(row.name),
          seoDescription: seo.description || stripHtml(row.short_description),
          canonicalUrl: row.permalink,
          sourceUrl: row.permalink,
          sourceId: String(row.id),
        },
        create: {
          title: row.name,
          slug: row.slug,
          sku: row.sku || `WP-${row.id}`,
          shortDescription: stripHtml(row.short_description),
          descriptionHtml: row.description || null,
          images,
          videoUrl: productVideoUrl(row) || null,
          categoryId: category?.id,
          price: Number(row.regular_price || row.price || 0),
          salePrice: row.sale_price ? Number(row.sale_price) : null,
          stock: row.manage_stock ? Number(row.stock_quantity || 0) : row.stock_status === "instock" ? 9999 : 0,
          status: row.status === "publish" ? "PUBLISHED" : "DRAFT",
          featured: Boolean(row.featured),
          seoTitle: seo.title || stripHtml(row.name),
          seoDescription: seo.description || stripHtml(row.short_description),
          canonicalUrl: row.permalink,
          sourceUrl: row.permalink,
          sourceId: String(row.id),
        },
      });

      await prisma.variant.deleteMany({ where: { productId: product.id } });
      for (const variationId of row.variations || []) {
        const vUrl = new URL(`${source}/wp-json/wc/v3/products/${row.id}/variations/${variationId}`);
        vUrl.searchParams.set("consumer_key", consumerKey!);
        vUrl.searchParams.set("consumer_secret", consumerSecret!);
        const variant = await api<any>(vUrl.toString());
        const name = (variant.attributes || []).map((attr: any) => attr.option).filter(Boolean).join(" / ") || `Variant ${variationId}`;
        await prisma.variant.create({
          data: {
            productId: product.id,
            sku: variant.sku || `${product.sku}-${variationId}`,
            name,
            attributes: Object.fromEntries((variant.attributes || []).map((attr: any) => [attr.name, attr.option])),
            priceOverride: variant.price ? Number(variant.price) : null,
            stock: variant.manage_stock ? Number(variant.stock_quantity || 0) : variant.stock_status === "instock" ? 9999 : 0,
            imageUrl: variant.image?.src ? await maybeRehost(variant.image.src) : null,
            active: variant.status === "publish",
          },
        });
      }
    }

    console.log(`Imported product page ${page} (${rows.length})`);
    if (rows.length < 100) break;
    page += 1;
  }
}

async function importPublicStoreApi() {
  let page = 1;
  while (true) {
    const rows = await api<any[]>(`${source}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    if (!rows.length) break;

    for (const row of rows) {
      const categoryInfo = row.categories?.[0];
      let categoryId: string | undefined;
      if (categoryInfo) {
        const category = await prisma.category.upsert({
          where: { slug: categoryInfo.slug },
          update: { name: categoryInfo.name },
          create: { name: categoryInfo.name, slug: categoryInfo.slug },
        });
        categoryId = category.id;
      }

      const minor = Number(row.prices?.currency_minor_unit ?? 2);
      const divisor = 10 ** minor;
      const regular = Number(row.prices?.regular_price || row.prices?.price || 0) / divisor;
      const current = Number(row.prices?.price || 0) / divisor;
      const images: string[] = [];
      for (const image of row.images || []) if (image.src) images.push(await maybeRehost(image.src));

      await prisma.product.upsert({
        where: { slug: row.slug },
        update: {
          title: row.name,
          sku: row.sku || `WC-${row.id}`,
          shortDescription: stripHtml(row.short_description || row.summary),
          descriptionHtml: row.description || null,
          images,
          videoUrl: productVideoUrl(row) || null,
          categoryId,
          price: regular || current,
          salePrice: current && regular && current < regular ? current : null,
          stock: row.is_in_stock ? 9999 : 0,
          status: "PUBLISHED",
          seoTitle: stripHtml(row.name),
          seoDescription: stripHtml(row.short_description || row.summary),
          canonicalUrl: `${source}/product/${row.slug}/`,
          sourceUrl: `${source}/product/${row.slug}/`,
          sourceId: String(row.id),
        },
        create: {
          title: row.name,
          slug: row.slug,
          sku: row.sku || `WC-${row.id}`,
          shortDescription: stripHtml(row.short_description || row.summary),
          descriptionHtml: row.description || null,
          images,
          videoUrl: productVideoUrl(row) || null,
          categoryId,
          price: regular || current,
          salePrice: current && regular && current < regular ? current : null,
          stock: row.is_in_stock ? 9999 : 0,
          status: "PUBLISHED",
          seoTitle: stripHtml(row.name),
          seoDescription: stripHtml(row.short_description || row.summary),
          canonicalUrl: `${source}/product/${row.slug}/`,
          sourceUrl: `${source}/product/${row.slug}/`,
          sourceId: String(row.id),
        },
      });
    }

    console.log(`Imported public product page ${page} (${rows.length})`);
    if (rows.length < 100) break;
    page += 1;
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
        where: { productId: product.id, body: row.review || "", name: row.reviewer || "Customer" },
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
      const phone = rawPhone.startsWith("92") ? `+${rawPhone}` : rawPhone.startsWith("0") ? `+92${rawPhone.slice(1)}` : `+92${rawPhone}`;
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
        pending: "NEW", processing: "CONFIRMED", "on-hold": "ON_HOLD", completed: "DELIVERED",
        cancelled: "CANCELLED", refunded: "RETURNED", failed: "CANCELLED",
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

async function importPages() {
  try {
    const rows = await api<any[]>(`${source}/wp-json/wp/v2/pages?per_page=100&status=publish`);
    for (const row of rows) {
      const seo = rankMathSeo(row);
      const title = stripHtml(row.title?.rendered) || row.slug;
      const bodyText = stripHtml(row.excerpt?.rendered || row.content?.rendered || "").slice(0, 300);
      await prisma.page.upsert({
        where: { slug: row.slug },
        update: {
          title,
          bodyHtml: row.content?.rendered || "",
          seoTitle: seo.title || title,
          seoDescription: seo.description || bodyText || null,
        },
        create: {
          slug: row.slug,
          title,
          bodyHtml: row.content?.rendered || "",
          seoTitle: seo.title || title,
          seoDescription: seo.description || bodyText || null,
        },
      });
    }
  } catch (error) {
    console.warn("Page migration skipped:", error);
  }
}

async function main() {
  console.log(`Migrating from ${source}`);
  if (consumerKey && consumerSecret) {
    await importCategoriesAuthenticated();
    await importProductsAuthenticated();
    await importReviewsAuthenticated();
  } else {
    console.warn("WooCommerce credentials not set; using public Store API. Variants/stock precision may be limited.");
    await importPublicStoreApi();
  }
  await importPages();
  await importPastOrdersAndCustomers();
  console.log("Migration complete. Re-run immediately before cutover as required by the specification.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
