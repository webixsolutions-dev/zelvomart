import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "products.write")) return new NextResponse("Forbidden", { status: 403 });
  const header = "title,slug,sku,category,price,salePrice,costPrice,stock,status,shortDescription,descriptionHtml,images,videoUrl,featured,bundleEnabled,bundleDiscountPercent,seoTitle,seoDescription";
  const sample = 'Example Product,example-product,ZM-001,Home & Living,2499,2199,1300,25,PUBLISHED,"Short product summary","<p>Full product description</p>","https://example.com/1.webp|https://example.com/2.webp",,false,true,5,"Example Product Pakistan","Buy Example Product with Cash on Delivery"';
  return new NextResponse(`${header}\n${sample}\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="zelvomart-product-template.csv"' } });
}
