"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import type { Product } from "@/types/product";
import { trackStoreEvent } from "@/lib/client-tracking";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const addable = product.stockStatus === "instock" && !product.hasOptions;

  return (
    <article className="product-card">
      <Link className="product-media" href={`/product/${product.slug}/`}>
        {product.image ? (
          <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" />
        ) : null}
        {product.discountPercent > 0 ? <span className="discount-badge">{product.discountPercent}% OFF</span> : null}
      </Link>
      <div className="product-body">
        <span className="product-category">{product.categories[0]?.name || "Zelvomart"}</span>
        <Link className="product-title" href={`/product/${product.slug}/`}>{product.name}</Link>
        {product.reviewCount > 0 ? <div className="mt-1 text-xs font-bold text-amber-500" aria-label={`${product.averageRating} out of 5 from ${product.reviewCount} reviews`}>★ {product.averageRating.toFixed(1)} <span className="font-medium text-slate-400">({product.reviewCount})</span></div> : null}
        <div className="product-price">
          <strong>{money(product.price)}</strong>
          {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
        </div>
        {addable ? (
          <button
            className="card-action"
            onClick={() => {
              addItem({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                image: product.image,
                price: product.price,
                quantity: 1,
                bundleSize: 1,
                bundleDiscountPercent: product.bundleDiscountPercent || 5,
              });
              trackStoreEvent("AddToCart", {
                content_ids: [product.sku],
                contents: [{ id: product.sku, quantity: 1, item_price: product.price }],
                value: product.price,
                currency: "PKR",
              }, { clarityEvent: "add_to_cart" }).catch(() => undefined);
            }}
          >
            Add to Cart
          </button>
        ) : (
          <Link className="card-action" href={`/product/${product.slug}/`}>{product.stockStatus === "outofstock" ? "Out of stock" : "Select options"}</Link>
        )}
      </div>
    </article>
  );
}
