"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { AdminError, AdminLoading, useAdminData } from "@/components/admin/useAdminData";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const productPath = id ? `/api/admin/products/${id}` : "";
  const { data: product, loading, error, reload } = useAdminData<any>(productPath || "/api/admin/products", null);
  const { data: categories, error: categoryError } = useAdminData<any[]>("/api/admin/categories", []);

  if (!id) return <AdminError message="This product could not be opened." />;
  if (error || categoryError) return <AdminError message={error || categoryError} />;
  if (loading || !product?.id) return <AdminLoading />;

  const posted = product.status === "PUBLISHED";

  return (
    <>
      <div className="admin-title admin-product-form-page-title">
        <div>
          <Link className="admin-back-link" href="/admin/products">← Back to Products</Link>
          <h1>{product.title || product.name || "Edit product"}</h1>
          <p>{posted ? "This product is posted. It appears on the shop and in its category." : "This product is saved as a draft. Reloading keeps it as a draft until you post it."}</p>
        </div>
      </div>
      <ProductForm
        key={`${product.id}:${product.updatedAt || product.status}`}
        categories={categories || []}
        initial={product}
        onSaved={() => {
          void reload();
        }}
      />
    </>
  );
}
