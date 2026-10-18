"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import { money } from "@/lib/format";
import { useCart } from "@/components/CartProvider";
import { BUY_TWO_DISCOUNT_PERCENT } from "@/lib/bundle-price";
import { productPricing } from "@/lib/product-price";
import { trackStoreEvent } from "@/lib/client-tracking";

interface ProductGridProps {
  products: Product[];
  onAddToCart?: (productId: string) => void;
  emptyText?: string;       // <-- Added to fix TS2322
  className?: string;       // <-- Added optional className
  variant?: "default" | "storefront";
}

export default function ProductGrid({
  products,
  onAddToCart,
  emptyText = "No products found in this category.",
  className = "",
}: ProductGridProps) {
  const { addItem } = useCart();

  // Handle empty product list cleanly
  if (!products || products.length === 0) {
    return (
      <div className="w-full py-12 text-center text-slate-500 text-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-start ${className}`}>
      {products.map((item) => {
        const imgSrc =
          (typeof item.images?.[0] === "string" ? item.images[0] : item.images?.[0]?.src) ||
          (item as any).image ||
          "/images/placeholder.webp";

        const colorsCount = item.variants?.length || 0;
        const hasOptions = colorsCount > 1;
        const onlyVariant = colorsCount === 1 ? item.variants[0] : null;
        const pricing = productPricing(item, onlyVariant);
        const price = pricing.price;
        const regularPrice = pricing.onSale ? pricing.regularPrice : null;
        const savings = pricing.saveAmount || null;
        const reviewsCount = Number(item.reviewCount || 0);
        const rating = Number(item.averageRating || 0);
        const inStock = item.stockStatus === "instock";

        const addToCart = () => {
          if (onAddToCart) return onAddToCart(item.id);
          const sku = onlyVariant?.sku || item.sku;
          addItem({
            productId: item.id,
            variantId: onlyVariant?.id,
            sku,
            slug: item.slug,
            name: item.name,
            image: onlyVariant?.imageUrl || imgSrc,
            price,
            quantity: 1,
            bundleSize: 1,
            bundleDiscountPercent: item.buyTwoDiscountPercent || BUY_TWO_DISCOUNT_PERCENT,
            variantLabel: onlyVariant?.name,
            freeShipping: Boolean(item.freeShipping),
          });
          trackStoreEvent(
            "AddToCart",
            { content_ids: [sku], contents: [{ id: sku, quantity: 1, item_price: price }], value: price, currency: "PKR" },
          ).catch(() => undefined);
        };

        return (
          <article
            key={item.id}
            className="flex flex-col overflow-hidden bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group rounded-2xl"
          >
            <Link
              href={`/product/${item.slug}`}
              className="relative aspect-square w-full overflow-hidden bg-[#f3f5f7] block"
            >
              <Image
                src={imgSrc}
                alt={(typeof item.images?.[0] === "object" && item.images[0]?.alt) || item.name}
                title={(typeof item.images?.[0] === "object" && item.images[0]?.title) || undefined}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-contain object-center"
              />

              {item.featured ? (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight bg-slate-900/90 text-white">
                  Bestseller
                </span>
              ) : null}
            </Link>

            <div className="flex flex-col gap-1 px-2.5 pt-2 pb-2.5">
              <Link href={`/product/${item.slug}`} className="block">
                <h3 className="text-[13px] font-semibold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-2 leading-tight">
                  {item.name}
                </h3>
              </Link>

              {reviewsCount > 0 ? (
                <div className="flex items-center gap-1 text-[11px] leading-none text-slate-500">
                  <span className="text-[#f59e0b] text-[12px] leading-none">★</span>
                  <span className="font-semibold text-slate-800">{rating.toFixed(1)}</span>
                  <span className="text-slate-400">{reviewsCount.toLocaleString()} review{reviewsCount === 1 ? "" : "s"}</span>
                </div>
              ) : null}

              <div className="flex items-baseline gap-1.5 flex-wrap leading-none">
                <span className="text-[15px] font-extrabold text-slate-900">{money(price)}</span>
                {regularPrice && regularPrice > price ? (
                  <span className="text-[11px] text-slate-400 line-through">{money(regularPrice)}</span>
                ) : null}
                {savings ? (
                  <span className="text-[11px] font-bold text-rose-600">Save {money(savings)} ({pricing.discountPercent}%)</span>
                ) : null}
              </div>

              {colorsCount > 0 ? (
                <div className="flex items-center gap-1.5 leading-none">
                  <div className="flex -space-x-1">
                    <span className="w-2 h-2 rounded-full bg-rose-300 ring-1 ring-white" />
                    <span className="w-2 h-2 rounded-full bg-sky-300 ring-1 ring-white" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{colorsCount} colours</span>
                </div>
              ) : null}

              <div className="pt-1">
                {hasOptions ? (
                  <Link
                    href={`/product/${item.slug}`}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[13px] flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="truncate">Choose Options</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={!inStock}
                    className="w-full py-2 px-3 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs hover:shadow transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="truncate">{inStock ? "Add to Cart" : "Out of stock"}</span>
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}