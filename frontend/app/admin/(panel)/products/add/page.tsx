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
      <div className="admin-title admin-product-form-page-title">
        <div>
          <Link className="admin-back-link" href="/admin/products">← Back to Products</Link>
          <h1>Add Product</h1>
          <p>Create a new catalog product with pricing, stock, media, SEO and publishing controls.</p>
        </div>
      </div>
      <ProductForm categories={categories} onSaved={() => router.push("/admin/products")} />
    </>
  );
}
