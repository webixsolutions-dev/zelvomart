"use client";
import AdminListView from "@/components/admin/AdminListView";
import "@/components/admin/catalog-pages.css";
import AdminTable from '@/components/admin/AdminTable';


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
  const { data, loading, error, reload } = useAdminData<Product[]>("/api/admin/products", []);
  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  const products = data.filter((product) => {
    const tags = product.tags || product.catalogMeta?.tags || [];
    return tags.some((tag) => OFF.includes(tag)) || (product.salePrice != null && Number(product.salePrice) > 0);
  });

  return (
    <div className="admin-catalog-page">
      <div className="admin-title">
        <div>
          <h1>Discounts</h1>
          <p>15% off, 20% off and 30% off products appear on the store discount page, together with products that have a sale price.</p>
        </div>
        <Link className="admin-btn admin-btn-light" href="/deals-and-offers">View store page</Link>
      </div>
      <div className="admin-list-container">
        <AdminListView onRefresh={reload} rows={products} label="Discount products" search={r=>`${r.title||r.name||''} ${(r.tags||r.catalogMeta?.tags||[]).join(' ')}`} searchHint="Search product or offer tag" sorts={[{label:'Product',value:r=>r.title||r.name||''},{label:'Sale price',value:r=>Number(r.salePrice)||0}]} filters={[{label:'Status',value:r=>r.status==='PUBLISHED'?'Published':'Draft'}]} metrics={[{label:'Discount products',value:r=>r.length},{label:'Published',value:r=>r.filter(p=>p.status==='PUBLISHED').length},{label:'Drafts',value:r=>r.filter(p=>p.status!=='PUBLISHED').length},{label:'Sale prices',value:r=>r.filter(p=>Number(p.salePrice)>0).length}]}>{visibleRows=>(<AdminTable scrollLabel="Discounts" className="admin-table">
          <thead>
            <tr><th>Product</th><th>Offer</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {visibleRows.map((product) => {
              const tags = (product.tags || product.catalogMeta?.tags || []).filter((tag) => OFF.includes(tag));
              const labels = tags.map((tag) => tag.replace("-off", "% off"));
              if (product.salePrice) labels.push(`Sale Rs ${product.salePrice}`);
              return (
                <tr key={product.id}>
                  <td><Link href={`/admin/products/${product.id}`}>{product.title || product.name}</Link></td>
                  <td>{labels.join(" · ") || "On sale"}</td>
                  <td><span className="catalog-status">{product.status === "PUBLISHED" ? "Posted" : "Draft"}</span></td>
                  <td><Link className="admin-btn admin-btn-light" href={`/admin/products/${product.id}`}>Edit product</Link></td>
                </tr>
              );
            })}
            {!visibleRows.length ? <tr><td colSpan={4}>No discount products yet. Add a 15%, 20% or 30% off tag on a product.</td></tr> : null}
          </tbody>
        </AdminTable>)}</AdminListView>
      </div>
    </div>
  );
}
