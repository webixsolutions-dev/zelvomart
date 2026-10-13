import ProductGrid from "@/components/ProductGrid";
import StorePagination from "@/components/StorePagination";
import StorefrontHero from "@/components/StorefrontHero";
import { getProducts } from "@/lib/store";

export const revalidate = 120;
export const metadata = { title: "Discounts" };
const v = (x: string | string[] | undefined) => Array.isArray(x) ? x[0] : x || "";

export default async function DiscountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(v(sp.page)) || 1);
  const result = await getProducts({ tag: "discount", page, limit: 12 });

  return (
    <div className="mock-listing-page">
      <StorefrontHero
        eyebrow="MARKED DOWN"
        title="Discounts."
        description="Products tagged 15% off, 20% off and 30% off, plus anything currently on sale."
        image="/images/Zelvomart images/Shop Zelvmart.png"
        alt="Discounted Zelvomart products"
        primaryLabel="Shop discounts"
        primaryHref="#products"
        secondaryLabel="Shop all"
        secondaryHref="/shop"
        priority
      />
      <section id="products" className="site-shell mock-home-section">
        <ProductGrid products={result.items} emptyText="No discounted products yet. Tag a product 15% off, 20% off or 30% off and it will show here." />
        <div className="mock-listing-count">Showing {result.items.length} of {result.total || result.items.length} products</div>
        <StorePagination currentPage={result.page || page} totalPages={result.totalPages || 1} basePath="/discount" />
      </section>
    </div>
  );
}
