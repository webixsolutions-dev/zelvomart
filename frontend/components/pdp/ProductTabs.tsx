"use client";

import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Product, Variant } from "@/types/product";
import type { ResolvedProductTab } from "@/lib/product-tabs";
import { Stars } from "./pdp-icons";

interface ProductTabsProps {
  product: Product | any;
  variant: Variant | null;
  inStock: boolean;
  sections?: ResolvedProductTab[];
}

function AccordionItem({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`zpd-acc-item${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="zpd-acc-trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`zpd-panel-${id}`}
      >
        <span>{title}</span>
        <span className="zpd-acc-icon" aria-hidden="true" />
      </button>
      {/* Stays mounted so the copy is in the page for search engines; CSS collapses it */}
      <div className="zpd-acc-panel" id={`zpd-panel-${id}`} role="region">
        <div className="zpd-acc-inner">
          <div className="zpd-acc-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function ProductTabs({
  product,
  variant,
  inStock,
  sections = [],
}: ProductTabsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    description: true,
    whyChoose: false,
    shipping: false,
    faq: false,
    additional: false,
    reviews: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Real numbers only: the list of reviews when it is loaded, otherwise the stored count
  const { reviewCount, averageRating } = useMemo(() => {
    const list = Array.isArray(product?.reviews) ? product.reviews : [];
    if (list.length > 0) {
      const sum = list.reduce((total: number, review: { rating?: number }) => total + Number(review.rating || 0), 0);
      return { reviewCount: list.length, averageRating: sum / list.length };
    }
    const count = Number(product?.reviewCount || 0);
    return { reviewCount: count, averageRating: count ? Number(product?.averageRating || 0) : 0 };
  }, [product]);

  const specificationRows = useMemo(() => {
    const rows: Array<[string, string]> = [
      ["SKU", variant?.sku || product?.sku || "ZVM-PROD"],
      [
        "Category",
        product?.categories?.[0]?.name ||
          product?.category?.name ||
          "Home & Living",
      ],
      [
        "Availability",
        inStock
          ? `${variant?.stock ?? product?.stockQuantity ?? product?.stock ?? 100} in stock`
          : "Out of stock",
      ],
      ...(variant?.gtin ? [["GTIN", String(variant.gtin)] as [string, string]] : []),
      ["Payment", "Cash on Delivery (COD) across Pakistan"],
      ["Warranty", "7-Day Check & Replacement Guarantee"],
    ];

    if (variant?.attributes) {
      for (const [key, value] of Object.entries(variant.attributes)) {
        if (value && !["stockStatus", "gallery", "gtin", "downloadable", "virtual", "images"].includes(key)) {
          rows.splice(2, 0, [
            key.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            String(value),
          ]);
        }
      }
    }
    return rows;
  }, [product, variant, inStock]);

  const scrollToReviews = () => {
    const el = document.getElementById("reviews");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="zpd-details">
      <div className="zpd-details-head">
        <span className="zpd-eyebrow">Product information</span>
        <h2 className="zpd-h2">Details, delivery &amp; reviews</h2>
      </div>

      <div className="zpd-acc">
        {/* 1. DESCRIPTION */}
        <AccordionItem
          id="description"
          title="Description"
          open={Boolean(openSections.description)}
          onToggle={() => toggleSection("description")}
        >
          {product?.descriptionHtml || product?.description ? (
            <div
              className="zpd-prose"
              dangerouslySetInnerHTML={{
                __html: product.descriptionHtml || product.description,
              }}
            />
          ) : (
            <div className="zpd-prose">
              <h3>{product?.title || product?.name}</h3>
              <p>
                {product?.shortDescription ||
                  "Keep your drinks hot or cold for hours with the double-wall stainless steel insulated tumbler built for durability and effortless sipping."}
              </p>
            </div>
          )}
        </AccordionItem>

        {/* 2. STORE / PRODUCT TABS */}
        {sections.map((section) => (
          <AccordionItem
            key={section.key}
            id={section.key}
            title={section.title}
            open={Boolean(openSections[section.key])}
            onToggle={() => toggleSection(section.key)}
          >
            {section.html ? (
              <div className="zpd-prose" dangerouslySetInnerHTML={{ __html: section.html }} />
            ) : (
              <p className="zpd-acc-empty">This section is empty for this product.</p>
            )}
          </AccordionItem>
        ))}

        {/* 3. ADDITIONAL INFORMATION */}
        <AccordionItem
          id="additional"
          title="Additional information"
          open={Boolean(openSections.additional)}
          onToggle={() => toggleSection("additional")}
        >
          <table className="zpd-specs">
            <tbody>
              {specificationRows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AccordionItem>

        {/* 4. REVIEWS (count + jump to the full list) */}
        <AccordionItem
          id="reviews-summary"
          title={`Reviews (${reviewCount})`}
          open={Boolean(openSections.reviews)}
          onToggle={() => toggleSection("reviews")}
        >
          <div className="zpd-review-teaser">
            <div>
              <strong>{reviewCount ? averageRating.toFixed(1) : "–"}</strong>
              <span>
                <Stars value={averageRating} />
                <p>
                  {reviewCount
                    ? `Based on ${reviewCount} verified order${reviewCount === 1 ? "" : "s"}`
                    : "No reviews for this product yet"}
                </p>
              </span>
            </div>

            <button type="button" className="zpd-pill-btn" onClick={scrollToReviews}>
              View all reviews &amp; photos ↓
            </button>
          </div>
        </AccordionItem>
      </div>
    </section>
  );
}
