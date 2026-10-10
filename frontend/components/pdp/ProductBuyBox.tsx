"use client";

import React, { useMemo, useState, useEffect } from "react";
import type { Product, Variant } from "@/types/product";
import { money } from "@/lib/format";
import { WhatsAppIcon } from "@/components/Icons";
import { Icon, isValidImageUrl, initials } from "./pdp-icons";

interface ProductBuyBoxProps {
  product: Product;
  variant: Variant | null;
  onSelectVariant: (v: Variant) => void;
  bundleSize: 1 | 2;
  setBundleSize: (size: 1 | 2) => void;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  basePrice: number;
  bundleTotal: number;
  discountPercent: number;
  inStock: boolean;
  onAdd: (buyNow?: boolean) => void;
  whatsapp: string;
  actionRef: React.RefObject<HTMLDivElement | null>;
}

export default function ProductBuyBox({
  product,
  variant,
  onSelectVariant,
  bundleSize,
  setBundleSize,
  quantity,
  setQuantity,
  basePrice,
  bundleTotal,
  discountPercent,
  inStock,
  onAdd,
  whatsapp,
  actionRef,
}: ProductBuyBoxProps) {
  const [wished, setWished] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("3 business days");

  // Prevent SSR/Client timezone hydration mismatches on date
  useEffect(() => {
    const target = new Date();
    target.setDate(target.getDate() + 3);
    setDeliveryDate(
      target.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  const maxQuantity = Math.max(1, Math.min(10, variant ? Math.max(variant.stock, 1) : 10));
  const saveAmount = product.onSale && product.regularPrice > basePrice ? product.regularPrice - basePrice : 0;
  const salePercent = saveAmount ? Math.max(1, Math.round((saveAmount / product.regularPrice) * 100)) : 0;
  const twoPieceFull = basePrice * 2;
  const twoPiecePrice = twoPieceFull * (1 - discountPercent / 100);
  const twoPieceSavings = twoPieceFull - twoPiecePrice;
  const categoryName: string | undefined =
    (product as any)?.categories?.[0]?.name || (product as any)?.category?.name || undefined;
  const reviewTotal = product.reviewCount || 42;
  const reviewCountLabel = `${reviewTotal} customer ${reviewTotal === 1 ? "review" : "reviews"}`;

  const handleShare = async () => {
    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: product.name, url: window.location.href });
        return;
      } catch { }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Safe client-side handler: fixes hydration mismatch by accessing window.location only on user click
  const handleWhatsAppClick = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const colorPart = variant?.name ? ` (Color: ${variant.name})` : "";
    const msg = encodeURIComponent(
      `Hi Zelvomart! I want to order "${product.name}"${colorPart}\n` +
      `Bundle: ${bundleSize === 2 ? "2 pieces pack" : "1 piece"}\n` +
      `Quantity: ${quantity}\n` +
      `Total: ${money(bundleTotal * quantity)}\n` +
      `Link: ${url}`
    );
    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm flex flex-col gap-4">
      {/* 1. REVIEWS ROW + WISHLIST / SHARE */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex text-amber-400 text-[15px] tracking-tight">★★★★★</span>
            <span className="text-sm font-bold text-slate-900">
              {product.averageRating?.toFixed(1) || "4.9"}
            </span>
            <a
              href="#reviews"
              className="text-sm font-medium text-sky-600 hover:text-sky-700 underline underline-offset-2"
            >
              ({reviewCountLabel})
            </a>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Wishlist Heart Toggle */}
            <button
              type="button"
              onClick={() => setWished((w) => !w)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${wished
                  ? "border-rose-200 bg-rose-50 text-rose-500 scale-105"
                  : "border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 bg-white"
                }`}
              aria-label="Add to wishlist"
              title={wished ? "Saved to wishlist" : "Add to wishlist"}
            >
              <svg
                className={`w-4 h-4 transition-transform ${wished ? "fill-rose-500 stroke-rose-500" : "fill-none stroke-current"}`}
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>

            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 hover:border-slate-300 bg-white text-slate-500 hover:text-slate-700 transition cursor-pointer relative"
              aria-label="Share product"
              title="Share product link"
            >
              <Icon name="share" />
              {copiedLink && (
                <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap z-20">
                  Link copied!
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 2. CATEGORY */}
        {categoryName && (
          <p className="text-[11px] md:text-xs font-extrabold uppercase tracking-[0.14em] text-sky-600">
            {categoryName}
          </p>
        )}

        {/* 3. TITLE */}
        <h1 className="text-[28px] md:text-[34px] font-extrabold text-slate-900 tracking-tight leading-[1.12]">
          {product.name}
        </h1>
      </div>

      {/* 4. PRICING ROW */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="text-[32px] md:text-4xl font-extrabold text-slate-900 tracking-tight">
          {money(basePrice * (bundleSize === 2 ? 2 * (1 - discountPercent / 100) : 1) * quantity)}
        </span>
        {product.onSale && product.regularPrice > basePrice && (
          <del className="text-sm font-semibold text-slate-400 line-through">
            {money(product.regularPrice * (bundleSize === 2 ? 2 : 1) * quantity)}
          </del>
        )}
        {salePercent ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60">
            Save {money(saveAmount * quantity)} ({salePercent}%)
          </span>
        ) : null}
      </div>

      {/* 4b. SHORT DESCRIPTION (directly below the price) */}
      {product.shortDescription && (
        <p className="text-[15px] md:text-base leading-relaxed text-slate-600 whitespace-pre-line">
          {product.shortDescription}
        </p>
      )}

      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 -mt-1">
        <span>✓</span> Free delivery · Pay cash when it arrives
      </p>

      {/* 5. CIRCULAR COLOR SWATCHES */}
      {product.variants.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-bold uppercase text-slate-700 mb-2">
            SELECT COLOR:{" "}
            <span className="text-sky-600 font-extrabold">{variant?.name || "DEFAULT"}</span>
          </p>
          <div className="flex gap-2.5 flex-wrap items-center">
            {product.variants.map((v) => {
              const isSelected = variant?.id === v.id;
              const hasValidImg = isValidImageUrl(v.imageUrl);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVariant(v)}
                  className="flex flex-col items-center gap-1 group cursor-pointer focus:outline-none"
                >
                  <span
                    className={`w-11 h-11 rounded-full p-0.5 border-2 transition-all flex items-center justify-center overflow-hidden bg-slate-50 ${isSelected
                        ? "border-sky-600 ring-2 ring-sky-200 scale-105"
                        : "border-slate-300 hover:border-slate-400"
                      }`}
                  >
                    {hasValidImg ? (
                      <img
                        src={v.imageUrl!}
                        alt={v.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={`text-[11px] font-bold uppercase ${isSelected ? "text-sky-600" : "text-slate-500"
                          }`}
                      >
                        {initials(v.name) || "•"}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] leading-tight max-w-[56px] truncate ${isSelected ? "font-bold text-slate-900" : "font-medium text-slate-500"
                      }`}
                  >
                    {v.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. BUNDLE OPTIONS */}
      {product.bundleEnabled && (
        <div className="pt-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-800">Choose your bundle</span>
            <span className="text-xs font-bold text-amber-600">Buy 2, save {discountPercent}%</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label
              onClick={() => setBundleSize(1)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${bundleSize === 1
                  ? "border-sky-500 bg-sky-50/40"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
            >
              <input
                type="radio"
                name="bundle"
                checked={bundleSize === 1}
                onChange={() => setBundleSize(1)}
                className="mt-0.5 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  1 piece
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Standard pack</span>
                <span className="text-xs font-bold text-slate-900 block mt-1">
                  {money(basePrice)}
                </span>
              </div>
            </label>

            <label
              onClick={() => setBundleSize(2)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all relative ${bundleSize === 2
                  ? "border-sky-500 bg-sky-50/40"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
            >
              <input
                type="radio"
                name="bundle"
                checked={bundleSize === 2}
                onChange={() => setBundleSize(2)}
                className="mt-0.5 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  2 pieces
                </span>
                <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
                  Save {money(twoPieceSavings)}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xs font-bold text-slate-900">
                    {money(twoPiecePrice)}
                  </span>
                  <span className="text-[10px] text-slate-400 line-through">
                    {money(twoPieceFull)}
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* 7. QUANTITY COUNTER + STOCK */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setQuantity((c) => Math.max(1, c - 1))}
              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-sm font-bold transition cursor-pointer"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-bold text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((c) => Math.min(maxQuantity, c + 1))}
              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-sm font-bold transition cursor-pointer"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${inStock ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
            />
            <div className="text-[11px] leading-tight">
              <b className={inStock ? "text-slate-800" : "text-rose-600"}>
                {inStock ? "In stock" : "Out of stock"}
              </b>
              {inStock && <span className="text-slate-400 block">Ships within 24 hours</span>}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Order total
          </span>
          <span className="text-base font-black text-slate-900">
            {money(bundleTotal * quantity)}
          </span>
        </div>
      </div>

      {/* 8. MAIN ACTIONS ATTACHED TO actionRef */}
      <div ref={actionRef} className="pt-2 flex flex-col gap-2.5">
        <button
          type="button"
          disabled={!inStock}
          onClick={() => onAdd(true)}
          className="w-full py-4 px-6 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] active:bg-[#9a3412] text-white font-extrabold text-sm md:text-base tracking-wide uppercase shadow-lg shadow-orange-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{inStock ? "Order Now – Cash on Delivery" : "Out of stock"}</span>
          <Icon name="arrow" />
        </button>

        <p className="text-center text-[11px] text-slate-500 font-medium -mt-0.5">
          Pay when your parcel arrives · Delivered by PostEx
        </p>

        {/* 9. SECONDARY 2-COLUMN BUTTONS: WHATSAPP & ADD TO CART */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* WhatsApp Order Button */}
          <button
            type="button"
            onClick={handleWhatsAppClick}
            className="w-full py-2.5 px-3 rounded-xl border-2 border-emerald-500 text-emerald-700 bg-emerald-50/40 hover:bg-emerald-100/60 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <WhatsAppIcon size={16} />
            <span className="truncate">Order on WhatsApp</span>
          </button>

          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={!inStock}
            onClick={() => onAdd(false)}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <Icon name="cart" />
            <span className="truncate">Add to cart</span>
          </button>
        </div>
      </div>

      {/* 10. POSTEX ESTIMATED ARRIVAL */}
      <div className="mt-1 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sky-600 shrink-0 shadow-2xs">
          <Icon name="truck" />
        </div>
        <div className="text-xs">
          <b className="text-slate-900 block">
            Order now — get it by: {deliveryDate}
          </b>
          <span className="text-slate-500 text-[11px]">
            Delivered to your doorstep by PostEx
          </span>
        </div>
      </div>

      {/* 11. LIVE ANIMATED TRACKING TIMELINE */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-center select-none">
        {/* Step 1: Ordered */}
        <div className="flex flex-col items-center">
          <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
            ✓
          </span>
          <b className="text-[11px] text-slate-900 mt-1">Ordered</b>
          <span className="text-[10px] text-slate-400">Today</span>
        </div>

        {/* Animated Connecting Line 1 */}
        <div className="flex-1 h-1 bg-slate-100 mx-2 -mt-4 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600 animate-pulse" />
        </div>

        {/* Step 2: Dispatched with Active Beacon Ping Animation */}
        <div className="flex flex-col items-center relative">
          <div className="relative flex items-center justify-center w-6 h-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex items-center justify-center rounded-full w-6 h-6 bg-sky-600 text-white text-[10px] font-bold shadow-sm">
              ■
            </span>
          </div>
          <b className="text-[11px] text-sky-700 font-extrabold mt-1">Dispatched</b>
          <span className="text-[10px] text-slate-500 font-medium">1–2 days</span>
        </div>

        {/* Connecting Line 2 */}
        <div className="flex-1 h-1 bg-slate-200/90 mx-2 -mt-4 rounded-full relative overflow-hidden">
          <div className="h-full w-1/3 bg-sky-400/40 rounded-full animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
        </div>

        {/* Step 3: Delivered */}
        <div className="flex flex-col items-center">
          <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center text-[10px] font-bold">
            □
          </span>
          <b className="text-[11px] text-slate-600 mt-1">Delivered</b>
          <span className="text-[10px] text-slate-400">2–5 days</span>
        </div>
      </div>
    </div>
  );
}