"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { products } from "@store/lib/catalog";
import { useShop } from "@store/lib/store";
import { ProductGrid } from "@store/components/product/ProductGrid";

export function WishlistView() {
  const { wishlist, ready, addToCart, notify } = useShop();
  if (!ready) return <div className="container skeleton-block" />;
  const items = products.filter((p) => wishlist.includes(p.id));
  if (!items.length)
    return (
      <div className="empty-state">
        <span className="empty-ico">
          <Heart size={30} />
        </span>
        <h2>Save your favourite finds.</h2>
        <p>Tap the heart on any product to keep it here for later.</p>
        <Link href="/shop/" className="btn">
          Explore products <ArrowRight size={16} />
        </Link>
      </div>
    );
  return (
    <>
      <div className="archive-toolbar">
        <p>
          {items.length} saved item{items.length > 1 ? "s" : ""}
        </p>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            items.forEach((p) => addToCart(p, { variant: p.variants?.options[0].name, silent: true }));
            notify({ title: "All saved items added to cart" });
          }}
        >
          Add all to cart
        </button>
      </div>
      <ProductGrid items={items} />
    </>
  );
}
