import { discountPct, money } from "@/lib/format";

export function Price({ price, compare, size = "md" }: { price: number; compare?: number; size?: "md" | "lg" }) {
  const pct = discountPct(price, compare);
  return (
    <div className={`price-row price-${size}`}>
      <span className="price">{money(price)}</span>
      {pct > 0 && (
        <>
          <s className="compare">{money(compare!)}</s>
          {size === "lg" && <span className="save-tag">Save {pct}%</span>}
        </>
      )}
    </div>
  );
}
