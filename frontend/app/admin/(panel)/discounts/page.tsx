"use client";

import Link from "next/link";
import { AdminError, AdminLoading, useAdminData } from "@/components/admin/useAdminData";

const OFF = ["15-off", "20-off", "30-off"];

type Product = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  salePrice?: number | null;
  tags?: string[];
  catalogMeta?: { tags?: string[] };
};

export default function DiscountsAdminPage() {
  const { data, loading, error } = useAdminData<Product[]>("/api/admin/products", []);
  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  const products = data.filter((product) => {
    const tags = product.tags || product.catalogMeta?.tags || [];
    return tags.some((tag) => OFF.includes(tag)) || (product.salePrice != null && Number(product.salePrice) > 0);
  });

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Discounts</h1>
          <p>15% off, 20% off and 30% off products appear on the store discount page, together with products that have a sale price.</p>
        </div>
        <Link className="admin-btn admin-btn-light" href="/discount">View store page</Link>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Product</th><th>Offer</th><th>Status</th></tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const tags = (product.tags || product.catalogMeta?.tags || []).filter((tag) => OFF.includes(tag));
              const labels = tags.map((tag) => tag.replace("-off", "% off"));
              if (product.salePrice) labels.push(`Sale Rs ${product.salePrice}`);
              return (
                <tr key={product.id}>
                  <td><Link href={`/admin/products/${product.id}`}>{product.title || product.name}</Link></td>
                  <td>{labels.join(" · ") || "On sale"}</td>
                  <td>{product.status === "PUBLISHED" ? "Posted" : "Draft"}</td>
                </tr>
              );
            })}
            {!products.length ? <tr><td colSpan={3}>No discount products yet. Add a 15%, 20% or 30% off tag on a product.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
