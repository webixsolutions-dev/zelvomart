"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/launch/catalog";
import { ProductGrid } from "@/components/launch/product/ProductGrid";

type Tab = { key: string; label: string; href: string; items: Product[] };

export function ProductTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState((tabs.find(t=>t.items.length)||tabs[0]).key);
  const tab = tabs.find((t) => t.key === active)!;

  return (
    <div className="home-stage trending-stage">
      <div className="section-head trending-head">
        <div>
          <div className="eyebrow">Customer favourites</div>
          <h2>Trending at Zelvomart</h2>
          <div className="seg" role="tablist" aria-label="Product lists">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={t.key === active}
                className={t.key === active ? "active" : ""}
                onClick={() => setActive(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Link prefetch={false} className="pill" href={tab.href}>
          View all {tab.label.toLowerCase()} <ArrowRight size={14} />
        </Link>
      </div>
      <div role="tabpanel" key={tab.key} className="tab-panel trending-board">
        {tab.items.length?<ProductGrid items={tab.items.slice(0, 4)} cols={4} priorityCount={4}/>:<p>No products in this collection yet. Browse another tab or visit the shop.</p>}
      </div>
    </div>
  );
}
