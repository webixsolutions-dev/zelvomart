"use client";

import ProductsAdminList from "@/components/admin/ProductsAdminList";

export default function ProductDraftsPage() {
  return (
    <ProductsAdminList
      mode="drafts"
      title="Draft products"
      description="Products saved as drafts. They stay off the shop until you post them."
      emptyMessage="No draft products yet."
    />
  );
}
