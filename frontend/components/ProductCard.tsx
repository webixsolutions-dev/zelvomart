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
        <span className="product-brand-chip">ZELVOMART</span>
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
            onError={() => { if (imageSrc !== fallbackImage) setImageSrc(fallbackImage); }}
          />
        ) : null}
        {product.discountPercent > 0 ? <span className="discount-badge">SAVE {product.discountPercent}%</span> : null}
      </Link>
      <div className="product-body">
        <div className="product-card-topline">
          <span className="product-category">{product.categories[0]?.name || "Zelvomart"}</span>
          <span className={`product-stock-dot ${product.stockStatus === "instock" ? "is-in" : "is-out"}`}>
            {product.stockStatus === "instock" ? "In stock" : "Out of stock"}
          </span>
        </div>
        <Link className="product-title" href={`/product/${product.slug}/`}>{product.name}</Link>
        {reviewCount > 0 ? (
          <div className="product-rating-mini" aria-label={`${averageRating} out of 5 from ${reviewCount} reviews`}>
            ★ {averageRating.toFixed(1)} <span>({reviewCount})</span>
          </div>
        ) : <div className="product-rating-mini product-rating-empty">Quality checked</div>}
        <div className="product-price">
          <strong>{money(product.price)}</strong>
          {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
        </div>
        <div className="product-card-actions">
          <Link className="product-view-link" href={`/product/${product.slug}/`}>View details</Link>
          {addable ? (
            <button
              className="card-action"
              onClick={() => {
                addItem({
                  productId: product.id,
                  sku: product.sku,
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
      </div>
    </article>
  );
}
