import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Category, Product, Review } from "@/types/product";

const productInclude = {
  category: true,
  variants: { where: { active: true }, orderBy: { createdAt: "asc" as const } },
  reviews: { where: { status: "APPROVED" as const }, orderBy: { createdAt: "desc" as const } },
};

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function images(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item));
}

export function mapProduct(row: ProductRow): Product {
  const regular = Number(row.price);
  const sale = row.salePrice == null ? null : Number(row.salePrice);
  const current = sale && sale < regular ? sale : regular;
  const imgs = images(row.images);
  const reviewRows: Review[] = row.reviews.map((review) => ({
    id: review.id,
    name: review.name,
    rating: review.rating,
    body: review.body,
    verified: review.verified,
    createdAt: review.createdAt.toISOString(),
  }));
  const avg = reviewRows.length ? reviewRows.reduce((sum, review) => sum + review.rating, 0) / reviewRows.length : undefined;

  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    sku: row.sku,
    categories: row.category
      ? [
          {
            id: row.category.id,
            name: row.category.name,
            slug: row.category.slug,
            description: row.category.description,
            image: row.category.imageUrl,
          },
        ]
      : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    price: current,
    regularPrice: regular,
    salePrice: sale,
    onSale: Boolean(sale && sale < regular),
    discountPercent: sale && sale < regular ? Math.round(((regular - sale) / regular) * 100) : 0,
    stockStatus: row.stock > 0 || row.variants.some((variant) => variant.stock > 0) ? "instock" : "outofstock",
    stockQuantity: row.stock,
    featured: row.featured,
    averageRating: avg,
    reviewCount: reviewRows.length,
    image: imgs[0],
    images: imgs.map((src) => ({ src, alt: row.title })),
    shortDescription: row.shortDescription,
    description: row.descriptionHtml,
    videoUrl: row.videoUrl,
    permalink: `/product/${row.slug}/`,
    hasOptions: row.variants.length > 0,
    variants: row.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      attributes:
        variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes)
          ? (variant.attributes as Record<string, string>)
          : {},
      priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride),
      stock: variant.stock,
      imageUrl: variant.imageUrl,
      active: variant.active,
    })),
    bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: row.bundleDiscountPercent == null ? null : Number(row.bundleDiscountPercent),
    reviews: reviewRows,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
  };
}

export async function getCategories() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
  });
  return rows.map<Category>((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.imageUrl,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    count: row._count.products,
  }));
}

export async function getProductBySlug(slug: string) {
  const row = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: productInclude,
  });
  return row ? mapProduct(row) : null;
}

export async function getProducts(options: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "price-asc" | "price-desc";
  featured?: boolean;
} = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(48, Math.max(1, options.limit || 12));
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    ...(options.featured ? { featured: true } : {}),
    ...(options.category ? { category: { slug: options.category } } : {}),
    ...(options.search
      ? {
          OR: [
            { title: { contains: options.search, mode: "insensitive" } },
            { category: { name: { contains: options.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    options.sort === "price-asc"
      ? [{ salePrice: "asc" }, { price: "asc" }]
      : options.sort === "price-desc"
        ? [{ salePrice: "desc" }, { price: "desc" }]
        : [{ createdAt: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(mapProduct),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
