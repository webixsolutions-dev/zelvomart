"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCategory, categoryPath, upsertProducts, type Product } from "@store/lib/catalog";
import { toDesignProduct } from "@store/lib/product-map";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { ProductDetail } from "@store/components/product/ProductDetail";
import type { Product as ApiProduct } from "@/types/product";

const PREVIEW_KEY = "zelvomart-product-preview";

/** The admin's product preview (Admin → Products → Preview), shown with the storefront's product page. */
export default function ProductPreviewPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREVIEW_KEY) || sessionStorage.getItem(PREVIEW_KEY);
      const preview = raw ? (JSON.parse(raw) as ApiProduct) : null;
      if (preview?.slug) {
        const p = toDesignProduct({ ...preview, id: preview.id || `preview-${preview.slug}` });
        upsertProducts([p]);
        setProduct(p);
      }
    } catch {
      setProduct(null);
    }
    setReady(true);
  }, []);

  if (!ready) return <div className="container skeleton-block" />;

  if (!product) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>Nothing to preview yet</h2>
          <p>Add the product details, then choose Preview in the product editor.</p>
          <Link href="/admin/products/add" className="btn">
            Back to the product editor
          </Link>
        </div>
      </div>
    );
  }

  const cat = getCategory(product.category)!;
  return (
    <div className="product-page">
      <Breadcrumbs items={[{ label: cat.name, href: categoryPath(cat.id) }, { label: product.name }]} />
      <ProductDetail slug={product.slug} />
    </div>
  );
}
