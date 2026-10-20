"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProductDetailClient from "@/components/ProductDetailClient";
import { API_BASE } from "@/lib/client-api";
import { resolveProductTabs, type ResolvedProductTab } from "@/lib/product-tabs";
import type { Product } from "@/types/product";

export default function ProductPreviewPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [sections, setSections] = useState<ResolvedProductTab[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let preview: Product | null = null;
    try {
      const raw = localStorage.getItem("zelvomart-product-preview") || sessionStorage.getItem("zelvomart-product-preview");
      preview = raw ? (JSON.parse(raw) as Product) : null;
    } catch {
      preview = null;
    }
    setProduct(preview);

    const catalogMeta = preview?.catalogMeta;
    fetch(`${API_BASE}/api/settings/public?keys=${encodeURIComponent("store.productTabs")}`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((settings: Record<string, unknown>) => setSections(resolveProductTabs(settings?.["store.productTabs"], catalogMeta)))
      .catch(() => setSections(resolveProductTabs(null, catalogMeta)))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  if (!product) {
    return (
      <section className="site-shell pd-preview-empty">
        <h1>Nothing to preview yet</h1>
        <p>Add the product details, then choose Preview in the product editor.</p>
        <Link href="/admin/products/add">Back to the product editor</Link>
      </section>
    );
  }

  return (
    <div className="product-page">
      <div className="site-shell max-w-[1240px] mx-auto px-4 md:px-6">
        <ProductDetailClient product={product} sections={sections} />
      </div>
    </div>
  );
}
