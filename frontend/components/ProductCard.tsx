"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import type { Product } from "@/types/product";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getProductFallbackImage } from "@/lib/product-media";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const addable = product.stockStatus === "instock" && !product.hasOptions;
  const reviewCount = product.reviewCount ?? 0;
  const averageRating = product.averageRating ?? 0;
  const fallbackImage = getProductFallbackImage(product);
  const [imageSrc, setImageSrc] = useState(product.image || fallbackImage);

  return (
    <article className="product-card">
      <Link className="product-media" href={`/product/${product.slug}/`}>
        {imageSrc ? (
          <Image src={imageSrc} alt={product.name} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" onError={() => { if (imageSrc !== fallbackImage) setImageSrc(fallbackImage); }} />
        ) : null}
        {product.discountPercent > 0 ? <span className="discount-badge">{product.discountPercent}% OFF</span> : null}
      </Link>
      <div className="product-body">
        <span className="product-category">{product.categories[0]?.name || "Zelvomart"}</span>
        <Link className="product-title" href={`/product/${product.slug}/`}>{product.name}</Link>
        {reviewCount > 0 ? <div className="mt-1 text-xs font-bold text-amber-500" aria-label={`${averageRating} out of 5 from ${reviewCount} reviews`}>★ {averageRating.toFixed(1)} <span className="font-medium text-slate-400">({reviewCount})</span></div> : null}
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
                image: imageSrc,
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
