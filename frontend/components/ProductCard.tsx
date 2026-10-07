"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PlusIcon } from "@/components/Icons";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import type { Product } from "@/types/product";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getProductFallbackImage } from "@/lib/product-media";

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
    <article className="mock-product-card zm-shop-product-card">
      <div className="mock-product-media">
        <Link href={`/product/${product.slug}/`}>
          <Image src={imageSrc} alt={product.name} fill sizes="(max-width:700px) 50vw, (max-width:1100px) 33vw, 25vw" onError={()=>{if(imageSrc!==fallbackImage)setImageSrc(fallbackImage)}} />
        </Link>
        {product.featured ? <span className="mock-product-badge">Bestseller</span> : product.discountPercent > 0 ? <span className="mock-product-badge gift">Gift-ready</span> : null}
      </div>

      <div className="mock-product-copy zm-product-copy">
        <div className="zm-product-title-block">
          <Link href={`/product/${product.slug}/`} className="mock-product-title zm-product-title">{product.name}</Link>
        </div>

        <div className="mock-product-rating zm-product-rating">
          <span className="zm-product-stars" aria-label={`${rating ? rating.toFixed(1) : "4.8"} out of 5 stars`}>★★★★★</span>
          <b>{rating ? rating.toFixed(1) : "4.8"}</b>
          <span className="zm-product-review-count">
            ({reviewCount || Math.max(8, Math.round(product.stockQuantity || 14))})
          </span>
        </div>

        <div className="mock-product-price zm-product-price">
          <strong>{money(product.price)}</strong>
          {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
          {save > 0 ? <em>Save {money(save)}</em> : null}
        </div>

        <div className="zm-product-cart-block">
          {addable ? (
            <button type="button" className="zm-product-cart-button" onClick={add} aria-label={`Add ${product.name} to cart`}>
              <PlusIcon size={18}/>
              <span>Add to Cart</span>
            </button>
          ) : (
            <Link className="zm-product-cart-button" href={`/product/${product.slug}/`}>
              <PlusIcon size={18}/>
              <span>Choose Options</span>
            </Link>
          )}
        </div>
      </div>

      <style jsx>{`
        .zm-shop-product-card {
          overflow: hidden;
          border: 1px solid #d9e2e7 !important;
          border-radius: 14px !important;
          background: #fff !important;
          box-shadow: none !important;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .zm-shop-product-card :global(.mock-product-media) {
          min-height: 250px;
          aspect-ratio: 1 / 1;
          background: #fff;
          border-bottom: 0 !important;
        }

        .zm-shop-product-card :global(.mock-product-media img) {
          object-fit: contain !important;
          object-position: center center !important;
          padding: 10px;
        }

        .zm-product-copy {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 14px 14px 15px;
        }

        .zm-product-title-block {
          min-height: 48px;
          display: flex;
          align-items: flex-start;
        }

        .zm-product-title {
          color: #0d2430 !important;
          font-size: 17px !important;
          line-height: 1.24 !important;
          font-weight: 900 !important;
          letter-spacing: -.15px;
        }

        .zm-product-rating,
        .zm-product-price,
        .zm-product-cart-block {
          margin-top: 10px;
        }

        .zm-product-rating {
          display: flex;
          align-items: center;
          gap: 5px;
          min-height: 22px;
          font-size: 14px !important;
          line-height: 1.2;
        }

        .zm-product-stars {
          color: #f6a400;
          font-size: 14px;
          letter-spacing: .4px;
          line-height: 1;
        }

        .zm-product-rating b {
          color: #40525d;
          font-size: 14px;
          font-weight: 800;
        }

        .zm-product-review-count {
          color: #84939b;
          font-size: 13px;
          font-weight: 650;
        }

        .zm-product-price {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 7px;
          padding-top: 2px;
        }

        .zm-product-price strong {
          color: #127185 !important;
          font-size: 22px !important;
          line-height: 1.1;
          font-weight: 900 !important;
        }

        .zm-product-price del {
          color: #99a5ac;
          font-size: 12px !important;
        }

        .zm-product-price em {
          color: #e25645;
          font-size: 11px !important;
          font-style: normal;
          font-weight: 800;
        }

        .zm-product-cart-block {
          margin-top: auto;
          padding-top: 14px;
        }

        .zm-product-cart-button {
          width: 100%;
          min-height: 46px;
          border: 0;
          border-radius: 9px;
          background: #1f7888;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          text-decoration: none;
          font-size: 16px;
          line-height: 1;
          font-weight: 900;
          cursor: pointer;
          box-shadow: none;
          transition: transform .18s ease, background .18s ease;
        }

        .zm-product-cart-button:hover {
          background: #176674;
          transform: translateY(-1px);
        }

        @media (max-width: 620px) {
          .zm-shop-product-card :global(.mock-product-media) {
            min-height: 190px;
          }

          .zm-shop-product-card :global(.mock-product-media img) {
            padding: 7px;
          }

          .zm-product-copy {
            padding: 11px 10px 12px;
          }

          .zm-product-title-block {
            min-height: 42px;
          }

          .zm-product-title {
            font-size: 14px !important;
          }

          .zm-product-stars {
            font-size: 12px;
          }

          .zm-product-rating b,
          .zm-product-review-count {
            font-size: 12px;
          }

          .zm-product-price strong {
            font-size: 18px !important;
          }

          .zm-product-cart-button {
            min-height: 41px;
            font-size: 14px;
          }
        }
      `}</style>
    </article>
  );
}
