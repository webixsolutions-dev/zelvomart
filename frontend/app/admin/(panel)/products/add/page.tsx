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
          <h1>Add new product</h1>
          <p>Name, price and stock are enough to post. Image and brand are optional. Tags place the product on bestsellers, new arrivals or discounts, and the shop still lists every posted product.</p>
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
