"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { PriceSummary, Product, Variant } from "@/types/product";
import { pairOffer } from "@/lib/bundle-price";
import {trackStoreEvent} from "@/lib/client-tracking";
import { money } from "@/lib/format";
import { WhatsAppIcon } from "@/components/Icons";
import { useDeliveryPolicy } from "@/components/DeliveryPolicy";
import { Icon, Stars } from "./pdp-icons";

interface ProductBuyBoxProps {
  product: Product;
  variant: Variant | null;
  onSelectVariant: (v: Variant) => void;
  bundleSize: 1 | 2;
  setBundleSize: (size: 1 | 2) => void;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  basePrice: number;
  pricing: PriceSummary;
  bundleTotal: number;
  discountPercent: number;
  inStock: boolean;
  onAdd: (buyNow?: boolean) => void;
  whatsapp: string;
  actionRef: React.RefObject<HTMLDivElement | null>;
}

const HIDDEN_ATTRIBUTE_KEYS = new Set([
  "stockstatus",
  "gallery",
  "gtin",
  "downloadable",
  "virtual",
  "images",
  "weight",
  "length",
  "width",
  "height",
]);

type CatalogAttribute = {
  name?: string;
  valuesText?: string;
  visible?: boolean;
  forVariations?: boolean;
};

function splitAttributeValues(value: unknown) {
  const text = String(value || "");
  const parts = text.includes("|") ? text.split("|") : text.split(",");
  return parts.map((part) => part.trim()).filter(Boolean);
}

function selectedAttributeValue(attributes: Record<string, string> | undefined, name: string) {
  if (!attributes) return "";
  if (attributes[name]) return String(attributes[name]).trim();
  const match = Object.entries(attributes).find(([key]) => key.trim().toLowerCase() === name.toLowerCase());
  return match ? String(match[1] || "").trim() : "";
}

const NAMED_COLORS: Record<string, string> = {
  red: "#e11d2e",
  blue: "#2563eb",
  black: "#111827",
  blck: "#111827",
  white: "#ffffff",
  green: "#16a34a",
  yellow: "#facc15",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#7c3aed",
  brown: "#8b5a2b",
  grey: "#6b7280",
  gray: "#6b7280",
  navy: "#1e3a8a",
  beige: "#e8d5b5",
  cream: "#f5efe6",
  gold: "#d4a017",
  silver: "#c0c0c0",
  maroon: "#7f1d1d",
  teal: "#0d9488",
  cyan: "#06b6d4",
  magenta: "#c026d3",
  violet: "#7c3aed",
  indigo: "#4338ca",
  lime: "#84cc16",
  olive: "#6b8e23",
  khaki: "#c3b091",
  coral: "#ff6f61",
  rose: "#e11d48",
  burgundy: "#800020",
  turquoise: "#40e0d0",
  lavender: "#c4b5fd",
  peach: "#ffcba4",
  mint: "#98f5d0",
  ivory: "#fffff0",
  charcoal: "#36454f",
  tan: "#d2b48c",
  chocolate: "#7b3f00",
  sky: "#38bdf8",
  "sky blue": "#38bdf8",
  "light blue": "#7dd3fc",
  "dark blue": "#1e3a8a",
  "light green": "#86efac",
  "dark green": "#14532d",
  "hot pink": "#ff69b4",
  "rose red": "#c21e56",
  "off white": "#f8f5f0",
  "off-white": "#f8f5f0",
};

function colorCss(value: string) {
  const raw = value.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^(rgb|hsl)a?\(/i.test(raw)) return value.trim();
  if (NAMED_COLORS[raw]) return NAMED_COLORS[raw];
  const first = raw.split(/[\s/-]+/)[0];
  return NAMED_COLORS[first] || "";
}

type AttributeRow = { name: string; values: string[]; selected: string; forVariations: boolean };

