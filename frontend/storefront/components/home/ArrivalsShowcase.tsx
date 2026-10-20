import type { Product } from "@/lib/catalog";
import { SectionHead } from "@/components/ui/SectionHead";
import { ProductCard } from "@/components/product/ProductCard";

export function ArrivalsShowcase({ items }: { items: Product[] }) {
  const showcase = items.slice(0, 5);
  const [lead, ...rest] = showcase;

  return (
    <div className="home-stage arrivals-stage">
      <SectionHead
        eyebrow="Just landed"
        title="New Arrivals"
        sub="Fresh picks added to the store this season."
        href="/new-arrivals/"
        linkLabel="See what's new"
      />
      <div className="arrivals-board">
        {lead && <ProductCard p={lead} featured priority />}
        <div className="arrivals-side">
          {rest.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
