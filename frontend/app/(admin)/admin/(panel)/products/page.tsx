"use client";

import ProductsAdminList from "@/components/admin/ProductsAdminList";

export default function ProductsPage() {
  return (
    <ProductsAdminList
      mode="catalog"
      title="Products"
      description="Manage your Zelvomart catalog, pricing, stock, media and publishing."
      emptyMessage="No products match this view."
    />
  );
}
