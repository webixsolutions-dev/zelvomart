"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { useAdminData, AdminError } from "@/components/admin/useAdminData";

export default function AddProductPage() {
  const router = useRouter();
  const { data: categories, error } = useAdminData<any[]>("/api/admin/categories", []);

  if (error) return <AdminError message={error} />;

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
          <h1 className="admin-products-heading" style={{ margin: 0 }}>Add new product</h1>
        </div>
      </div>
      <ProductForm
        categories={categories}
        onSaved={(product) => {
          if (product?.id) router.replace(`/admin/products/${product.id}`);
          else router.push("/admin/products");
        }}
      />
    </>
  );
}