/** Every visible attribute, each value kept separate so colors can render as their own swatches. */
function productAttributeRows(product: Product, variant: Variant | null): AttributeRow[] {
  const catalog = Array.isArray(product.catalogMeta?.attributes) ? (product.catalogMeta.attributes as CatalogAttribute[]) : [];
  const rows: AttributeRow[] = [];
  const used = new Set<string>();
  for (const attribute of catalog) {
    if (attribute?.visible === false) continue;
    const name = String(attribute?.name || "").trim();
    if (!name) continue;
    const selected = selectedAttributeValue(variant?.attributes, name);
    const values = splitAttributeValues(attribute.valuesText);
    if (selected && !values.some((value) => value.toLowerCase() === selected.toLowerCase())) values.unshift(selected);
    if (!values.length) continue;
    used.add(name.toLowerCase());
    rows.push({ name, values, selected, forVariations: attribute?.forVariations !== false && (product.variants || []).length > 0 });
  }
  for (const [key, value] of Object.entries(variant?.attributes || {})) {
    const name = key.trim();
    const text = String(value || "").trim();
    if (!name || !text || HIDDEN_ATTRIBUTE_KEYS.has(name.toLowerCase()) || used.has(name.toLowerCase())) continue;
    used.add(name.toLowerCase());
    rows.push({ name, values: [text], selected: text, forVariations: (product.variants || []).length > 0 });
  }
  return rows;
}

function variantForAttribute(product: Product, variant: Variant | null, name: string, value: string) {
  const variants = product.variants || [];
  const current = variant?.attributes || {};
  const wanted = { ...current, [name]: value };
  const matches = (item: Variant, strict: boolean) =>
    Object.entries(wanted).every(([key, entry]) => {
      if (!entry) return true;
      const actual = selectedAttributeValue(item.attributes, key);
      if (!actual) return !strict;
      return actual.toLowerCase() === entry.toLowerCase();
    });
  return variants.find((item) => matches(item, true)) || variants.find((item) => selectedAttributeValue(item.attributes, name).toLowerCase() === value.toLowerCase()) || null;
}

