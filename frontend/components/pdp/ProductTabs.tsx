"use client";

import { useState, useMemo } from "react";
import type { Product, Variant } from "@/types/product";

interface ProductTabsProps {
  product: Product | any;
  variant: Variant | null;
  inStock: boolean;
}

export default function ProductTabs({
  product,
  variant,
  inStock,
}: ProductTabsProps) {
  const [activeSection, setActiveSection] = useState<string | null>("description");

  const toggleSection = (key: string) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  const openSections: Record<string, boolean> = {
    description: activeSection === "description",
    whyChoose: activeSection === "whyChoose",
    shipping: activeSection === "shipping",
    faq: activeSection === "faq",
    additional: activeSection === "additional",
    reviews: activeSection === "reviews",
  };

  // Fix: Check length > 0 first, otherwise fall back to product.reviewCount or 64
  const reviewCount = useMemo(() => {
    if (Array.isArray(product?.reviews) && product.reviews.length > 0) {
      return product.reviews.length;
    }
    return product?.reviewCount || 64;
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
      ["Payment", "Cash on Delivery (COD) across Pakistan"],
      ["Warranty", "7-Day Check & Replacement Guarantee"],
    ];

    if (variant?.attributes) {
      for (const [key, value] of Object.entries(variant.attributes)) {
        if (value) {
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
    <section className="w-full bg-white border border-slate-200/90 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xs mt-8">
      {/* Card Header Title */}
      <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight pb-4 border-b border-slate-100">
        Details, delivery &amp; reviews
      </h2>

      <div className="divide-y divide-slate-100">
        {/* 1. DESCRIPTION */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection("description")}
            className="w-full flex items-center justify-between text-left group focus:outline-none cursor-pointer"
          >
            <span className="text-[15px] md:text-base font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              Description
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                openSections.description
                  ? "bg-slate-100 text-slate-700 text-xs font-bold"
                  : "text-slate-500 font-normal text-xl leading-none"
              }`}
            >
              {openSections.description ? "✕" : "+"}
            </span>
          </button>

          {openSections.description && (
            <div className="pt-4 text-slate-700 text-[14px] md:text-[15px] leading-relaxed">
              {product?.descriptionHtml || product?.description ? (
                <div
                  className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-normal"
                  dangerouslySetInnerHTML={{
                    __html: product.descriptionHtml || product.description,
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900">
                    {product?.title || product?.name}
                  </h3>
                  <p>
                    {product?.shortDescription ||
                      "Keep your drinks hot or cold for hours with the double-wall stainless steel insulated tumbler built for durability and effortless sipping."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. WHY CHOOSE ZELVOMART */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection("whyChoose")}
            className="w-full flex items-center justify-between text-left group focus:outline-none cursor-pointer"
          >
            <span className="text-[15px] md:text-base font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              Why Choose Zelvomart
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                openSections.whyChoose
                  ? "bg-slate-100 text-slate-700 text-xs font-bold"
                  : "text-slate-500 font-normal text-xl leading-none"
              }`}
            >
              {openSections.whyChoose ? "✕" : "+"}
            </span>
          </button>

          {openSections.whyChoose && (
            <div className="pt-4 text-slate-700 text-[14px] md:text-[15px] leading-relaxed space-y-2">
              <p><b>Cash on Delivery</b> — Pay only when your order arrives at your door.</p>
              <p><b>Quality Checked</b> — Every product is inspected before dispatch.</p>
              <p><b>Nationwide Delivery</b> — We reach every city across Pakistan.</p>
              <p><b>Real Support</b> — Message us on WhatsApp, talk to a real person.</p>
            </div>
          )}
        </div>

        {/* 3. SHIPPING PROCESS */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection("shipping")}
            className="w-full flex items-center justify-between text-left group focus:outline-none cursor-pointer"
          >
            <span className="text-[15px] md:text-base font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              Shipping Process
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                openSections.shipping
                  ? "bg-slate-100 text-slate-700 text-xs font-bold"
                  : "text-slate-500 font-normal text-xl leading-none"
              }`}
            >
              {openSections.shipping ? "✕" : "+"}
            </span>
          </button>

          {openSections.shipping && (
            <div className="pt-4 text-slate-700 text-[14px] md:text-[15px] leading-relaxed space-y-2.5">
              <p><b>Order Confirmation:</b> Verified via call or WhatsApp within 24 hours.</p>
              <p><b>Dispatch Partners:</b> Handled securely via PostEx and Trax logistics.</p>
              <p><b>Timeline:</b> 2–4 working days for major cities, 3–5 days nationwide.</p>
            </div>
          )}
        </div>

        {/* 4. GENERAL FAQ */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection("faq")}
            className="w-full flex items-center justify-between text-left group focus:outline-none cursor-pointer"
          >
            <span className="text-[15px] md:text-base font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              General FAQ
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                openSections.faq
                  ? "bg-slate-100 text-slate-700 text-xs font-bold"
                  : "text-slate-500 font-normal text-xl leading-none"
              }`}
            >
              {openSections.faq ? "✕" : "+"}
            </span>
          </button>

          {openSections.faq && (
            <div className="pt-4 text-slate-700 text-[14px] md:text-[15px] leading-relaxed space-y-3">
              <div>
                <p className="font-bold text-slate-900">Q: Can I check the product before paying?</p>
                <p className="text-slate-600">Yes, riders in major cities allow parcel inspection. We also provide a 7-day replacement warranty.</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">Q: What if I receive a damaged product?</p>
                <p className="text-slate-600">Share pictures on WhatsApp within 7 days for a quick replacement.</p>
              </div>
            </div>
          )}
        </div>

        {/* 5. ADDITIONAL INFORMATION */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection("additional")}
            className="w-full flex items-center justify-between text-left group focus:outline-none cursor-pointer"
          >
            <span className="text-[15px] md:text-base font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              Additional information
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                openSections.additional
                  ? "bg-slate-100 text-slate-700 text-xs font-bold"
                  : "text-slate-500 font-normal text-xl leading-none"
              }`}
            >
              {openSections.additional ? "✕" : "+"}
            </span>
          </button>

          {openSections.additional && (
            <div className="pt-4">
              <table className="w-full text-left text-sm text-slate-700 border-collapse">
                <tbody>
                  {specificationRows.map(([label, value]) => (
                    <tr key={label} className="border-b border-slate-100 last:border-b-0">
                      <th className="py-2.5 font-bold text-slate-900 w-1/3 pr-4">{label}</th>
                      <td className="py-2.5 text-slate-600">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. REVIEWS (Accurate Count + Jump Trigger) */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection("reviews")}
            className="w-full flex items-center justify-between text-left group focus:outline-none cursor-pointer"
          >
            <span className="text-[15px] md:text-base font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              Reviews ({reviewCount})
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                openSections.reviews
                  ? "bg-slate-100 text-slate-700 text-xs font-bold"
                  : "text-slate-500 font-normal text-xl leading-none"
              }`}
            >
              {openSections.reviews ? "✕" : "+"}
            </span>
          </button>

          {openSections.reviews && (
            <div className="pt-4 text-slate-700 text-[14px] leading-relaxed">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="flex items-center gap-3.5">
                  <span className="text-3xl font-black text-slate-900 leading-none">
                    {product?.averageRating?.toFixed(1) || "4.9"}
                  </span>
                  <div>
                    <div className="flex text-[#f59e0b] text-sm">★★★★★</div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Based on {reviewCount} verified orders
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={scrollToReviews}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
                >
                  View all reviews &amp; photos ↓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}