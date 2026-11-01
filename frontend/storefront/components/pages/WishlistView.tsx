"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { getProductById, type Product } from "@store/lib/catalog";
import { idsUrl, useProducts } from "@store/lib/catalog-client";
import { useShop } from "@store/lib/store";
import { ProductGrid } from "@store/components/product/ProductGrid";

export function WishlistView() {
  const { wishlist, ready, addToCart, notify } = useShop();
  // Saved products are loaded by id (pages no longer carry the whole catalog).
  const loaded = useProducts(ready && wishlist.length ? idsUrl(wishlist) : null);
  if (!ready || (wishlist.length && loaded === null)) return <div className="container skeleton-block" />;
  const items = wishlist.map((id) => getProductById(id)).filter((p): p is Product => Boolean(p));
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
            // addToCart picks the first in-stock variation and skips sold-out items.
            const added = items.filter((p) => addToCart(p, { silent: true })).length;
            notify({ title: added === items.length ? "All saved items added to cart" : `${added} of ${items.length} saved items added (the rest are sold out)` });
          }}
        >
          Add all to cart
        </button>
      </div>
      <ProductGrid items={items} />
    </>
  );
}
