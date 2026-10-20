"use client";
import "@/components/admin/catalog-pages.css";

import Link from "next/link";
import { AdminError, AdminLoading, useAdminData } from "@/components/admin/useAdminData";

const TAGS = [
  { id: "best-selling", label: "Best selling", where: "Bestsellers" },
  { id: "new-arrival", label: "New arrival", where: "New in" },
  { id: "15-off", label: "15% off", where: "Discounts" },
  { id: "20-off", label: "20% off", where: "Discounts" },
  { id: "30-off", label: "30% off", where: "Discounts" },
];

type Product = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  tags?: string[];
  catalogMeta?: { tags?: string[] };
};

export default function TagsPage() {
  const { data, loading, error } = useAdminData<Product[]>("/api/admin/products", []);
  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  return (
    <div className="admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Product tags</h1>
          <p>Manage product labels and discount tags. Open a product to update its tags.</p>
        </div>
        <Link className="admin-btn admin-btn-primary" href="/admin/products/add">Add product</Link>
      </div>
      <div className="admin-collection-grid">
        {TAGS.map((tag) => {
          const products = data.filter((product) => (product.tags || product.catalogMeta?.tags || []).includes(tag.id));
          return (
            <section className="admin-card" key={tag.id}>
              <div className="catalog-card-heading"><span className="catalog-tag-icon" aria-hidden="true">#</span><h2>{tag.label}</h2><span className="catalog-count">{products.length}</span></div>
              <p>{products.length} product{products.length === 1 ? "" : "s"} assigned to this tag</p>
              <ul>
                {products.map((product) => (
                  <li key={product.id}>
                    <Link href={`/admin/products/${product.id}`}>{product.title || product.name}</Link>
                    <small className="catalog-status">{product.status === "PUBLISHED" ? "Posted" : "Draft"}</small>
                  </li>
                ))}
                {!products.length ? <li><span>No products use this tag yet.</span></li> : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
