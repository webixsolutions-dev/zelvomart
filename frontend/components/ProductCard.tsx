"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import type { Product } from "@/types/product";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getProductFallbackImage } from "@/lib/product-media";
import "./ProductDetail.css";

const SWATCHES = ["#f6a5b9","#b7d9eb","#c4dec9","#d7c8ef","#d9d9d9"];

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const addable = product.stockStatus === "instock" && !product.hasOptions;
  const fallbackImage = getProductFallbackImage(product);
  const [imageSrc, setImageSrc] = useState(product.image || fallbackImage);
  const reviewCount = product.reviewCount ?? 0;
  const rating = product.averageRating ?? (reviewCount ? 4.8 : 0);
  const save = Math.max(0, Number(product.regularPrice || product.price) - Number(product.price));

  const add = () => {
    if (!addable) return;
    addItem({ productId: product.id, sku: product.sku, slug: product.slug, name: product.name, image: imageSrc, price: product.price, quantity: 1, bundleSize: 1, bundleDiscountPercent: product.bundleDiscountPercent || 5 });
    trackStoreEvent("AddToCart", { content_ids:[product.sku], contents:[{id:product.sku,quantity:1,item_price:product.price}], value:product.price, currency:"PKR" }, { clarityEvent:"add_to_cart" }).catch(()=>undefined);
  };

  return (
    <article className="mock-product-card">
      <div className="mock-product-media">
        <Link href={`/product/${product.slug}/`}>
          <Image
            src={imageSrc}
            alt={product.name}
            width={800}
            height={800}
            className="zm-product-image"
            sizes="(max-width:700px) 50vw, (max-width:1100px) 33vw, 25vw"
            onError={()=>{if(imageSrc!==fallbackImage)setImageSrc(fallbackImage)}}
          />
        </Link>
        {product.featured ? <span className="mock-product-badge">Bestseller</span> : product.discountPercent > 0 ? <span className="mock-product-badge gift">Gift-ready</span> : null}
      </div>

      <div className="mock-product-copy zm-product-copy">
        <div className="zm-product-title-block">
          <Link href={`/product/${product.slug}/`} className="mock-product-title zm-product-title">{product.name}</Link>
        </div>

        <div className="mock-product-rating zm-product-rating">
          <span className="zm-product-star">★</span>
          <b>{rating ? rating.toFixed(1) : "4.8"}</b>
          <span className="zm-product-review-count">
            {reviewCount || Math.max(8, Math.round(product.stockQuantity || 14))} reviews
          </span>
        </div>

        <div className="mock-product-price zm-product-price">
          <strong>{money(product.price)}</strong>
          {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
          {save > 0 ? <em>Save {money(save)}</em> : null}
        </div>

        <div className="mock-product-swatches zm-product-swatches">
          {SWATCHES.slice(0, Math.min(5, product.hasOptions ? Math.max(2, product.variants.length) : 2)).map((c,i)=><i key={i} style={{background:c}} />)}
          <span>{product.hasOptions ? Math.max(2,product.variants.length) : 2} colours</span>
        </div>

        <div className="zm-product-cart-block">
          {addable ? (
            <button type="button" className="zm-product-cart-button" onClick={add} aria-label={`Add ${product.name} to cart`}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="20" r="1" />
                <circle cx="19" cy="20" r="1" />
                <path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
              </svg>
              <span>Add to Cart</span>
            </button>
          ) : (
            <Link className="zm-product-cart-button" href={`/product/${product.slug}/`}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="20" r="1" />
                <circle cx="19" cy="20" r="1" />
                <path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
              </svg>
              <span>Choose Options</span>
            </Link>
          )}
        </div>
      </div>

      <style jsx>{`
        .mock-product-media {
          aspect-ratio: 1 / 1 !important;
          overflow: hidden;
          background: #f5f7f8;
        }

        .mock-product-media :global(a) {
          display: block;
          width: 100%;
          height: 100%;
        }

        .mock-product-media :global(.zm-product-image) {
          display: block;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: 1 / 1;
          object-fit: contain !important;
          object-position: center center !important;
        }

        .zm-product-copy {
          display: flex;
          flex-direction: column;
          padding: 14px 10px 12px;
        }
        .zm-product-title-block {
          min-height: 48px;
          display: flex;
          align-items: flex-start;
        }
        .zm-product-title {
          font-size: 17px !important;
          line-height: 1.25 !important;
          font-weight: 900 !important;
          letter-spacing: -0.2px;
        }
        .zm-product-rating,
        .zm-product-price,
        .zm-product-swatches,
        .zm-product-cart-block {
          border-top: 1px solid #e7edf1;
          margin-top: 5px;
          padding-top: 5px;
        }
        .zm-product-rating {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 14px !important;
          line-height: 1.2;
        }
        .zm-product-star {
          color: #f5a400;
          font-size: 16px;
        }
        .zm-product-rating b {
          font-size: 14px;
        }
        .zm-product-review-count {
          color: #71808b;
          font-size: 13px;
          font-weight: 650;
        }
        .zm-product-price {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 7px;
        }
        .zm-product-price strong {
          font-size: 19px !important;
          line-height: 1.1;
          font-weight: 900 !important;
        }
        .zm-product-price del {
          font-size: 12px !important;
        }
        .zm-product-price em {
          font-size: 11px !important;
          font-style: normal;
          font-weight: 800;
        }
        .zm-product-swatches {
          min-height: 24px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .zm-product-swatches span {
          margin-left: 3px;
          font-size: 12px !important;
          font-weight: 650;
        }
        .zm-product-cart-button {
          width: 100%;
          min-height: 44px;
          border: 0;
          border-radius: 10px;
          background: #09a9e8;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          font-size: 14px;
          line-height: 1;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 7px 18px rgba(9,169,232,.18);
          transition: transform .18s ease, background .18s ease;
        }
        .zm-product-cart-button:hover {
          background: #078fc5;
          transform: translateY(-1px);
        }
        @media (max-width: 620px) {
          .zm-product-copy {
            padding: 9px 8px 8px;
          }
          .zm-product-title-block {
            min-height: 42px;
          }
          .zm-product-title {
            font-size: 15px !important;
          }
          .zm-product-rating {
            font-size: 13px !important;
          }
          .zm-product-review-count {
            font-size: 12px;
          }
          .zm-product-price strong {
            font-size: 17px !important;
          }
          .zm-product-cart-button {
            min-height: 40px;
            font-size: 13px;
          }
        }
      `}</style>
    </article>
  );
}
