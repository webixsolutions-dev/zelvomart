import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/ProductGrid";
import StorePagination from "@/components/StorePagination";
import CatalogBrowser from "@/components/CatalogBrowser";
import StorefrontHero from "@/components/StorefrontHero";
import { getCategories, getProducts } from "@/lib/store";
import SafeImage from "@/components/SafeImage";

export const revalidate = 120;

// Matches the newly renamed kebab-case files in public/images/home/
const categoryHeroImages: Record<string, string> = {
  "home-living": "/images/home/home-living.png",
  "home-decor": "/images/home/home-decor.png",
  "beauty-personal-care": "/images/home/beauty-personal-care.png",
  "tech-gadgets": "/images/home/tech-gadgets.png",
  "fashion-accessories": "/images/home/fashion-accessories.png",
  "sports-fitness": "/images/home/sports-fitness.png",
  "kids-toys": "/images/home/kids-toys.png",
};

/**
 * Safely encodes image URLs so user-uploaded paths with spaces or '&'
 * do not break the Next.js `/_next/image?url=...` optimizer query string.
 */
function getSafeImageUrl(src?: string | null): string {
  if (!src) return "/images/home/home-living.png";
  try {
    return encodeURI(src).replace(/&/g, "%26");
  } catch {
    return src;
  }
}

const v = (x: string | string[] | undefined) =>
  Array.isArray(x) ? x[0] : x || "";

