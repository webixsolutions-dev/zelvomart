"use client";

import Link from "next/link";
import ProductAdminTools from "@/components/admin/ProductAdminTools";
import { Product } from "./ProductTableRow";

type Category = { id: string; name: string; slug?: string; count?: number };

interface ProductToolbarProps {
  onExport:()=>void;
  query: string;
  onQueryChange: (query: string) => void;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  categories: Category[];
  categoryCounts: Map<string, number>;
  activeStatus: string;
  onStatusChange: (status: string) => void;
  totalProductsCount: number;
  publishedCount: number;
  draftCount: number;
  mode: "catalog" | "drafts";
  products: Product[];
  onReload: () => void;
  onPostAllDrafts?: () => void;
  postingCount?: number;
  rowsCount?: number;
}

export default function ProductToolbar({
  onExport,
  query,
  onQueryChange,
  activeCategory,
  onCategoryChange,
  categories,
  categoryCounts,
  activeStatus,
  onStatusChange,
  totalProductsCount,
  publishedCount,
  draftCount,
  mode,
  products,
  onReload,
  onPostAllDrafts,
  postingCount = 0,
  rowsCount = 0,
}: ProductToolbarProps) {
  return <div className="pd-toolbar">
    <div className="od-controls pd-filters">
      <input type="search" aria-label="Search products" placeholder="Search products, SKU or category…" value={query} onChange={e=>onQueryChange(e.target.value)}/>
      <select aria-label="Product category" value={activeCategory} onChange={e=>onCategoryChange(e.target.value)}><option value="all">All categories ({totalProductsCount})</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name} ({categoryCounts.get(c.id)||0})</option>)}</select>
      {mode==='catalog'&&<select aria-label="Product status" value={activeStatus} onChange={e=>onStatusChange(e.target.value)}><option value="all">All statuses</option><option value="PUBLISHED">Active ({publishedCount})</option><option value="DRAFT">Draft ({draftCount})</option><option value="LOW_STOCK">Low stock</option><option value="OUT_OF_STOCK">Out of stock</option><option value="ARCHIVED">Archived</option></select>}
    </div>
    <div className="pd-toolbar-actions"><button type="button" className="od-button" onClick={onExport}>↓ Export</button><Link href="/admin/products/add" className="od-button od-primary">＋ Add Product</Link>
      {mode==='drafts'&&rowsCount>0&&onPostAllDrafts&&<button type="button" className="od-button" disabled={postingCount>0} onClick={onPostAllDrafts}>{postingCount>1?'Posting…':`Post all (${rowsCount})`}</button>}
      <ProductAdminTools products={products} onImported={onReload} compact/>
    </div>
  </div>;
}