const CheckMark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export default function ProductBuyBox({
  product,
  variant,
  onSelectVariant,
  bundleSize,
  setBundleSize,
  quantity,
  setQuantity,
  basePrice,
  pricing,
  bundleTotal,
  discountPercent,
  inStock,
  onAdd,
  whatsapp,
  actionRef,
}: ProductBuyBoxProps) {
  const [deliveryDate, setDeliveryDate] = useState("3 business days");
  const delivery = useDeliveryPolicy();
  const freeShipping = Boolean(product.freeShipping ?? product.catalogMeta?.freeShipping);

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

  // Tracked stock caps how many can be ordered (pieces = quantity × bundle size); untracked stock does not.
  const trackedStock = variant
    ? variant.trackStock ? Number(variant.stock || 0) : null
    : product.trackStock && product.stockQuantity != null ? Number(product.stockQuantity) : null;
  const maxQuantity = Math.max(1, Math.min(10, trackedStock == null ? 10 : Math.floor(trackedStock / (bundleSize === 2 ? 2 : 1))));
  // Sale price, saving and percent come from the backend price summary
  const salePercent = pricing.discountPercent;
  const pair = pairOffer(basePrice, discountPercent);
  const orderTotal = bundleTotal * quantity;
  const compareTotal = (pricing.onSale ? pricing.regularPrice * (bundleSize === 2 ? 2 : 1) : bundleSize === 2 ? pair.full : basePrice) * quantity;
  const totalSaving = Math.max(0, compareTotal - orderTotal);
  const savingPercent = bundleSize === 2 ? (pricing.onSale ? 0 : discountPercent) : salePercent;
  const categoryName = product.categories?.[0]?.name || "";
  const categorySlug = product.categories?.[0]?.slug || product.categorySlugs?.[0] || "";
  // Split "Rs 700" so the currency can sit smaller beside the amount
  const priceText = money(orderTotal);
  const priceParts = priceText.match(/^(\D+?)\s*(\d[\d,.]*)$/);
  const reviewCount = product.reviewCount || 0;
  const rating = reviewCount && product.averageRating ? product.averageRating : 0;
  const attributeRows = productAttributeRows(product, variant);

  // Safe client-side handler: fixes hydration mismatch by accessing window.location only on user click
  const handleWhatsAppClick = () => {
    void trackStoreEvent("Contact",{contact_method:"whatsapp",content_ids:[variant?.sku||product.sku]});
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
    <div className="zpd-buy">
      {/* 1. CATEGORY, TITLE, RATING & SHORT DESCRIPTION */}
      <div className="zpd-buy-head">
        {categoryName ? (
          categorySlug ? (
            <Link href={`/product-category/${categorySlug}/`} className="zpd-chip">
              {categoryName}
            </Link>
          ) : (
            <span className="zpd-chip">{categoryName}</span>
          )
        ) : null}
        <h1 className="zpd-title">{product.name}</h1>

        {reviewCount > 0 ? (
          <div className="zpd-rating">
            <Stars value={rating} />
            <b>{rating.toFixed(1)}</b>
            <a href="#reviews">
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </a>
          </div>
        ) : null}

        {product.shortDescription ? (
          <div className="zpd-short" dangerouslySetInnerHTML={{ __html: product.shortDescription }} />
        ) : null}
      </div>

      {/* 2. PRICING ROW */}
      <div className={`zpd-price${totalSaving > 0 ? " is-sale" : ""}`}>
        <div className="zpd-price-main">
          <span className="zpd-price-now" aria-label={priceText}>
            {priceParts ? (
              <>
                <small aria-hidden="true">{priceParts[1]}</small>
                <span aria-hidden="true">{priceParts[2]}</span>
              </>
            ) : (
              priceText
            )}
          </span>
          {totalSaving > 0 ? <del className="zpd-price-was">{money(compareTotal)}</del> : null}
        </div>
        {totalSaving > 0 ? (
          <span className="zpd-price-save">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12V4h8l10 10-8 8z" />
              <path d="M7.5 8.5h.01" />
            </svg>
            Save {money(totalSaving)}{savingPercent ? ` (${savingPercent}%)` : ""}
          </span>
        ) : null}
      </div>

      {/* 3. SHIPPING NOTE */}
      <div className={`zpd-note${freeShipping ? " is-free" : ""}`}>
        <span className="zpd-note-icon">
          <Icon name="truck" />
        </span>
        <div>
          <b>{freeShipping ? "Free shipping" : `Delivery charges ${money(delivery.flatRate)}`}</b>
          <p>
            {freeShipping
              ? `This product ships free. Orders above ${money(delivery.threshold)} ship free too.`
              : `Orders above ${money(delivery.threshold)} ship free. Pay cash when the parcel arrives.`}
          </p>
        </div>
      </div>

      {/* 4. BUNDLE OPTIONS */}
      {product.bundleEnabled && (
        <div>
          <div className="zpd-block-head">
            <span className="zpd-block-label">Choose your bundle</span>
            <span className="zpd-block-hint">Buy 2, save {discountPercent}%</span>
          </div>

          <div className="zpd-bundle-grid">
            <label className={`zpd-bundle${bundleSize === 1 ? " is-active" : ""}`}>
              <input type="radio" name="bundle" checked={bundleSize === 1} onChange={() => setBundleSize(1)} />
              <span className="zpd-radio" />
              <span className="zpd-bundle-body">
                <span className="zpd-bundle-name">Buy 1</span>
                <span className="zpd-bundle-price">
                  <b>{money(basePrice)}</b>
                </span>
              </span>
            </label>

            <label className={`zpd-bundle${bundleSize === 2 ? " is-active" : ""}`}>
              <span className="zpd-bundle-tag">Best value</span>
              <input type="radio" name="bundle" checked={bundleSize === 2} onChange={() => setBundleSize(2)} />
              <span className="zpd-radio" />
              <span className="zpd-bundle-body">
                <span className="zpd-bundle-name">Buy 2</span>
                <span className="zpd-bundle-save">Save {money(pair.saving)}</span>
                <span className="zpd-bundle-price">
                  <b>{money(pair.total)}</b>
                  <del>{money(pair.full)}</del>
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {attributeRows.length > 0 ? (
        <div className="zpd-attrs">
          <div className="zpd-block-head">
            <span className="zpd-block-label">Product details</span>
          </div>
          <div className="zpd-attr-list">
            {attributeRows.map((row) => {
              const colorAttribute = /colou?r/i.test(row.name) || row.values.every((value) => Boolean(colorCss(value)));
              return (
                <div key={row.name}>
                  <span className="zpd-attr-name">{row.name}</span>
                  <div className="zpd-attr-values">
                    {row.values.map((value) => {
                      const color = colorAttribute ? colorCss(value) : "";
                      const active = row.selected.toLowerCase() === value.toLowerCase();
                      const nextVariant = row.forVariations ? variantForAttribute(product, variant, row.name, value) : null;
                      const className = `zpd-attr-chip${active ? " is-active" : ""}${color ? " is-color" : ""}`;
                      const body = (
                        <>
                          {color ? <i className="zpd-attr-dot" style={{ background: color }} aria-hidden="true" /> : null}
                          <span>{value}</span>
                        </>
                      );
                      return nextVariant ? (
                        <button key={value} type="button" className={className} aria-pressed={active} onClick={() => onSelectVariant(nextVariant)}>
                          {body}
                        </button>
                      ) : (
                        <span key={value} className={className}>
                          {body}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 5. QUANTITY COUNTER + STOCK + ORDER TOTAL */}
      <div className="zpd-qty-row">
        <div className="zpd-qty-left">
          <div className="zpd-stepper">
            <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity">
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))} aria-label="Increase quantity">
              +
            </button>
          </div>

          <div className={`zpd-stock${inStock ? "" : " is-out"}`}>
            <i />
            <span>
              <b>{inStock ? "In stock" : "Out of stock"}</b>
              {inStock ? <span>Ships within 24 hours</span> : null}
            </span>
          </div>
        </div>

        <div className="zpd-total">
          <span>Order total</span>
          <b>{money(orderTotal)}</b>
        </div>
      </div>

      {/* 6. MAIN ACTIONS ATTACHED TO actionRef */}
      <div ref={actionRef} className="zpd-actions">
        <button type="button" className="zpd-cta" disabled={!inStock} onClick={() => onAdd(true)}>
          <span>{inStock ? "Order Now – Cash on Delivery" : "Out of stock"}</span>
          <Icon name="arrow" />
        </button>

        <p className="zpd-cta-note">Pay when your parcel arrives · Delivered by PostEx</p>

        <div className="zpd-actions-row">
          <button type="button" className="zpd-btn is-whatsapp" onClick={handleWhatsAppClick}>
            <WhatsAppIcon size={18} />
            <span>Order on WhatsApp</span>
          </button>

          <button type="button" className="zpd-btn" disabled={!inStock} onClick={() => onAdd(false)}>
            <Icon name="cart" />
            <span>Add to cart</span>
          </button>
        </div>
      </div>

      {/* 7. POSTEX ESTIMATED ARRIVAL */}
      <div className="zpd-note">
        <span className="zpd-note-icon">
          <Icon name="box" />
        </span>
        <div>
          <b>Order now — get it by: {deliveryDate}</b>
          <p>Delivered to your doorstep by PostEx</p>
        </div>
      </div>

      {/* 8. DELIVERY TIMELINE */}
      <div className="zpd-timeline">
        <div className="zpd-step is-done">
          <span className="zpd-step-dot">
            <CheckMark />
          </span>
          <b>Ordered</b>
          <span>Today</span>
        </div>
        <span className="zpd-step-line" />
        <div className="zpd-step is-current">
          <span className="zpd-step-dot">
            <Icon name="truck" />
          </span>
          <b>Dispatched</b>
          <span>1–2 days</span>
        </div>
        <span className="zpd-step-line is-next" />
        <div className="zpd-step">
          <span className="zpd-step-dot">
            <Icon name="box" />
          </span>
          <b>Delivered</b>
          <span>2–5 days</span>
        </div>
      </div>
    </div>
  );
}
