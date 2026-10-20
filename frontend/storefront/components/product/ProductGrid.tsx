"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@store/lib/catalog";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ items, cols = 4, priorityCount = 0 }: { items: Product[]; cols?: 3 | 4; priorityCount?: number }) {
  return (
    <div className={`product-grid cols-${cols}`}>
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ProductRail({ items }: { items: Product[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const slide = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".product-card");
    const step = card ? card.offsetWidth + 14 : el.clientWidth * 0.75;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="product-rail-wrap">
      <button type="button" className="rail-nav rail-prev" aria-label="Previous products" onClick={() => slide(-1)}>
        <ChevronLeft size={18} />
      </button>
      <div className="product-rail" ref={scroller}>
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
      <button type="button" className="rail-nav rail-next" aria-label="Next products" onClick={() => slide(1)}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
