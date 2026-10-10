"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { useAdminData, AdminError, AdminLoading } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data: categories, error: categoriesError } = useAdminData<any[]>("/api/admin/categories", []);
  const { data: product, loading: productLoading, error: productError } = useAdminData<any>(`/api/admin/products/${id}`, null);

  if (productLoading) return <AdminLoading />;
  if (productError) return <AdminError message={productError} />;
  if (categoriesError) return <AdminError message={categoriesError} />;
  if (!product) return <AdminError message="Product not found" />;

  async function handleDelete() {
    const label = product.title || product.name || "this product";
    const confirmed = window.confirm(
      `Are you sure you want to delete ${label}?\n\nWarning: Associated variants and customer reviews will also be permanently deleted. This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteBusy(true);
    setDeleteError("");
    try {
      await clientApi(`/api/admin/products/${id}`, { method: "DELETE" }, true);
      router.push("/admin/products");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete product");
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="admin-title admin-product-form-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <Link className="admin-back-link" href="/admin/products">← Back to Products</Link>
          <h1>Edit Product</h1>
          <p>Update details, pricing, media, SEO and publishing controls for {product.title || product.name || "this item"}.</p>
        </div>
        <div>
          <button
            type="button"
            className="admin-btn admin-row-action-danger"
            disabled={deleteBusy}
            onClick={handleDelete}
            style={{ marginTop: "1rem" }}
          >
            {deleteBusy ? "Deleting..." : "Delete Product"}
          </button>
        </div>
      </div>
      {deleteError ? (
        <div className="admin-import-message error" style={{ marginBottom: "1rem" }}>
          {deleteError}
        </div>
      ) : null}
      <ProductForm
        categories={categories}
        initial={product}
        onSaved={() => router.push("/admin/products")}
      />
    </>
  );
}