const n = (x: string | string[] | undefined) => {
  const raw = v(x).trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCategories()).find((x) => x.slug === slug);

  return c
    ? {
        title: c.seoTitle || c.name,
        description:
          c.seoDescription || c.description || `Shop ${c.name} at Zelvomart.`,
      }
    : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);

  if (!category) notFound();

  const sortRaw = v(sp.sort);
  const sort =
    sortRaw === "newest" || sortRaw === "price-asc" || sortRaw === "price-desc"
      ? sortRaw
      : "popular";

  const page = Math.max(1, Number(v(sp.page)) || 1);
  const minPrice = n(sp.minPrice);
  const maxPrice = n(sp.maxPrice);
  const availability = v(sp.availability) === "instock" ? "instock" : "";

  const result = await getProducts({
    category: slug,
    sort,
    page,
    limit: 12,
    minPrice,
    maxPrice,
    availability: availability || undefined,
  });

  const heroImage = getSafeImageUrl(
    categoryHeroImages[slug] ||
      category.image ||
      `/images/categories/${category.slug}.webp`,
  );

  return (
    <div className="mock-category-page zm-category-page">
      <StorefrontHero
        eyebrow="SHOP THE COLLECTION"
        title={category.name}
        description={
          category.description ||
          `Useful ${category.name.toLowerCase()} picks, checked and ready for Cash on Delivery across Pakistan.`
        }
        image={heroImage}
        alt={`${category.name} products at Zelvomart`}
        primaryLabel={`Shop ${category.name}`}
        primaryHref="#products"
        secondaryLabel="Explore all categories"
        secondaryHref="/shop#categories"
        priority
      />

      <section
        id="products"
        className="site-shell zm-category-products-section"
      >
        <Suspense
          fallback={
            <div className="mock-catalog-browser-loading" aria-hidden="true" />
          }
        >
          <CatalogBrowser
            categories={categories}
            currentCategory={slug}
            minPrice={minPrice}
            maxPrice={maxPrice}
            availability={availability}
            sort={sort}
            categoryMode="path"
            clearHref={`/product-category/${slug}/`}
          >
            <ProductGrid
              products={result.items}
              emptyText={`No published products found in ${category.name} yet.`}
            />

            <div className="mock-listing-count">
              Showing {result.items.length} of{" "}
              {result.total || result.items.length} products
            </div>

            <StorePagination
              currentPage={result.page || page}
              totalPages={result.totalPages || 1}
              basePath={`/product-category/${slug}/`}
              query={{
                sort: sort !== "popular" ? sort : undefined,
                minPrice,
                maxPrice,
                availability: availability || undefined,
              }}
            />
          </CatalogBrowser>
        </Suspense>
      </section>

      <section className="mock-category-about zm-category-about">
        <div className="site-shell">
          <span className="mock-eyebrow">ABOUT THE COLLECTION</span>

          <div className="mock-category-about-grid">
            <div className="mock-category-about-copy">
              <h2>Why shop {category.name} at Zelvomart?</h2>
              <p>
                <strong>Useful picks, clearly presented.</strong>{" "}
                {category.description ||
                  `Our ${category.name.toLowerCase()} selection focuses on useful products with clear descriptions, straightforward prices and dependable support.`}
              </p>
            </div>

            <div className="mock-category-about-faq">
              <details open>
                <summary>Checked before dispatch</summary>
                <p>Eligible products are checked before they leave us.</p>
              </details>

              <details>
                <summary>Cash on Delivery</summary>
                <p>
                  Available across Pakistan for a simple, familiar checkout.
                </p>
              </details>

              <details>
                <summary>Need help choosing?</summary>
                <p>Chat with us on WhatsApp for quick product guidance.</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section className="site-shell mock-other-cats zm-category-other-cats">
        <div className="mock-section-head">
          <h2>Explore other categories</h2>
        </div>

        <div>
          {categories
            .filter((c) => c.slug !== slug)
            .slice(0, 6)
            .map((c) => {
              const imageSrc = getSafeImageUrl(
                categoryHeroImages[c.slug] ||
                  c.image ||
                  `/images/categories/${c.slug}.webp`,
              );

              return (
                <Link key={c.id} href={`/product-category/${c.slug}/`}>
                  <span
                    style={{
                      position: "relative",
                      display: "block",
                      aspectRatio: "1 / 1",
                    }}
                  >
                    <SafeImage
                      src={
                        categoryHeroImages[c.slug] ||
                        c.image ||
                        `/images/categories/${c.slug}.webp`
                      }
                      alt={c.name}
                      fill
                      fallbackSrc="/images/home/home-living.png"
                      sizes="(max-width: 620px) 48vw, (max-width: 1000px) 28vw, 180px"
                    />
                  </span>
                  <b>{c.name}</b>
                </Link>
              );
            })}
        </div>
      </section>

      <style>{`
        .zm-category-products-section {
          margin-top: 36px !important;
          margin-bottom: 18px;
        }

        .zm-category-about {
          margin-top: 68px !important;
          padding: 58px 0 !important;
          background: linear-gradient(180deg, #f7fbfc 0%, #eef7fa 100%) !important;
          border-top: 1px solid #e4edf1;
          border-bottom: 1px solid #e4edf1;
        }

        .zm-category-about .mock-category-about-copy h2 {
          color: #102d3e;
          font-size: 30px !important;
          line-height: 1.08;
          letter-spacing: -0.7px;
        }

        .zm-category-about .mock-category-about-copy p,
        .zm-category-about .mock-category-about-faq p {
          font-size: 13px !important;
          line-height: 1.68 !important;
        }

        .zm-category-other-cats {
          padding-top: 62px !important;
          padding-bottom: 74px !important;
        }

        .zm-category-other-cats > div:last-child {
          gap: 16px !important;
        }

        .zm-category-other-cats a {
          padding: 8px;
          border: 1px solid #e0e8ec;
          border-radius: 14px;
          background: #fff;
          text-decoration: none;
          transition:
            transform .18s ease,
            box-shadow .18s ease,
            border-color .18s ease;
        }

        .zm-category-other-cats a:hover {
          transform: translateY(-3px);
          border-color: #bad5e2;
          box-shadow: 0 10px 28px rgba(15, 48, 65, .08);
        }

        .zm-category-other-cats a > span {
          border-radius: 10px !important;
          background: #f4f7f8 !important;
          overflow: hidden;
        }

        .zm-category-other-cats a > span img {
          object-fit: cover !important;
          object-position: center center !important;
        }

        .zm-category-other-cats b {
          margin-top: 10px !important;
          color: #102d3e;
          font-size: 12px !important;
          line-height: 1.25;
          font-weight: 850;
        }

        @media (max-width: 760px) {
          .zm-category-products-section {
            margin-top: 22px !important;
          }

          .zm-category-about {
            margin-top: 44px !important;
            padding: 42px 0 !important;
          }

          .zm-category-other-cats {
            padding-top: 42px !important;
            padding-bottom: 46px !important;
          }

          .zm-category-other-cats > div:last-child {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .zm-category-other-cats b {
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
}
