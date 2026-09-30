import { prisma } from "@/lib/db";

function xml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true, variants: true },
    orderBy: { updatedAt: "desc" },
  });
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com").replace(/\/$/, "");

  const items = products.map((product) => {
    const images = Array.isArray(product.images) ? product.images.filter((item): item is string => typeof item === "string") : [];
    const price = Number(product.price).toFixed(2);
    const sale = product.salePrice ? Number(product.salePrice).toFixed(2) : null;
    return `<item>
      <g:id>${xml(product.sku)}</g:id>
      <g:item_group_id>${xml(product.id)}</g:item_group_id>
      <title>${xml(product.title)}</title>
      <description>${xml(product.shortDescription || product.title)}</description>
      <g:availability>${product.stock > 0 || product.variants.some((v) => v.stock > 0) ? "in stock" : "out of stock"}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${price} PKR</g:price>
      ${sale ? `<g:sale_price>${sale} PKR</g:sale_price>` : ""}
      <link>${base}/product/${xml(product.slug)}/</link>
      ${images[0] ? `<g:image_link>${xml(images[0])}</g:image_link>` : ""}
      ${images.slice(1).map((image) => `<g:additional_image_link>${xml(image)}</g:additional_image_link>`).join("")}
      <g:brand>Zelvomart</g:brand>
      <g:product_type>${xml(product.category?.name || "General")}</g:product_type>
    </item>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Zelvomart</title><link>${base}</link>${items}</channel></rss>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
