"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import { money } from "@/lib/format";

interface ProductGridProps {
  products: Product[];
  onAddToCart?: (productId: string) => void;
  emptyText?: string;       // <-- Added to fix TS2322
  className?: string;       // <-- Added optional className
}

export default function ProductGrid({
  products,
  onAddToCart,
  emptyText = "No products found in this category.",
  className = "",
}: ProductGridProps) {
  // Handle empty product list cleanly
  if (!products || products.length === 0) {
    return (
      <div className="w-full py-12 text-center text-slate-500 text-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-stretch ${className}`}>
      {products.map((item) => {
        const imgSrc =
          (typeof item.images?.[0] === "string" ? item.images[0] : item.images?.[0]?.src) ||
          (item as any).image ||
          "/images/placeholder.webp";

        const price = Number(item.price || 0);
        const regularPrice = item.regularPrice ? Number(item.regularPrice) : null;
        const savings = regularPrice && regularPrice > price ? regularPrice - price : null;
        const colorsCount = item.variants?.length || 0;
        const hasOptions = colorsCount > 1;
        const rating = Number(item.averageRating || 4.8);
        const reviewsCount = Number(item.reviewCount || 29);

        return (
          <article
            key={item.id}
            className="flex flex-col h-full bg-white rounded-3xl p-4 sm:p-4.5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 group"
          >
            <Link
              href={`/product/${item.slug}`}
              className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 mb-3.5 block"
            >
              <Image
                src={imgSrc}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {item.featured ? (
                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-tight bg-slate-900 text-white shadow-xs">
                  Bestseller
                </span>
              ) : (
                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-tight bg-rose-100 text-rose-700 border border-rose-200/80 shadow-xs">
                  Gift-ready
                </span>
              )}
            </Link>

            <Link href={`/product/${item.slug}`} className="block">
              <h3 className="text-sm md:text-[14.5px] font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2 min-h-[2.6rem] leading-snug">
                {item.name}
              </h3>
            </Link>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 mb-1.5 flex-wrap">
              <span className="text-[#f59e0b] text-xs">★</span>
              <span className="font-bold text-slate-800 text-xs">
                {rating.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">
                {reviewsCount.toLocaleString()} reviews
              </span>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap min-h-[1.75rem] mb-1.5">
              <span className="text-base sm:text-lg font-black text-slate-900">
                {money(price)}
              </span>

              {regularPrice && regularPrice > price && (
                <span className="text-xs text-slate-400 line-through">
                  {money(regularPrice)}
                </span>
              )}

              {savings && (
                <span className="text-[11px] font-bold text-rose-600">
                  Save {money(savings)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 min-h-[1.3rem] mb-3.5">
              {colorsCount > 0 ? (
                <>
                  <div className="flex -space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-300 ring-1 ring-white" />
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-300 ring-1 ring-white" />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {colorsCount} colours
                  </span>
                </>
              ) : (
                <span className="h-2.5" />
              )}
            </div>

            <div className="mt-auto pt-1">
              {hasOptions ? (
                <Link
                  href={`/product/${item.slug}`}
                  className="w-full py-3 px-3 rounded-2xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-2xs"
                >
                  <svg
                    className="w-4 h-4 text-slate-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span className="truncate">Choose Options</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddToCart?.(item.id)}
                  className="w-full py-3 px-3 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 shadow-xs hover:shadow transition active:scale-[0.98] cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 text-white shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span className="truncate">Add to Cart</span>
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}