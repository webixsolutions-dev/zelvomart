import ProductGrid from "@/components/ProductGrid";
import StorePagination from "@/components/StorePagination";
import StorefrontHero from "@/components/StorefrontHero";
import { getProducts } from "@/lib/store";

export const revalidate = 120;
export const metadata = { title: "Bestsellers" };
const v = (x: string | string[] | undefined) => Array.isArray(x) ? x[0] : x || "";

export default async function Bestsellers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(v(sp.page)) || 1);
  const [tagged, featured, fallback] = await Promise.all([
    getProducts({ tag: "best-selling", page, limit: 12 }),
    getProducts({ featured: true, page, limit: 12 }),
    getProducts({ page, limit: 12 }),
  ]);
  const result = tagged.items.length ? tagged : featured.items.length ? featured : fallback;

  return (
    <div className="mock-listing-page">
      <StorefrontHero
        eyebrow="MOST-ORDERED"
        title="Bestsellers."
        description="The products customers keep coming back for — useful, easy to order and available with Cash on Delivery."
        image="/images/Zelvomart images/Best Selling Zelvomart.png"
        alt="Popular Zelvomart products"
        primaryLabel="Shop bestsellers"
        primaryHref="#products"
        secondaryLabel="Shop all"
        secondaryHref="/shop"
        priority
      />
      <section id="products" className="site-shell mock-home-section">
        <ProductGrid products={result.items} />
        <div className="mock-listing-count">Showing {result.items.length} of {result.total || result.items.length} products</div>
        <StorePagination currentPage={result.page || page} totalPages={result.totalPages || 1} basePath="/bestsellers" />
      </section>
    </div>
  );
}
