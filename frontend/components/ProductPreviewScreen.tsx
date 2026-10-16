"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import { API_BASE } from "@/lib/client-api";
import { resolveProductTabs, type ResolvedProductTab } from "@/lib/product-tabs";
import type { Product } from "@/types/product";

const PREVIEW_KEY = "zelvomart-product-preview";
const PREVIEW_MS = 30 * 60 * 1000;

function readAdminPreview(slug: string): Product | null {
  try {
    const raw = sessionStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    const preview = JSON.parse(raw) as Product & { previewAt?: number };
    if (!preview?.slug || preview.slug !== slug) return null;
    if (!preview.previewAt || Date.now() - preview.previewAt > PREVIEW_MS) return null;
    return preview;
  } catch {
    return null;
  }
}

/**
 * Shows the editor preview on this product's own URL (`/product/{slug}`).
 * Shoppers never have the preview payload, so they keep the published page.
 */
export default function ProductPreviewScreen({
  slug,
  fallback,
  missingRedirect = "/shop",
}: {
  slug: string;
  fallback?: ReactNode;
  missingRedirect?: string;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Product | null>(null);
  const [checked, setChecked] = useState(false);
  const [sections, setSections] = useState<ResolvedProductTab[]>([]);
  const [whatsapp, setWhatsapp] = useState("923002026711");

  const hasLivePage = fallback != null;
  useEffect(() => {
    const found = readAdminPreview(slug);
    setPreview(found);
    setChecked(true);
    if (!found) {
      if (!hasLivePage) router.replace(missingRedirect);
      return;
    }
    const catalogMeta = found.catalogMeta;
    fetch(`${API_BASE}/api/settings/public?keys=${encodeURIComponent("store.productTabs,store.info")}`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((settings: Record<string, unknown>) => {
        setSections(resolveProductTabs(settings?.["store.productTabs"], catalogMeta));
        const info = settings?.["store.info"] as { whatsapp?: string } | undefined;
        if (info?.whatsapp) setWhatsapp(String(info.whatsapp).replace(/[^0-9]/g, ""));
      })
      .catch(() => setSections(resolveProductTabs(null, catalogMeta)));
  }, [slug, hasLivePage, missingRedirect, router]);

  if (!checked || !preview) return <>{fallback}</>;

  const productView = (
    <ProductDetailClient product={preview} whatsapp={whatsapp} sections={sections} />
  );

  if (fallback) return productView;

  return (
    <div className="product-page zpd-page">
      <div className="site-shell">
        <nav className="zpd-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/shop">Shop</Link>
          <span>›</span>
          <span>{preview.name}</span>
        </nav>
        {productView}
      </div>
    </div>
  );
}
