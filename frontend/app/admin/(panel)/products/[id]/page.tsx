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
      <div className="admin-products-header-container" style={{ marginBottom: 20 }}>
        <div className="admin-products-header-copy">
          <Link
            className="admin-back-link"
            href="/admin/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--adm-primary)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              marginBottom: 8,
            }}
          >
            ← Back to Products
          </Link>
          <h1 className="admin-products-heading" style={{ margin: 0 }}>{product.title || product.name || "Edit product"}</h1>
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
