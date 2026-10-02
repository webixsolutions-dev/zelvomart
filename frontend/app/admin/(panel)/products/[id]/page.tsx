"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAdminData, AdminLoading, AdminError } from "@/components/admin/useAdminData";
import ProductForm from "@/components/admin/ProductForm";
import AdminModal from "@/components/admin/AdminModal";
import { clientApi } from "@/lib/client-api";

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: product, loading, error, reload } = useAdminData<any>(`/api/admin/products/${id}`, null);
  const { data: categories } = useAdminData<any[]>("/api/admin/categories", []);

  if (loading) return <AdminLoading />;
  if (error || !product) return <AdminError message={error || "Product not found"} />;

  async function addVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await clientApi(
      `/api/admin/products/${id}/variants`,
      {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          sku: form.get("sku"),
          stock: Number(form.get("stock") || 0),
          priceOverride: form.get("priceOverride") || null,
          imageUrl: form.get("imageUrl") || null,
          attributes: { label: form.get("name") },
        }),
      },
      true,
    );
    await reload();
  }

  async function deleteVariant(variantId: string) {
    if (!confirm("Delete this variant?")) return;
    await clientApi(`/api/admin/variants/${variantId}`, { method: "DELETE" }, true);
    await reload();
  }

  async function deleteProduct() {
    if (!confirm("Delete this product permanently?")) return;
    await clientApi(`/api/admin/products/${id}`, { method: "DELETE" }, true);
    router.push("/admin/products");
  }

  return (
    <>
      <div className="admin-title admin-product-form-page-title">
        <div>
          <Link className="admin-back-link" href="/admin/products">← Back to Products</Link>
          <h1>Edit Product</h1>
          <p>{product.title || product.name} • {product.sku}</p>
        </div>
        <button className="admin-btn admin-row-action-danger" onClick={deleteProduct}>Delete Product</button>
      </div>

      <ProductForm categories={categories} initial={product} onSaved={() => void reload()} />

      <section className="admin-section-card admin-product-variants-card">
        <div className="admin-section-head">
          <div><h2>Variants</h2><p>Add colour, size or option-level SKU and stock when needed.</p></div>
          <AdminModal trigger={<>＋ Add Variant</>} title="Add Variant" size="md">
            <form className="admin-reference-form" onSubmit={addVariant}>
              <label className="field"><span>Name</span><input name="name" required /></label>
              <label className="field"><span>SKU</span><input name="sku" required /></label>
              <label className="field"><span>Stock</span><input name="stock" type="number" defaultValue="0" /></label>
              <label className="field"><span>Price override</span><input name="priceOverride" type="number" step="0.01" /></label>
              <label className="field full"><span>Image URL</span><input name="imageUrl" /></label>
              <button className="admin-reference-submit">Add Variant</button>
            </form>
          </AdminModal>
        </div>
        <div className="admin-variant-list">
          {(product.variants || []).length ? (product.variants || []).map((variant: any) => (
            <div className="admin-variant-row" key={variant.id}>
              <div><b>{variant.name}</b><small>{variant.sku} • stock {variant.stock}</small></div>
              <button className="admin-btn admin-row-action-danger" onClick={() => deleteVariant(variant.id)}>Delete</button>
            </div>
          )) : <div className="admin-empty-inline">No variants.</div>}
        </div>
      </section>
    </>
  );
}
